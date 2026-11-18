# Omarchy Theme for Paseo

![Omarchy](assets/thumbnail.png)

A [Paseo](https://paseo.sh) plugin that adds a theme named **Omarchy**, which follows the active theme of the [Omarchy](https://omarchy.org) desktop on the daemon host. Switch your desktop theme and Paseo switches with it, including light and dark appearance.

| Tokyo Night | Catppuccin Latte |
| --- | --- |
| ![Tokyo Night](assets/screenshots/tokyo-night.png) | ![Catppuccin Latte](assets/screenshots/catppuccin-latte.png) |
| **Everforest** | **Rose Pine** |
| ![Everforest](assets/screenshots/everforest.png) | ![Rose Pine](assets/screenshots/rose-pine.png) |

More screenshots: [Ristretto](assets/screenshots/ristretto.png), [Ethereal](assets/screenshots/ethereal.png), [Jade Horse](assets/screenshots/jade-horse.png), and the [settings screen](assets/screenshots/settings-lumon.png) (Lumon).

## Features

- **Live sync.** The daemon watches Omarchy's theme state and pushes the new palette to every connected app as soon as the desktop theme changes.
- **Three contrast modes.** Choose between **Balanced** (default, with smooth hairline borders and tiered surfaces aligned with Paseo's built-in themes), **Faithful** (preserving Omarchy's `colors.toml` tokens with minimal guardrails), and **WCAG 2.2 AA** (enforcing >= 4.5:1 text/accents and >= 3:1 borders/focus rings).
- **Per-device choice.** The theme appears under Settings → Appearance. Each device selects it independently, so devices that keep a built-in theme are unaffected.
- **Settings & status screen.** Settings → Omarchy theme lets you switch contrast mode and shows the synced theme name, generation, last sync time, and contrast diagnostics.

## Requirements

- Paseo 0.16.1 or later
- A Paseo daemon running on an Omarchy host. On hosts without Omarchy the plugin loads but contributes no theme.

## Installation

Plugins must be enabled first, in Settings → Plugins.

Install from GitHub:

```sh
paseo plugin add github:r3b1s/paseo-omarchy-theme
```

Or paste `github:r3b1s/paseo-omarchy-theme` into Settings → Plugins → Plugin source.

Then open Settings → Appearance and select **Omarchy**.

## Using with remote daemons

Because the plugin reads Omarchy's theme state from the daemon host, install it on a local (`localhost`) Paseo daemon on your Omarchy desktop if you want Paseo to follow your local desktop theme—even when your main workspaces and sessions run on a remote daemon. As long as that local host stays connected in Paseo alongside your remote hosts, the **Omarchy** theme will stay synced with your local desktop.

## Privacy

The plugin only reads these files under `$XDG_STATE_HOME/omarchy/current` (default `~/.local/state/omarchy/current`):

- `theme.name`
- `theme.generation`
- `theme/colors.toml`

It watches that directory for changes and re-reads it every 30 seconds as a fallback. It writes no files, runs no external commands and makes no network requests.

## Development

```sh
npm install
npm run typecheck
npm test
```

To try local changes, install the working copy on a daemon host:

```sh
paseo plugin add /path/to/paseo-omarchy-theme
```

## License

[MIT](LICENSE)
