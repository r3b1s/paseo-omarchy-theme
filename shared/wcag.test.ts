import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ContrastMode, ThemePalette } from "./wcag";
import {
  DEFAULT_CONTRAST_MODE,
  TEXT_CONTRAST_AA,
  UI_CONTRAST_AA,
  contrastRatio,
  detectAppearance,
  minContrastAgainst,
  normalizeHexColor,
  parseColorsToml,
  relativeLuminance,
  solveOmarchyPalette,
} from "./wcag";

function assertSurfacesSeparated(colors: ThemePalette, label: string): void {
  assert.notEqual(colors.raised, colors.background, `${label}: raised collapsed onto background`);
  assert.notEqual(colors.sidebar, colors.background, `${label}: sidebar collapsed onto background`);
  assert.notEqual(colors.sidebarHover, colors.sidebar, `${label}: sidebarHover collapsed onto sidebar`);
  assert.notEqual(colors.sidebarSelected, colors.sidebar, `${label}: sidebarSelected collapsed onto sidebar`);
  assert.notEqual(colors.sidebarSelected, colors.sidebarHover, `${label}: sidebarSelected collapsed onto sidebarHover`);
  assert.notEqual(colors.surface3, colors.raised, `${label}: surface3 collapsed onto raised`);
  assert.notEqual(colors.surface4, colors.surface3, `${label}: surface4 collapsed onto surface3`);
}

function assertPaletteMeetsMode(
  colors: ThemePalette,
  label: string,
  floors: {
    fg: number;
    muted: number;
    extraMuted: number;
    borderMin: number;
    borderMaxOnRaised?: number;
    accent: number;
    ring: number;
  },
): void {
  const allSurfaces = [
    colors.background,
    colors.raised,
    colors.control,
    colors.sidebar,
    colors.sidebarHover,
    colors.sidebarSelected,
    colors.surface3,
    colors.surface4,
  ];
  const uiSurfaces = [colors.background, colors.raised, colors.control, colors.sidebar, colors.surface3];
  const accentSurfaces = [colors.background, colors.raised, colors.control, colors.sidebar, colors.sidebarSelected];

  for (const surface of allSurfaces) {
    assert.ok(
      contrastRatio(colors.foreground, surface) >= floors.fg,
      `${label}: foreground (${colors.foreground}) on ${surface} < ${floors.fg}`,
    );
    assert.ok(
      contrastRatio(colors.mutedForeground, surface) >= floors.muted,
      `${label}: mutedForeground (${colors.mutedForeground}) on ${surface} < ${floors.muted}`,
    );
    assert.ok(
      contrastRatio(colors.foregroundExtraMuted, surface) >= floors.extraMuted,
      `${label}: foregroundExtraMuted (${colors.foregroundExtraMuted}) on ${surface} < ${floors.extraMuted}`,
    );
    assert.ok(
      contrastRatio(colors.ring, surface) >= floors.ring,
      `${label}: ring (${colors.ring}) on ${surface} < ${floors.ring}`,
    );
  }

  for (const surface of uiSurfaces) {
    assert.ok(
      contrastRatio(colors.border, surface) >= floors.borderMin,
      `${label}: border (${colors.border}) on ${surface} < ${floors.borderMin}`,
    );
  }

  if (floors.borderMaxOnRaised !== undefined) {
    const borderOnRaised = contrastRatio(colors.border, colors.raised);
    assert.ok(
      borderOnRaised <= floors.borderMaxOnRaised,
      `${label}: border (${colors.border}) on raised (${colors.raised}) = ${borderOnRaised.toFixed(2)} > ${floors.borderMaxOnRaised}`,
    );
  }

  for (const surface of accentSurfaces) {
    assert.ok(
      contrastRatio(colors.accent, surface) >= floors.accent,
      `${label}: accent (${colors.accent}) on ${surface} < ${floors.accent}`,
    );
  }

  assertSurfacesSeparated(colors, label);
}

function assertPaletteMeetsWcagAA(colors: ThemePalette, label: string): void {
  assertPaletteMeetsMode(colors, label, {
    fg: TEXT_CONTRAST_AA,
    muted: TEXT_CONTRAST_AA,
    extraMuted: TEXT_CONTRAST_AA,
    borderMin: UI_CONTRAST_AA,
    accent: TEXT_CONTRAST_AA,
    ring: UI_CONTRAST_AA,
  });
}

