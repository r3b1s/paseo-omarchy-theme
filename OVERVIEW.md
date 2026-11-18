Omarchy Theme adds a Paseo theme named Omarchy that mirrors the active theme of the Omarchy desktop on the daemon host. When the desktop theme changes, the Paseo theme follows automatically, including light and dark appearance.

The plugin's daemon process watches Omarchy's theme state under the XDG state directory, reads the current theme name, generation counter, and staged colors file, and pushes palette updates to connected apps. The theme appears under Settings, Appearance; each device selects it independently, so devices that keep a built-in theme are unaffected.

Install the plugin on a daemon that runs Omarchy. On hosts without Omarchy the plugin loads without contributing a theme. It only reads local Omarchy state files, writes nothing, and sends nothing off the machine. A small settings screen shows the synced theme name, generation, and last sync time.

## Using with remote daemons

If your main workspaces and sessions run on a remote daemon, install the plugin on a local (`localhost`) Paseo daemon on your Omarchy desktop and keep that host connected in Paseo. The local daemon supplies your desktop's Omarchy theme to the client even while you work on remote hosts.

## Consistent contrast across themes

Omarchy themes vary widely, and a palette that looks right on the desktop can leave text or controls hard to read in Paseo. Before a palette reaches the app, the plugin checks it against the WCAG 2.2 Level AA contrast thresholds and adjusts only the colors that fall short. Text, muted text, and accent colors are brought to at least 4.5:1 against every surface they appear on, and borders and focus rings to at least 3:1. Missing secondary colors are derived from the theme's background and foreground, and surfaces that collapse into one another or contradict the theme's light or dark appearance are corrected.

The same rules apply to every theme, built-in or custom, with no per-theme tuning, so the reading experience stays consistent whichever Omarchy theme is active. The settings screen shows whether the active theme passed as-is or how many colors were adjusted, along with the lowest text contrast ratio.
