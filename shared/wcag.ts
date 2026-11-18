export interface ThemePalette {
  background: string;
  foreground: string;
  raised: string;
  control: string;
  border: string;
  accent: string;
  mutedForeground: string;
  ring: string;
  sidebar: string;
  sidebarHover: string;
  sidebarSelected: string;
  surface3: string;
  surface4: string;
  foregroundExtraMuted: string;
}

export function parseColorsToml(content: string): Record<string, string> {
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

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export type ContrastMode = "balanced" | "faithful" | "wcag-aa";

export const DEFAULT_CONTRAST_MODE: ContrastMode = "balanced";

export interface WcagDiagnostics {
  level: "balanced" | "faithful" | "AA";
  adjustedTokens: string[];
  minTextContrast: number;
  minUiContrast: number;
  minPrimaryTextContrast?: number;
  minBorderContrast?: number;
}

export interface SolvedPalette {
  mode: ContrastMode;
  appearance: "light" | "dark";
  colors: ThemePalette;
  wcag: WcagDiagnostics;
}

export const TEXT_CONTRAST_AA = 4.5;
export const UI_CONTRAST_AA = 3.0;

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toHexByte(channel01: number): string {
  const byte = Math.round(clamp01(channel01) * 255);
  return byte.toString(16).padStart(2, "0");
}

export function rgbToHex(rgb: Rgb): string {
  return `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}`;
}

export function parseHexRgb(raw: string, backdrop: Rgb = { r: 0, g: 0, b: 0 }): Rgb | null {
  const trimmed = raw.trim();
  const match = HEX_PATTERN.exec(trimmed);
  if (!match) return null;
  const digits = match[1];

  let r8: number;
  let g8: number;
  let b8: number;
  let a8 = 255;

  if (digits.length === 3 || digits.length === 4) {
    r8 = Number.parseInt(digits[0] + digits[0], 16);
    g8 = Number.parseInt(digits[1] + digits[1], 16);
    b8 = Number.parseInt(digits[2] + digits[2], 16);
    if (digits.length === 4) {
      a8 = Number.parseInt(digits[3] + digits[3], 16);
    }
  } else {
    r8 = Number.parseInt(digits.slice(0, 2), 16);
    g8 = Number.parseInt(digits.slice(2, 4), 16);
    b8 = Number.parseInt(digits.slice(4, 6), 16);
    if (digits.length === 8) {
      a8 = Number.parseInt(digits.slice(6, 8), 16);
    }
  }

  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  if (a8 >= 255) return { r, g, b };

  const alpha = a8 / 255;
  return {
    r: r * alpha + backdrop.r * (1 - alpha),
    g: g * alpha + backdrop.g * (1 - alpha),
    b: b * alpha + backdrop.b * (1 - alpha),
  };
}

export function normalizeHexColor(raw: string, backdrop?: Rgb): string | null {
  const rgb = parseHexRgb(raw, backdrop);
  return rgb ? rgbToHex(rgb) : null;
}

function srgbChannelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(c: number): number {
  const clamped = clamp01(c);
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

export function relativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0;
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function minContrastAgainst(color: string, surfaces: readonly string[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const surface of surfaces) {
    const ratio = contrastRatio(color, surface);
    if (ratio < min) min = ratio;
  }
  return min;
}

function rgbToOklab(rgb: Rgb): { l: number; a: number; b: number } {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    l: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

function oklabToLinearRgb(l: number, a: number, b: number): Rgb {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3,
  };
}

function isInLinearGamut(rgb: Rgb): boolean {
  const eps = 1e-6;
  return rgb.r >= -eps && rgb.r <= 1 + eps && rgb.g >= -eps && rgb.g <= 1 + eps && rgb.b >= -eps && rgb.b <= 1 + eps;
}

export function hexToOklch(hex: string): Oklch {
  const rgb = parseHexRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const lab = rgbToOklab(rgb);
  const c = Math.hypot(lab.a, lab.b);
  const h = c < 1e-6 ? 0 : Math.atan2(lab.b, lab.a);
  return { l: lab.l, c: c < 1e-6 ? 0 : c, h };
}

export function oklchToHex(oklch: Oklch): string {
  const l = clamp01(oklch.l);
  if (l <= 0) return "#000000";
  if (l >= 1) return "#ffffff";

  const targetC = Math.max(0, oklch.c);
  const cosH = Math.cos(oklch.h);
  const sinH = Math.sin(oklch.h);

  const direct = oklabToLinearRgb(l, targetC * cosH, targetC * sinH);
  let inGamut = direct;

  if (!isInLinearGamut(direct)) {
    let lo = 0;
    let hi = targetC;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) * 0.5;
      const candidate = oklabToLinearRgb(l, mid * cosH, mid * sinH);
      if (isInLinearGamut(candidate)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    inGamut = oklabToLinearRgb(l, lo * cosH, lo * sinH);
  }

  return rgbToHex({
    r: linearChannelToSrgb(inGamut.r),
    g: linearChannelToSrgb(inGamut.g),
    b: linearChannelToSrgb(inGamut.b),
  });
}

function mixOklabHex(hexA: string, hexB: string, t: number): string {
  const labA = rgbToOklab(parseHexRgb(hexA) ?? { r: 0, g: 0, b: 0 });
  const labB = rgbToOklab(parseHexRgb(hexB) ?? { r: 0, g: 0, b: 0 });
  const w = clamp01(t);
  const l = labA.l * (1 - w) + labB.l * w;
  const a = labA.a * (1 - w) + labB.a * w;
  const b = labA.b * (1 - w) + labB.b * w;
  const c = Math.hypot(a, b);
  const h = c < 1e-6 ? 0 : Math.atan2(b, a);
  return oklchToHex({ l, c, h });
}

export function detectAppearance(bgHex: string, fgHex: string, declaredMode?: string): "light" | "dark" {
  const bgLum = relativeLuminance(bgHex);
  if (bgLum > 0.22) return "light";
  if (bgLum < 0.14) return "dark";
  const fgLum = relativeLuminance(fgHex);
  if (Math.abs(fgLum - bgLum) > 0.02) {
    return fgLum < bgLum ? "light" : "dark";
  }
  return declaredMode === "light" ? "light" : "dark";
}

function searchLightness(
  base: Oklch,
  surfaces: readonly string[],
  minRatio: number,
  direction: "lighter" | "darker",
): string | null {
  const poleHex = direction === "lighter" ? "#ffffff" : "#000000";
  if (minContrastAgainst(poleHex, surfaces) < minRatio) {
    return null;
  }

  let lo = direction === "lighter" ? base.l : 0;
  let hi = direction === "lighter" ? 1 : base.l;

  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) * 0.5;
    const candidate = oklchToHex({ l: mid, c: base.c, h: base.h });
    const passes = minContrastAgainst(candidate, surfaces) >= minRatio;
    if (direction === "lighter") {
      if (passes) hi = mid;
      else lo = mid;
    } else {
      if (passes) lo = mid;
      else hi = mid;
    }
  }

  const boundary = direction === "lighter" ? hi : lo;
  let resolved = oklchToHex({ l: boundary, c: base.c, h: base.h });
  if (minContrastAgainst(resolved, surfaces) >= minRatio) {
    return resolved;
  }

  // Step past 8-bit sRGB quantization rounding edges if needed.
  const step = direction === "lighter" ? 0.0025 : -0.0025;
  for (let i = 1; i <= 24; i++) {
    const candidate = oklchToHex({ l: clamp01(boundary + step * i), c: base.c, h: base.h });
    if (minContrastAgainst(candidate, surfaces) >= minRatio) {
      return candidate;
    }
  }

  return poleHex;
}

