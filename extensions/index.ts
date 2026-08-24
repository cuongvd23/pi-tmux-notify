/**
 * Pi Tmux Notify Extension
 *
 * When pi settles (done working, waiting for input), sends a desktop
 * notification via the best-supported terminal protocol:
 * - OSC 99  (Kitty)
 * - OSC 777 (Ghostty, WezTerm, iTerm2, rxvt-unicode)
 * - OSC 9   (fallback: Windows Terminal, ConEmu, foot, older iTerm2)
 *
 * Clicking the notification focuses the terminal surface; if running inside
 * tmux, a one-shot `client-focus-in` hook then switches tmux back to the
 * session/window/pane that fired the notification.
 *
 * - Wraps escape sequences in tmux DCS passthrough when $TMUX is set
 * - Warns once if tmux `allow-passthrough` is off
 * - Cancels the pending focus-hook when the user types (input event)
 * - Cleans up the hook on session shutdown
 */

import { execFile } from "node:child_process";
import { openSync, writeSync, closeSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";

const HOOK_NAME = "client-focus-in[777]";

interface TmuxTarget {
	session: string;
	windowId: string; // @-id, stable
	paneId: string; // %-id, stable
}

function tmux(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile("tmux", args, (err, stdout) => {
			if (err) reject(err);
			else resolve(stdout.trim());
		});
	});
}

function sanitize(text: string): string {
	// Strip control chars and OSC delimiters (; separates fields in OSC 777)
	// eslint-disable-next-line no-control-regex
	return text.replace(/[\x00-\x1f\x07\x9c]/g, " ").replace(/;/g, ",");
}

function writeToTty(data: string): void {
	let fd: number | undefined;
	try {
		fd = openSync("/dev/tty", "w");
		writeSync(fd, data);
	} catch {
		// Fallback: stdout (may be intercepted by TUI, but better than nothing)
		process.stdout.write(data);
	} finally {
		if (fd !== undefined) closeSync(fd);
	}
}

type NotifyProtocol = "osc777" | "osc99" | "osc9" | "auto";

function detectProtocol(): Exclude<NotifyProtocol, "auto"> {
	const term = (process.env.TERM_PROGRAM ?? "").toLowerCase();
	const termName = (process.env.TERM ?? "").toLowerCase();
	if (process.env.KITTY_WINDOW_ID || term === "kitty" || termName.includes("kitty")) return "osc99";
	if (
		process.env.GHOSTTY_RESOURCES_DIR ||
		term === "ghostty" ||
		termName.includes("ghostty") ||
		term === "wezterm" ||
		term === "iterm.app" ||
		termName.includes("rxvt")
	) {
		return "osc777";
	}
	// OSC 9 is the most widely implemented fallback
	// (Windows Terminal, ConEmu, foot, xterm w/ patches, ...)
	return "osc9";
}

function buildNotifySeq(protocol: Exclude<NotifyProtocol, "auto">, title: string, body: string): string {
	const t = sanitize(title);
	const b = sanitize(body);
	switch (protocol) {
		case "osc99":
			// Kitty desktop notification: two-part (title, then body) with ST terminator
			return `\x1b]99;i=pi:d=0;${t}\x1b\\\x1b]99;i=pi:d=1:p=body;${b}\x1b\\`;
		case "osc9":
			// Single text field only
			return `\x1b]9;${t}: ${b}\x07`;
		case "osc777":
			return `\x1b]777;notify;${t};${b}\x07`;
	}
}

function sendNotification(protocol: NotifyProtocol, title: string, body: string): void {
	let seq = buildNotifySeq(protocol === "auto" ? detectProtocol() : protocol, title, body);
	if (process.env.TMUX) {
		// tmux DCS passthrough: ESC inside payload must be doubled
		seq = `\x1bPtmux;${seq.replace(/\x1b/g, "\x1b\x1b")}\x1b\\`;
	}
	writeToTty(seq);
}