test("WCAG 2.2 luminance and contrast ratio match reference values", () => {
  assert.equal(relativeLuminance("#000000"), 0);
  assert.equal(relativeLuminance("#ffffff"), 1);
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#2d353b", "#2d353b"), 1);
  assert.ok(Math.abs(contrastRatio("#767676", "#ffffff") - 4.54) < 0.05);
});

test("normalizeHexColor expands short hex and composites alpha", () => {
  assert.equal(normalizeHexColor("#abc"), "#aabbcc");
  assert.equal(normalizeHexColor("#AABBCCFF"), "#aabbcc");
  assert.equal(normalizeHexColor("#ffffff80", { r: 0, g: 0, b: 0 }), "#808080");
  assert.equal(normalizeHexColor("not-a-color"), null);
});

test("detectAppearance determines polarity from luminance even when mode is omitted or wrong", () => {
  assert.equal(detectAppearance("#ffffff", "#000000", "dark"), "light");
  assert.equal(detectAppearance("#121212", "#eeeeee", "light"), "dark");
  assert.equal(detectAppearance("#2d353b", "#d3c6aa"), "dark");
  assert.equal(detectAppearance("#eff1f5", "#4c4f69"), "light");
});

test("solveOmarchyPalette defaults to balanced mode and synthesizes missing secondary keys", () => {
  const solved = solveOmarchyPalette({
    background: "#181a1f",
    foreground: "#e6e8ee",
  });
  assert.ok(solved);
  assert.equal(solved.mode, DEFAULT_CONTRAST_MODE);
  assert.equal(solved.mode, "balanced");
  assert.equal(solved.appearance, "dark");
  assertPaletteMeetsMode(solved.colors, "minimal-dark-balanced", {
    fg: 4.5,
    muted: 3.2,
    extraMuted: 2.2,
    borderMin: 1.22,
    borderMaxOnRaised: 1.65,
    accent: 3.0,
    ring: 2.5,
  });

  const wcagSolved = solveOmarchyPalette(
    {
      background: "#181a1f",
      foreground: "#e6e8ee",
    },
    "wcag-aa",
  );
  assert.ok(wcagSolved);
  assertPaletteMeetsWcagAA(wcagSolved.colors, "minimal-dark-wcag");
});

test("solveOmarchyPalette repairs collapsed surfaces, bright muted surface4, and low-contrast foregrounds", () => {
  const adversarial = {
    mode: "dark",
    background: "#0c0b0c",
    dark_background: "#0c0b0c",
    lighter_background: "#0c0b0c",
    selection: "#0c0b0c",
    muted: "#9aa0a6",
    accent: "#3a4552",
    foreground: "#6a7077",
    dark_foreground: "#2c3035",
  };

  const wcag = solveOmarchyPalette(adversarial, "wcag-aa");
  assert.ok(wcag);
  assert.equal(wcag.appearance, "dark");
  assertPaletteMeetsWcagAA(wcag.colors, "adversarial-collapsed-wcag");
  assert.ok(wcag.wcag.adjustedTokens.length > 0);
  assert.ok(wcag.wcag.minTextContrast >= TEXT_CONTRAST_AA);
  assert.ok(wcag.wcag.minUiContrast >= UI_CONTRAST_AA);

  const balanced = solveOmarchyPalette(adversarial, "balanced");
  assert.ok(balanced);
  assertPaletteMeetsMode(balanced.colors, "adversarial-collapsed-balanced", {
    fg: 4.5,
    muted: 3.2,
    extraMuted: 2.2,
    borderMin: 1.22,
    borderMaxOnRaised: 1.65,
    accent: 3.0,
    ring: 2.5,
  });
});

