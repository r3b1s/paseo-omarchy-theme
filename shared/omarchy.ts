import { defineRpc, defineSettings, defineSubscription } from "@getpaseo/plugin";
import { z } from "zod";

export const contrastModeSchema = z.enum(["balanced", "faithful", "wcag-aa"]);
export type ContrastMode = z.infer<typeof contrastModeSchema>;

export const omarchySettingsSchema = z.object({
  contrastMode: contrastModeSchema.default("balanced"),
});

export const omarchySettings = defineSettings({
  id: "omarchy-theme",
  scope: "host",
  version: 1,
  schema: omarchySettingsSchema,
});

export const themePaletteSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  raised: z.string(),
  control: z.string(),
  border: z.string(),
  accent: z.string(),
  mutedForeground: z.string(),
  ring: z.string(),
  sidebar: z.string(),
  sidebarHover: z.string(),
  sidebarSelected: z.string(),
  surface3: z.string(),
  surface4: z.string(),
  foregroundExtraMuted: z.string(),
});

export const wcagDiagnosticsSchema = z.object({
  level: z.enum(["balanced", "faithful", "AA"]),
  adjustedTokens: z.array(z.string()),
  minTextContrast: z.number(),
  minUiContrast: z.number(),
  minPrimaryTextContrast: z.number().optional(),
  minBorderContrast: z.number().optional(),
});

export const omarchyThemeStatusSchema = z.object({
  available: z.boolean(),
  themeName: z.string().nullable(),
  generation: z.string().nullable(),
  syncedAt: z.string().nullable(),
  contrastMode: contrastModeSchema.optional(),
  appearance: z.enum(["light", "dark"]).nullable(),
  colors: themePaletteSchema.nullable(),
  wcag: wcagDiagnosticsSchema.nullable().optional(),
  error: z.string().nullable(),
});

export type ThemePalette = z.infer<typeof themePaletteSchema>;
export type WcagDiagnostics = z.infer<typeof wcagDiagnosticsSchema>;
export type OmarchyThemeStatus = z.infer<typeof omarchyThemeStatusSchema>;

export const omarchyThemeStatusRpc = defineRpc({
  name: "omarchy.theme.status",
  input: z.object({}),
  output: omarchyThemeStatusSchema,
});

export const omarchyThemeWatch = defineSubscription({
  name: "omarchy.theme.watch",
  input: z.object({}),
  event: omarchyThemeStatusSchema,
});