export function adjustColorForContrast(
  baseHex: string,
  surfaces: readonly string[],
  minRatio: number,
  preferDirection: "lighter" | "darker",
): string {
  if (surfaces.length === 0 || minContrastAgainst(baseHex, surfaces) >= minRatio) {
    return baseHex;
  }

  const base = hexToOklch(baseHex);
  const altDirection = preferDirection === "lighter" ? "darker" : "lighter";

  const preferred = searchLightness(base, surfaces, minRatio, preferDirection);
  if (preferred) return preferred;

  const fallback = searchLightness(base, surfaces, minRatio, altDirection);
  if (fallback) return fallback;

  const whiteMin = minContrastAgainst("#ffffff", surfaces);
  const blackMin = minContrastAgainst("#000000", surfaces);
  return whiteMin >= blackMin ? "#ffffff" : "#000000";
}

function surfaceBounds(bgL: number, isDark: boolean): { minL: number; maxL: number } {
  if (isDark) {
    return {
      minL: 0.0,
      maxL: Math.min(0.44, Math.max(0.36, bgL + 0.11)),
    };
  }
  return {
    minL: Math.max(0.75, Math.min(0.84, bgL - 0.14)),
    maxL: 1.0,
  };
}

function clampSurfaceOklch(hex: string, bounds: { minL: number; maxL: number }): string {
  const lch = hexToOklch(hex);
  const clampedL = Math.min(bounds.maxL, Math.max(bounds.minL, lch.l));
  if (clampedL === lch.l) return hex;
  return oklchToHex({ l: clampedL, c: lch.c, h: lch.h });
}

