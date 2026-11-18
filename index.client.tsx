import type { PluginClientContext } from "@getpaseo/plugin/client";
import { OmarchySettingsScreen } from "./client/settings";
import { startThemeSync } from "./client/theme-sync";

export default function contribute(client: PluginClientContext) {
  client.addSettingsScreen({
    id: "omarchy-theme",
    title: "Omarchy theme",
    icon: "Palette",
    Component: OmarchySettingsScreen,
  });

  const stopThemeSync = startThemeSync(client);

  return () => {
    stopThemeSync();
  };
}
