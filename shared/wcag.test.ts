import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ThemePalette } from "./wcag";
import {
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

function assertPaletteMeetsWcagAA(colors: ThemePalette, label: string): void {
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
      contrastRatio(colors.foreground, surface) >= TEXT_CONTRAST_AA,
      `${label}: foreground (${colors.foreground}) on ${surface} < 4.5`,
    );
    assert.ok(
      contrastRatio(colors.mutedForeground, surface) >= TEXT_CONTRAST_AA,
      `${label}: mutedForeground (${colors.mutedForeground}) on ${surface} < 4.5`,
    );
    assert.ok(
      contrastRatio(colors.foregroundExtraMuted, surface) >= TEXT_CONTRAST_AA,
      `${label}: foregroundExtraMuted (${colors.foregroundExtraMuted}) on ${surface} < 4.5`,
    );
    assert.ok(
      contrastRatio(colors.ring, surface) >= UI_CONTRAST_AA,
      `${label}: ring (${colors.ring}) on ${surface} < 3.0`,
    );
  }

  for (const surface of uiSurfaces) {
    assert.ok(
      contrastRatio(colors.border, surface) >= UI_CONTRAST_AA,
      `${label}: border (${colors.border}) on ${surface} < 3.0`,
    );
  }

  for (const surface of accentSurfaces) {
    assert.ok(
      contrastRatio(colors.accent, surface) >= TEXT_CONTRAST_AA,
      `${label}: accent (${colors.accent}) on ${surface} < 4.5`,
    );
  }

  assert.notEqual(colors.raised, colors.background, `${label}: raised collapsed onto background`);
  assert.notEqual(colors.sidebar, colors.background, `${label}: sidebar collapsed onto background`);
  assert.notEqual(colors.sidebarHover, colors.sidebar, `${label}: sidebarHover collapsed onto sidebar`);
  assert.notEqual(colors.sidebarSelected, colors.sidebar, `${label}: sidebarSelected collapsed onto sidebar`);
  assert.notEqual(colors.sidebarSelected, colors.sidebarHover, `${label}: sidebarSelected collapsed onto sidebarHover`);
  assert.notEqual(colors.surface3, colors.raised, `${label}: surface3 collapsed onto raised`);
  assert.notEqual(colors.surface4, colors.surface3, `${label}: surface4 collapsed onto surface3`);
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

test("solveOmarchyPalette synthesizes missing secondary keys from background and foreground", () => {
  const solved = solveOmarchyPalette({
    background: "#181a1f",
    foreground: "#e6e8ee",
  });
  assert.ok(solved);
  assert.equal(solved.appearance, "dark");
  assertPaletteMeetsWcagAA(solved.colors, "minimal-dark");
});

test("solveOmarchyPalette repairs collapsed surfaces, bright muted surface4, and low-contrast foregrounds", () => {
  const solved = solveOmarchyPalette({
    mode: "dark",
    background: "#0c0b0c",
    dark_background: "#0c0b0c",
    lighter_background: "#0c0b0c",
    selection: "#0c0b0c",
    muted: "#9aa0a6",
    accent: "#3a4552",
    foreground: "#6a7077",
    dark_foreground: "#2c3035",
  });
  assert.ok(solved);
  assert.equal(solved.appearance, "dark");
  assertPaletteMeetsWcagAA(solved.colors, "adversarial-collapsed");
  assert.ok(solved.wcag.adjustedTokens.length > 0);
  assert.ok(solved.wcag.minTextContrast >= TEXT_CONTRAST_AA);
  assert.ok(solved.wcag.minUiContrast >= UI_CONTRAST_AA);
});

test("solveOmarchyPalette is strictly deterministic", () => {
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
  const first = solveOmarchyPalette(input);
  const second = solveOmarchyPalette(input);
  assert.deepEqual(first, second);
  assert.ok(first);
  assertPaletteMeetsWcagAA(first.colors, "white-deterministic");
});

test("all installed host Omarchy themes satisfy WCAG 2.2 AA deterministically", () => {
  const themesDir = "/usr/share/omarchy/themes";
  if (!fs.existsSync(themesDir)) return;

  const entries = fs.readdirSync(themesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.ok(entries.length > 0);

  for (const entry of entries) {
    const colorsPath = path.join(themesDir, entry.name, "colors.toml");
    if (!fs.existsSync(colorsPath)) continue;
    const parsed = parseColorsToml(fs.readFileSync(colorsPath, "utf8"));
    const solved = solveOmarchyPalette(parsed);
    assert.ok(solved, `Expected ${entry.name} to produce a palette`);
    assertPaletteMeetsWcagAA(solved.colors, entry.name);
    assert.ok(
      minContrastAgainst(solved.colors.foreground, [solved.colors.background]) >= TEXT_CONTRAST_AA,
      `${entry.name} foreground on background`,
    );
  }
});