function nudgeSurfaceAway(
  baseHex: string,
  anchors: readonly { hex: string; minDeltaL: number }[],
  bounds: { minL: number; maxL: number },
  preferredOffset: number,
): string {
  const lch = hexToOklch(baseHex);
  const { minL, maxL } = bounds;

  const isSeparated = (candidateL: number): boolean =>
    anchors.every((anchor) => {
      const anchorL = hexToOklch(anchor.hex).l;
      return Math.abs(candidateL - anchorL) >= anchor.minDeltaL;
    });

  if (isSeparated(lch.l)) return baseHex;

  // Try preferred direction first, then opposite direction within safe polarity bounds.
  const tryDirection = (sign: number): number | null => {
    for (let step = 1; step <= 20; step++) {
      const candidateL = lch.l + sign * step * 0.015;
      if (candidateL < minL || candidateL > maxL) break;
      if (isSeparated(candidateL)) return candidateL;
    }
    return null;
  };

  const primarySign = preferredOffset >= 0 ? 1 : -1;
  const foundL = tryDirection(primarySign) ?? tryDirection(-primarySign);
  if (foundL !== null) {
    return oklchToHex({ l: foundL, c: lch.c, h: lch.h });
  }

  // As a last resort, push toward the furthest safe bound.
  const fallbackL = Math.abs(maxL - lch.l) >= Math.abs(lch.l - minL) ? maxL : minL;
  return oklchToHex({ l: fallbackL, c: lch.c, h: lch.h });
}

function shiftSurfaceOklch(hex: string, deltaL: number, bounds: { minL: number; maxL: number }): string {
  const lch = hexToOklch(hex);
  const shiftedL = Math.min(bounds.maxL, Math.max(bounds.minL, lch.l + deltaL));
  return oklchToHex({ l: shiftedL, c: lch.c, h: lch.h });
}

function softenBorderContrast(
  seedHex: string,
  anchorSurface: string,
  uiSurfaces: readonly string[],
  maxRatio: number,
  targetRatio: number,
  minFloor: number,
  direction: "lighter" | "darker",
): string {
  let candidate = adjustColorForContrast(seedHex, uiSurfaces, minFloor, direction);
  if (contrastRatio(candidate, anchorSurface) <= maxRatio) {
    return candidate;
  }

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) * 0.5;
    const mixed = mixOklabHex(anchorSurface, candidate, mid);
    if (contrastRatio(mixed, anchorSurface) >= targetRatio) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const softened = mixOklabHex(anchorSurface, candidate, hi);
  if (minContrastAgainst(softened, uiSurfaces) >= minFloor) {
    return softened;
  }
  return adjustColorForContrast(softened, uiSurfaces, minFloor, direction);
}

interface ModeProfile {
  level: WcagDiagnostics["level"];
  sidebarDelta: number;
  raisedDelta: number;
  hoverDelta: number;
  selectedSidebarDelta: number;
  selectedHoverDelta: number;
  surface3Delta: number;
  surface3BgDelta: number;
  surface4Delta: number;
  surface4RaisedDelta: number;
  stepSurfacesFromRaised: boolean;
  foregroundMin: number;
  mutedMin: number;
  mutedSeedLightMin: number;
  mutedSeedDarkMin: number;
  mutedSeedMix: number;
  capMutedCeiling: boolean;
  extraMutedMin: number;
  extraMutedMix: number;
  borderMin: number;
  borderMaxAgainstRaised: number | null;
  borderTargetAgainstRaised: number;
  accentMin: number;
  ringMin: number;
}

