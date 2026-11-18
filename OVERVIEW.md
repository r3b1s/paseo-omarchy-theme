Omarchy Theme adds a Paseo theme named Omarchy that mirrors the active theme of the Omarchy desktop on the daemon host. When the desktop theme changes, the Paseo theme follows automatically, including light and dark appearance.

The plugin's daemon process watches Omarchy's theme state under the XDG state directory, reads the current theme name, generation counter, and staged colors file, and pushes palette updates to connected apps. The theme appears under Settings, Appearance; each device selects it independently, so devices that keep a built-in theme are unaffected.

Install the plugin on a daemon that runs Omarchy. On hosts without Omarchy the plugin loads without contributing a theme. It only reads local Omarchy state files, writes nothing, and sends nothing off the machine. A small settings screen shows the synced theme name, generation, and last sync time.

## Using with remote daemons

If your main workspaces and sessions run on a remote daemon, install the plugin on a local (`localhost`) Paseo daemon on your Omarchy desktop and keep that host connected in Paseo. The local daemon supplies your desktop's Omarchy theme to the client even while you work on remote hosts.

## Contrast modes

Omarchy themes vary widely, and different users prefer different trade-offs between visual softness and strict contrast guarantees. Settings, Omarchy theme lets you choose between three deterministic palette modes:

- Balanced (default): keeps primary text at 4.5:1 or higher while softening card borders into subtle hairlines, stepping nested surfaces smoothly, and preserving a clear visual hierarchy across muted text and accents.
- Faithful: preserves Omarchy's authored `colors.toml` tokens as closely as possible, intervening only to fix missing keys, inverted polarity, collapsed surfaces, or unreadable primary text.
- WCAG 2.2 AA: checks every token against WCAG 2.2 Level AA contrast thresholds and adjusts any that fall short—bringing text, muted text, and accents to at least 4.5:1 and borders and focus rings to at least 3:1.

The same deterministic rules apply to every theme, built-in or custom, with no per-theme tuning. The settings screen shows the active mode, contrast summary, synced theme name, generation, and last sync time.
