# pi-tmux-notify

Desktop notifications for [pi](https://pi.dev) when the agent finishes work and is waiting for your next instruction — with **click-to-return** to the exact tmux pane that fired the notification.

## Features

- 🔔 Notifies via the best-supported terminal protocol, auto-detected:
  - **OSC 99** — Kitty
  - **OSC 777** — Ghostty, WezTerm, iTerm2, rxvt-unicode
  - **OSC 9** — fallback (Windows Terminal, ConEmu, foot, …)
- 🖱️ **Click the notification badge → land on the firing tmux pane.** Clicking focuses the terminal surface; a one-shot tmux `client-focus-in` hook then switches to the exact session/window/pane.
- 🧵 tmux-aware: wraps escape sequences in DCS passthrough and sets `allow-passthrough all` **pane-scoped** (your tmux config is untouched), so notifications fire even from background panes/windows.
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

- A terminal that supports desktop notifications via OSC (Ghostty, Kitty, WezTerm, iTerm2, Windows Terminal, foot, …)
- On macOS: notification permission granted to your terminal (System Settings → Notifications)
- tmux (optional): version with `allow-passthrough` (3.3+). Focus return additionally needs `focus-events on`.

Notes:

- Notifications are typically suppressed by the terminal while the emitting surface is focused (that's desirable).
- Click-to-focus behavior varies by terminal; Ghostty and Kitty focus the emitting window on click. The tmux pane-return works whenever the terminal regains focus.
- With multiple pi instances, the most recent notifier owns the focus hook.

## License

MIT
