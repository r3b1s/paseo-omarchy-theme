import { defineRpc, defineSubscription } from "@getpaseo/plugin";
import { z } from "zod";

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

export const omarchyThemeStatusSchema = z.object({
  available: z.boolean(),
  themeName: z.string().nullable(),
  generation: z.string().nullable(),
  syncedAt: z.string().nullable(),
  appearance: z.enum(["light", "dark"]).nullable(),
  colors: themePaletteSchema.nullable(),
  error: z.string().nullable(),
});

export type ThemePalette = z.infer<typeof themePaletteSchema>;
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