const MODE_PROFILES: Record<ContrastMode, ModeProfile> = {
  balanced: {
    level: "balanced",
    sidebarDelta: 0.015,
    raisedDelta: 0.018,
    hoverDelta: 0.015,
    selectedSidebarDelta: 0.03,
    selectedHoverDelta: 0.02,
    surface3Delta: 0.016,
    surface3BgDelta: 0.03,
    surface4Delta: 0.016,
    surface4RaisedDelta: 0.03,
    stepSurfacesFromRaised: true,
    foregroundMin: TEXT_CONTRAST_AA,
    mutedMin: 3.2,
    mutedSeedLightMin: 3.2,
    mutedSeedDarkMin: 3.2,
    mutedSeedMix: 0.35,
    capMutedCeiling: true,
    extraMutedMin: 2.2,
    extraMutedMix: 0.32,
    borderMin: 1.22,
    borderMaxAgainstRaised: 1.6,
    borderTargetAgainstRaised: 1.42,
    accentMin: 3.0,
    ringMin: 2.5,
  },
  faithful: {
    level: "faithful",
    sidebarDelta: 0.008,
    raisedDelta: 0.008,
    hoverDelta: 0.008,
    selectedSidebarDelta: 0.012,
    selectedHoverDelta: 0.01,
    surface3Delta: 0.014,
    surface3BgDelta: 0.022,
    surface4Delta: 0.012,
    surface4RaisedDelta: 0.02,
    stepSurfacesFromRaised: false,
    foregroundMin: 3.0,
    mutedMin: 2.2,
    mutedSeedLightMin: 2.2,
    mutedSeedDarkMin: 2.2,
    mutedSeedMix: 0.35,
    capMutedCeiling: false,
    extraMutedMin: 1.5,
    extraMutedMix: 0.32,
    borderMin: 1.15,
    borderMaxAgainstRaised: null,
    borderTargetAgainstRaised: 1.42,
    accentMin: 2.5,
    ringMin: 2.0,
  },
  "wcag-aa": {
    level: "AA",
    sidebarDelta: 0.025,
    raisedDelta: 0.03,
    hoverDelta: 0.03,
    selectedSidebarDelta: 0.06,
    selectedHoverDelta: 0.04,
    surface3Delta: 0.025,
    surface3BgDelta: 0.045,
    surface4Delta: 0.025,
    surface4RaisedDelta: 0.04,
    stepSurfacesFromRaised: false,
    foregroundMin: TEXT_CONTRAST_AA,
    mutedMin: TEXT_CONTRAST_AA,
    mutedSeedLightMin: 4.0,
    mutedSeedDarkMin: 3.0,
    mutedSeedMix: 0.28,
    capMutedCeiling: false,
    extraMutedMin: TEXT_CONTRAST_AA,
    extraMutedMix: 0.25,
    borderMin: UI_CONTRAST_AA,
    borderMaxAgainstRaised: null,
    borderTargetAgainstRaised: UI_CONTRAST_AA,
    accentMin: TEXT_CONTRAST_AA,
    ringMin: UI_CONTRAST_AA,
  },
};

function chooseMutedForegroundSeed(
  foregroundHex: string,
  backgroundHex: string,
  rawLightForeground: string | null,
  rawDarkForeground: string | null,
  profile: ModeProfile,
): string {
  const fgContrast = contrastRatio(foregroundHex, backgroundHex);

  if (rawLightForeground) {
    const lightContrast = contrastRatio(rawLightForeground, backgroundHex);
    const distinctFromFg = lightContrast <= fgContrast * 0.88 && rawLightForeground !== foregroundHex;
    if (distinctFromFg && lightContrast >= profile.mutedSeedLightMin) {
      return rawLightForeground;
    }
  }

  if (rawDarkForeground && rawDarkForeground !== foregroundHex) {
    const darkContrast = contrastRatio(rawDarkForeground, backgroundHex);
    if (darkContrast >= profile.mutedSeedDarkMin && darkContrast < fgContrast * 0.9) {
      return rawDarkForeground;
    }
  }

  return mixOklabHex(foregroundHex, backgroundHex, profile.mutedSeedMix);
}