export default function (pi: ExtensionAPI) {
	const inTmux = Boolean(process.env.TMUX && process.env.TMUX_PANE);
	let target: TmuxTarget | undefined;
	let hookArmed = false;
	let warnedPassthrough = false;
	let enabled = true;
	let protocol: NotifyProtocol = "auto";

	async function captureTarget(): Promise<void> {
		if (!inTmux) return;
		try {
			const out = await tmux([
				"display-message",
				"-p",
				"-t",
				process.env.TMUX_PANE!,
				"#{session_name}\t#{window_id}\t#{pane_id}",
			]);
			const [session, windowId, paneId] = out.split("\t");
			if (session && windowId && paneId) target = { session, windowId, paneId };
		} catch {
			// tmux unavailable; degrade gracefully
		}
	}

	async function ensurePassthrough(): Promise<void> {
		if (!inTmux) return;
		try {
			// Pane-scoped: "all" forwards escapes even when this pane is not visible.
			// Does not modify the user's global tmux config.
			await tmux(["set-option", "-p", "-t", process.env.TMUX_PANE!, "allow-passthrough", "all"]);
		} catch {
			// ignore; checkPassthrough will warn if unusable
		}
	}

	async function checkPassthrough(ctx: { ui: { notify: (m: string, t: "warning") => void } }): Promise<void> {
		if (!inTmux || warnedPassthrough) return;
		try {
			const val = await tmux(["show", "-Ap", "-t", process.env.TMUX_PANE!, "allow-passthrough"]);
			if (!/\ball\b/.test(val)) {
				warnedPassthrough = true;
				ctx.ui.notify(
					"pi-tmux-notify: set tmux 'allow-passthrough all' so notifications work from background panes — tmux set -g allow-passthrough all",
					"warning",
				);
			}
		} catch {
			// ignore
		}
	}

	async function armFocusHook(): Promise<void> {
		if (!inTmux || !target) return;
		// If our pane is already the active pane of an attached, focused client, skip.
		try {
			const active = await tmux([
				"display-message",
				"-p",
				"-t",
				process.env.TMUX_PANE!,
				"#{&&:#{pane_active},#{window_active}}",
			]);
			// Even if active, the Ghostty window may be unfocused — still notify,
			// but no hook needed if we're already the visible pane.
			if (active === "1") return;
		} catch {
			// proceed anyway
		}
		const q = (s: string) => `"${s.replace(/(["\\$`])/g, "\\$1")}"`;
		const shellCmd = [
			`tmux switch-client -t ${q(target.session)}`,
			`tmux select-window -t ${q(target.windowId)}`,
			`tmux select-pane -t ${q(target.paneId)}`,
			`tmux set-hook -gu ${q(HOOK_NAME)}`,
		].join(" ; ");
		try {
			await tmux(["set-hook", "-g", HOOK_NAME, `run-shell '${shellCmd.replace(/'/g, `'\\''`)}'`]);
			hookArmed = true;
		} catch {
			// hook not critical; notification still fires
		}
	}

	async function disarmFocusHook(): Promise<void> {
		if (!hookArmed) return;
		hookArmed = false;
		try {
			await tmux(["set-hook", "-gu", HOOK_NAME]);
		} catch {
			// ignore
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") {
			enabled = false;
			return;
		}
		await captureTarget();
		await ensurePassthrough();
		await checkPassthrough(ctx);
	});

	pi.on("agent_settled", async (_event, ctx) => {
		if (!enabled) return;
		const label = basename(ctx.cwd);
		sendNotification(protocol, `pi — ${label}`, "Done. Waiting for next instruction.");
		await armFocusHook();
	});

	// User typed something — they found us; don't teleport them later.
	pi.on("input", async () => {
		await disarmFocusHook();
	});

	pi.on("session_shutdown", async () => {
		await disarmFocusHook();
	});

	pi.registerCommand("pi-tmux-notify", {
		description: "Toggle finish notifications: on|off|osc777|osc99|osc9|auto|test",
		handler: async (args, ctx) => {
			const arg = (args ?? "").trim();
			if (arg === "on") enabled = true;
			else if (arg === "off") enabled = false;
			else if (arg === "osc777" || arg === "osc99" || arg === "osc9" || arg === "auto") protocol = arg;
			else if (arg === "test") sendNotification(protocol, "pi test", "Test notification");
			else enabled = !enabled;
			if (!enabled) await disarmFocusHook();
			const effective = protocol === "auto" ? `auto (${detectProtocol()})` : protocol;
			ctx.ui.notify(`pi-tmux-notify: ${enabled ? "on" : "off"}, protocol: ${effective}`, "info");
		},
	});
}