test("balanced mode softens harsh borders while faithful preserves authored tokens", () => {
  const everforest = {
    mode: "dark",
    accent: "#7fbbb3",
    selection: "#3d484d",
    muted: "#475258",
    background: "#2d353b",
    dark_background: "#21272c",
    lighter_background: "#343f44",
    foreground: "#d3c6aa",
    dark_foreground: "#4f585e",
    light_foreground: "#9da9a0",
  };

  const balanced = solveOmarchyPalette(everforest, "balanced");
  const faithful = solveOmarchyPalette(everforest, "faithful");
  const wcag = solveOmarchyPalette(everforest, "wcag-aa");
  assert.ok(balanced && faithful && wcag);

  assert.ok(
    contrastRatio(balanced.colors.border, balanced.colors.raised) <
      contrastRatio(wcag.colors.border, wcag.colors.raised),
    "balanced border should be softer than WCAG 2.2 AA border",
  );
  assert.equal(faithful.colors.border, "#475258");
  assert.equal(faithful.colors.sidebar, "#21272c");
  assert.equal(faithful.colors.raised, "#343f44");
  assert.equal(faithful.colors.sidebarSelected, "#3d484d");
  assert.equal(faithful.colors.accent, "#7fbbb3");

  const ethereal = {
    mode: "dark",
    background: "#060b1e",
    dark_background: "#040714",
    lighter_background: "#131a3a",
    selection: "#1b254f",
    muted: "#6d7db6",
    foreground: "#ffcead",
    dark_foreground: "#6d7db6",
    light_foreground: "#ffe0cc",
    accent: "#7aa2f7",
  };
  const etherealBalanced = solveOmarchyPalette(ethereal, "balanced");
  assert.ok(etherealBalanced);
  assert.ok(contrastRatio(etherealBalanced.colors.border, etherealBalanced.colors.raised) <= 1.65);
});

test("solveOmarchyPalette is strictly deterministic across all modes", () => {
  const input = {
    mode: "light",
    background: "#ffffff",
    dark_background: "#f5f5f5",
    lighter_background: "#c0c0c0",
    selection: "#c0c0c0",
    muted: "#808080",
    accent: "#6e6e6e",
    foreground: "#000000",
    dark_foreground: "#c0c0c0",
    light_foreground: "#000000",
  };
  for (const mode of ["balanced", "faithful", "wcag-aa"] satisfies ContrastMode[]) {
    const first = solveOmarchyPalette(input, mode);
    const second = solveOmarchyPalette(input, mode);
    assert.deepEqual(first, second, `${mode} should be deterministic`);
    assert.ok(first);
  }
  const wcag = solveOmarchyPalette(input, "wcag-aa");
  assert.ok(wcag);
  assertPaletteMeetsWcagAA(wcag.colors, "white-deterministic");
});

test("all installed host Omarchy themes satisfy invariants across all three modes", () => {
  const themesDir = "/usr/share/omarchy/themes";
  if (!fs.existsSync(themesDir)) return;

  const entries = fs.readdirSync(themesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.ok(entries.length > 0);

  for (const entry of entries) {
    const colorsPath = path.join(themesDir, entry.name, "colors.toml");
    if (!fs.existsSync(colorsPath)) continue;
    const parsed = parseColorsToml(fs.readFileSync(colorsPath, "utf8"));

    const balanced = solveOmarchyPalette(parsed, "balanced");
    assert.ok(balanced, `Expected ${entry.name} (balanced) to produce a palette`);
    assertPaletteMeetsMode(balanced.colors, `${entry.name}:balanced`, {
      fg: 4.5,
      muted: 3.2,
      extraMuted: 2.2,
      borderMin: 1.22,
      borderMaxOnRaised: 1.65,
      accent: 3.0,
      ring: 2.5,
    });

    const faithful = solveOmarchyPalette(parsed, "faithful");
    assert.ok(faithful, `Expected ${entry.name} (faithful) to produce a palette`);
    assertPaletteMeetsMode(faithful.colors, `${entry.name}:faithful`, {
      fg: 3.0,
      muted: 2.2,
      extraMuted: 1.5,
      borderMin: 1.15,
      accent: 2.5,
      ring: 2.0,
    });

    const wcag = solveOmarchyPalette(parsed, "wcag-aa");
    assert.ok(wcag, `Expected ${entry.name} (wcag-aa) to produce a palette`);
    assertPaletteMeetsWcagAA(wcag.colors, `${entry.name}:wcag-aa`);
    assert.ok(
      minContrastAgainst(wcag.colors.foreground, [wcag.colors.background]) >= TEXT_CONTRAST_AA,
      `${entry.name} foreground on background`,
    );
  }
});
