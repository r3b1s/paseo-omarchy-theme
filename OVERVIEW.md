Omarchy Theme adds a Paseo theme named Omarchy that mirrors the active theme of the Omarchy desktop on the daemon host. When the desktop theme changes, the Paseo theme follows automatically, including light and dark appearance.

The plugin's daemon process watches Omarchy's theme state under the XDG state directory, reads the current theme name, generation counter, and staged colors file, and pushes palette updates to connected apps. The theme appears under Settings, Appearance; each device selects it independently, so devices that keep a built-in theme are unaffected.

Install the plugin on a daemon that runs Omarchy. On hosts without Omarchy the plugin loads without contributing a theme. It only reads local Omarchy state files and sends nothing off the machine. A small settings screen shows the synced theme name, generation, and last sync time.
