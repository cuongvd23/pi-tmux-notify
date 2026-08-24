# pi-tmux-notify

Desktop notifications for [pi](https://pi.dev) sessions running in **tmux**: when the agent finishes work and waits for your next instruction, you get a notification — and clicking it **returns you to the exact tmux pane** that fired it. Perfect for running many pi instances across panes and windows.

## Features

- 🖱️ **Click the notification badge → land on the firing tmux pane.** Clicking focuses the terminal surface; a one-shot tmux `client-focus-in` hook then switches to the exact session/window/pane.
- 🧵 Notifications fire even from background panes/windows: escape sequences are wrapped in tmux DCS passthrough and `allow-passthrough all` is set **pane-scoped** (your tmux config is untouched).
- 🔔 Auto-detects the best-supported terminal notification protocol:
  - **OSC 99** — Kitty
  - **OSC 777** — Ghostty, WezTerm, iTerm2, rxvt-unicode
  - **OSC 9** — fallback (Windows Terminal, ConEmu, foot, …)
- 🧹 Safe: the focus hook is one-shot and self-removing, disarmed if you type first, and cleaned up on session shutdown. Uses a namespaced hook index (`client-focus-in[777]`) so it won't clobber your own hooks.

## Install

```bash
pi install npm:pi-tmux-notify
```

Or from git:

```bash
pi install git:github.com/cuongvd23/pi-tmux-notify
```

Or try it without installing:

```bash
pi -e npm:pi-tmux-notify
```

## Usage

Works out of the box — a notification fires whenever pi settles (done working, no pending retries/follow-ups) via the `agent_settled` event.

Command:

```
/pi-tmux-notify              # toggle on/off
/pi-tmux-notify on|off       # explicit toggle
/pi-tmux-notify osc777|osc99|osc9|auto   # force a protocol
/pi-tmux-notify test         # fire a test notification now
```

## Requirements

- **tmux 3.3+** (`allow-passthrough` support); pane focus-return needs `focus-events on`
- A terminal that supports desktop notifications via OSC (Ghostty, Kitty, WezTerm, iTerm2, Windows Terminal, foot, …)
- On macOS: notification permission granted to your terminal (System Settings → Notifications)

Outside tmux the extension still works in degraded mode: you get the notification and the terminal's native click-to-focus, just without pane-precise return.

Notes:

- Notifications are typically suppressed by the terminal while the emitting surface is focused (that's desirable).
- Click-to-focus behavior varies by terminal; Ghostty and Kitty focus the emitting window on click. The tmux pane-return works whenever the terminal regains focus.
- With multiple pi instances, the most recent notifier owns the focus hook.

## License

MIT
