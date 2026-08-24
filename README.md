# pi-tmux-notify

Desktop notifications for [pi](https://pi.dev) in **tmux**: get notified when the agent finishes and waits for input — click the notification to jump back to the tmux pane that fired it.

## Features

- 🖱️ Click the notification → tmux switches to the firing session/window/pane
- 🧵 Fires from background panes/windows (via tmux DCS passthrough)
- 🔔 Auto-detects the notification protocol: OSC 99 (Kitty), OSC 777 (Ghostty, WezTerm, iTerm2), OSC 9 (fallback)
- 🧹 Never modifies your tmux settings; the only tmux state used is a one-shot, self-removing hook (`client-focus-in[777]`)

## Requirements

- tmux 3.3+ with:

  ```tmux
  set -g allow-passthrough all   # forward notifications from background panes
  set -g focus-events on         # needed for click-to-return
  ```

- A terminal supporting OSC desktop notifications (Ghostty, Kitty, WezTerm, iTerm2, Windows Terminal, foot, …)
- macOS: notification permission granted to your terminal

Outside tmux you still get notifications and the terminal's native click-to-focus, without pane-precise return.

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

Works out of the box — notifies when `pi` finishes all work (including retries and follow-ups) and is waiting for your input.

```
/pi-tmux-notify              # toggle on/off
/pi-tmux-notify on|off       # explicit toggle
/pi-tmux-notify osc777|osc99|osc9|auto   # force a protocol
/pi-tmux-notify test         # fire a test notification
```

## Limitations

- OSC clicks carry no identity, so with multiple pending pi instances any click returns to the **most recent** notifier. Exact with a single instance.
- The pane-return triggers on the terminal's next focus-in — refocusing without clicking also jumps (once; typing into pi first cancels it).
- Terminals usually suppress notifications while the emitting surface is focused.

