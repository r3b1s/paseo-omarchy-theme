import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OmarchyThemeStatus, ThemePalette } from "../shared/omarchy";

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

const PALETTE_KEYS = [
  "background",
  "foreground",
  "accent",
  "muted",
  "selection",
  "dark_background",
  "lighter_background",
  "dark_foreground",
] as const;

export function stateDirectory(): string {
  const stateHome = process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state");
  return path.join(stateHome, "omarchy", "current");
}

function parseColorsToml(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("[")) continue;
    const match = /^([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const quoted = /^"([^"]*)"\s*(?:#.*)?$/.exec(rawValue);
    if (quoted) {
      values[key] = quoted[1];
      continue;
    }
    const bare = /^([^\s#]+)/.exec(rawValue);
    if (bare) values[key] = bare[1];
  }
  return values;
}

function buildPalette(values: Record<string, string>): ThemePalette | null {
  const pick = (key: string): string | null => {
    const value = values[key];
    return typeof value === "string" && HEX_COLOR.test(value) ? value : null;
  };
  const [background, foreground, accent, muted, selection, darkBackground, lighterBackground, darkForeground] =
    PALETTE_KEYS.map(pick);
  if (!background || !foreground || !accent || !muted || !selection || !darkBackground || !lighterBackground || !darkForeground) {
    return null;
  }
  return {
    background,
    foreground,
    raised: lighterBackground,
    control: lighterBackground,
    border: muted,
    accent,
    mutedForeground: darkForeground,
    ring: muted,
    sidebar: darkBackground,
    sidebarHover: lighterBackground,
    sidebarSelected: selection,
    surface3: lighterBackground,
    surface4: muted,
    foregroundExtraMuted: darkForeground,
  };
}

function unavailableStatus(error: string): OmarchyThemeStatus {
  return {
    available: false,
    themeName: null,
    generation: null,
    syncedAt: new Date().toISOString(),
    appearance: null,
    colors: null,
    error,
  };
}

export function readOmarchyThemeStatus(): OmarchyThemeStatus {
  const dir = stateDirectory();
  try {
    const themeName = fs.readFileSync(path.join(dir, "theme.name"), "utf8").trim();
    if (!themeName) return unavailableStatus("Omarchy theme name file is empty");
    let generation: string | null = null;
    try {
      generation = fs.readFileSync(path.join(dir, "theme.generation"), "utf8").trim() || null;
    } catch {
      generation = null;
    }
    const values = parseColorsToml(fs.readFileSync(path.join(dir, "theme", "colors.toml"), "utf8"));
    const palette = buildPalette(values);
    if (!palette) return unavailableStatus(`Theme "${themeName}" has no readable colors.toml palette`);
    return {
      available: true,
      themeName,
      generation,
      syncedAt: new Date().toISOString(),
      appearance: values.mode === "light" ? "light" : "dark",
      colors: palette,
      error: null,
    };
  } catch {
    return unavailableStatus("Omarchy state not found on this host");
  }
}

function statusSignature(status: OmarchyThemeStatus): string {
  return JSON.stringify([status.available, status.themeName, status.generation, status.appearance, status.colors]);
}

export class OmarchyThemeWatcher {
  private status: OmarchyThemeStatus = unavailableStatus("Not read yet");
  private listeners = new Set<(status: OmarchyThemeStatus) => void>();
  private fsWatcher: fs.FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  current(): OmarchyThemeStatus {
    return this.status;
  }

  onChange(listener: (status: OmarchyThemeStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    this.refresh();
    this.watch();
    this.pollTimer = setInterval(() => {
      this.watch();
      this.refresh();
    }, 30_000);
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.fsWatcher?.close();
    this.pollTimer = null;
    this.debounceTimer = null;
    this.fsWatcher = null;
    this.listeners.clear();
  }

  private watch(): void {
    if (this.fsWatcher) return;
    try {
      const watcher = fs.watch(stateDirectory(), { recursive: true }, () => this.scheduleRefresh());
      watcher.on("error", () => watcher.close());
      watcher.on("close", () => {
        this.fsWatcher = null;
      });
      this.fsWatcher = watcher;
    } catch {
      this.fsWatcher = null;
    }
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.refresh();
    }, 250);
  }

  private refresh(): void {
    const next = readOmarchyThemeStatus();
    const changed = statusSignature(next) !== statusSignature(this.status);
    this.status = next;
    if (!changed) return;
    if (next.available) {
      console.log(`Omarchy theme synced: ${next.themeName}${next.generation ? ` (generation ${next.generation})` : ""}`);
    } else {
      console.log(`Omarchy theme unavailable: ${next.error ?? "unknown reason"}`);
    }
    for (const listener of this.listeners) listener(next);
  }
}