export function solveOmarchyPalette(
  values: Record<string, string>,
  mode: ContrastMode = DEFAULT_CONTRAST_MODE,
): SolvedPalette | null {
  const rawBackgroundRaw = typeof values.background === "string" ? normalizeHexColor(values.background) : null;
  const rawForegroundRaw =
    typeof values.foreground === "string" && rawBackgroundRaw
      ? normalizeHexColor(values.foreground, parseHexRgb(rawBackgroundRaw) ?? undefined)
      : null;

  if (!rawBackgroundRaw || !rawForegroundRaw) {
    return null;
  }

  const profile = MODE_PROFILES[mode] ?? MODE_PROFILES[DEFAULT_CONTRAST_MODE];
  const bgRgb = parseHexRgb(rawBackgroundRaw) ?? { r: 0, g: 0, b: 0 };
  const pick = (key: string): string | null => {
    const raw = values[key];
    return typeof raw === "string" ? normalizeHexColor(raw, bgRgb) : null;
  };

  const appearance = detectAppearance(rawBackgroundRaw, rawForegroundRaw, values.mode);
  const isDark = appearance === "dark";
  const textDirection: "lighter" | "darker" = isDark ? "lighter" : "darker";
  const surfaceOffset = isDark ? 1 : -1;

  const background = rawBackgroundRaw;
  const bgOklch = hexToOklch(background);

  const rawDarkBg = pick("dark_background");
  const rawLighterBg = pick("lighter_background");
  const rawSelection = pick("selection");
  const rawMuted = pick("muted");
  const rawAccent = pick("accent");
  const rawDarkFg = pick("dark_foreground");
  const rawLightFg = pick("light_foreground");

  // Synthesize missing inputs deterministically in OKLCH.
  const seedDarkBg =
    rawDarkBg ??
    oklchToHex({
      l: clamp01(isDark ? Math.max(0, bgOklch.l - 0.04) : bgOklch.l - 0.03),
      c: bgOklch.c,
      h: bgOklch.h,
    });
  const seedLighterBg =
    rawLighterBg ??
    oklchToHex({
      l: clamp01(isDark ? bgOklch.l + 0.045 : bgOklch.l - 0.04),
      c: bgOklch.c,
      h: bgOklch.h,
    });
  const seedSelection =
    rawSelection ??
    oklchToHex({
      l: clamp01(isDark ? bgOklch.l + 0.1 : bgOklch.l - 0.1),
      c: bgOklch.c,
      h: bgOklch.h,
    });
  const seedMuted = rawMuted ?? mixOklabHex(rawForegroundRaw, background, 0.55);
  const seedAccent = rawAccent ?? rawForegroundRaw;

  // Normalize surfaces within polarity bounds and separate collapsed adjacent states.
  const bounds = surfaceBounds(bgOklch.l, isDark);

  const sidebar = nudgeSurfaceAway(
    clampSurfaceOklch(seedDarkBg, bounds),
    [{ hex: background, minDeltaL: profile.sidebarDelta }],
    bounds,
    -1,
  );

  const raised = nudgeSurfaceAway(
    clampSurfaceOklch(seedLighterBg, bounds),
    [{ hex: background, minDeltaL: profile.raisedDelta }],
    bounds,
    surfaceOffset,
  );

  const control = raised;

  const sidebarHover = nudgeSurfaceAway(
    clampSurfaceOklch(seedLighterBg, bounds),
    [{ hex: sidebar, minDeltaL: profile.hoverDelta }],
    bounds,
    surfaceOffset,
  );

  const sidebarSelected = nudgeSurfaceAway(
    clampSurfaceOklch(seedSelection, bounds),
    [
      { hex: sidebar, minDeltaL: profile.selectedSidebarDelta },
      { hex: sidebarHover, minDeltaL: profile.selectedHoverDelta },
    ],
    bounds,
    surfaceOffset,
  );

  const surface3Seed = profile.stepSurfacesFromRaised
    ? shiftSurfaceOklch(raised, surfaceOffset * profile.surface3Delta, bounds)
    : raised;
  const surface3 = nudgeSurfaceAway(
    surface3Seed,
    [
      { hex: raised, minDeltaL: profile.surface3Delta },
      { hex: background, minDeltaL: profile.surface3BgDelta },
    ],
    bounds,
    surfaceOffset,
  );

  const surface4Seed = profile.stepSurfacesFromRaised
    ? shiftSurfaceOklch(surface3, surfaceOffset * profile.surface4Delta, bounds)
    : clampSurfaceOklch(rawMuted ?? seedSelection, bounds);
  const surface4 = nudgeSurfaceAway(
    surface4Seed,
    [
      { hex: surface3, minDeltaL: profile.surface4Delta },
      { hex: raised, minDeltaL: profile.surface4RaisedDelta },
    ],
    bounds,
    surfaceOffset,
  );

  const allSurfaces = [background, raised, control, sidebar, sidebarHover, sidebarSelected, surface3, surface4];

  // Solve text tokens according to the active contrast profile.
  const foreground = adjustColorForContrast(rawForegroundRaw, allSurfaces, profile.foregroundMin, textDirection);

  const fgMinContrast = minContrastAgainst(foreground, allSurfaces);
  const mutedSeed = chooseMutedForegroundSeed(foreground, background, rawLightFg, rawDarkFg, profile);
  const mutedTarget =
    mode === "wcag-aa" && fgMinContrast >= 6.5
      ? Math.min(5.5, Math.max(TEXT_CONTRAST_AA, fgMinContrast - 1.2))
      : profile.mutedMin;
  let mutedForeground = adjustColorForContrast(mutedSeed, allSurfaces, mutedTarget, textDirection);
  if (minContrastAgainst(mutedForeground, allSurfaces) < profile.mutedMin) {
    mutedForeground = adjustColorForContrast(mutedForeground, allSurfaces, profile.mutedMin, textDirection);
  }
  if (profile.capMutedCeiling && fgMinContrast >= 5.0) {
    const mutedContrast = contrastRatio(mutedForeground, background);
    const fgBgContrast = contrastRatio(foreground, background);
    if (mutedContrast > fgBgContrast * 0.78) {
      mutedForeground = adjustColorForContrast(
        mixOklabHex(foreground, background, 0.38),
        allSurfaces,
        profile.mutedMin,
        textDirection,
      );
    }
  }

  const mutedBgContrast = contrastRatio(mutedForeground, background);
  const useRawDarkForExtra =
    rawDarkFg !== null &&
    (mode === "wcag-aa" || contrastRatio(rawDarkFg, background) < mutedBgContrast * 0.95);
  const extraMutedSeed = useRawDarkForExtra ? rawDarkFg : mixOklabHex(mutedForeground, background, profile.extraMutedMix);
  const foregroundExtraMuted = adjustColorForContrast(
    extraMutedSeed,
    allSurfaces,
    profile.extraMutedMin,
    textDirection,
  );

  // Solve border against UI surfaces (soft hairline in balanced, raw in faithful, 3.0:1 in wcag-aa).
  const uiSurfaces = [background, raised, control, sidebar, surface3];
  const border =
    profile.borderMaxAgainstRaised !== null
      ? softenBorderContrast(
          seedMuted,
          raised,
          uiSurfaces,
          profile.borderMaxAgainstRaised,
          profile.borderTargetAgainstRaised,
          profile.borderMin,
          textDirection,
        )
      : adjustColorForContrast(seedMuted, uiSurfaces, profile.borderMin, textDirection);

  // Solve accent and focus ring.
  const accentSurfaces = [background, raised, control, sidebar, sidebarSelected];
  const accent = adjustColorForContrast(seedAccent, accentSurfaces, profile.accentMin, textDirection);
  const ring = adjustColorForContrast(accent, allSurfaces, profile.ringMin, textDirection);

  const colors: ThemePalette = {
    background,
    foreground,
    raised,
    control,
    border,
    accent,
    mutedForeground,
    ring,
    sidebar,
    sidebarHover,
    sidebarSelected,
    surface3,
    surface4,
    foregroundExtraMuted,
  };

  // Compare against naive raw mapping to report adjusted tokens.
  const naiveMapping: Record<keyof ThemePalette, string | null> = {
    background: rawBackgroundRaw,
    foreground: rawForegroundRaw,
    raised: rawLighterBg,
    control: rawLighterBg,
    border: rawMuted,
    accent: rawAccent,
    mutedForeground: rawDarkFg,
    ring: rawMuted,
    sidebar: rawDarkBg,
    sidebarHover: rawLighterBg,
    sidebarSelected: rawSelection,
    surface3: rawLighterBg,
    surface4: rawMuted,
    foregroundExtraMuted: rawDarkFg,
  };

  const adjustedTokens = (Object.keys(colors) as (keyof ThemePalette)[]).filter(
    (key) => colors[key] !== naiveMapping[key],
  );

  const minPrimaryTextContrast = minContrastAgainst(foreground, allSurfaces);
  const minTextContrast = Math.min(
    minPrimaryTextContrast,
    minContrastAgainst(mutedForeground, allSurfaces),
    minContrastAgainst(foregroundExtraMuted, allSurfaces),
    minContrastAgainst(accent, accentSurfaces),
  );
  const minBorderContrast = minContrastAgainst(border, uiSurfaces);
  const minUiContrast = Math.min(
    minBorderContrast,
    minContrastAgainst(ring, allSurfaces),
  );

  return {
    mode,
    appearance,
    colors,
    wcag: {
      level: profile.level,
      adjustedTokens,
      minTextContrast: Math.round(minTextContrast * 100) / 100,
      minUiContrast: Math.round(minUiContrast * 100) / 100,
      minPrimaryTextContrast: Math.round(minPrimaryTextContrast * 100) / 100,
      minBorderContrast: Math.round(minBorderContrast * 100) / 100,
    },
  };
}
