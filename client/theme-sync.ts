import type { PluginClientContext } from "@getpaseo/plugin/client";
import { omarchyThemeWatch, type OmarchyThemeStatus } from "../shared/omarchy";

const THEME_ID = "omarchy";
const THEME_NAME = "Omarchy";

function statusSignature(status: OmarchyThemeStatus): string {
  return JSON.stringify([status.themeName, status.generation, status.appearance, status.colors]);
}

export function startThemeSync(client: PluginClientContext): () => void {
  let removeTheme: (() => void) | null = null;
  let lastSignature: string | null = null;

  const apply = (status: OmarchyThemeStatus) => {
    if (!status.available || !status.colors || !status.appearance) {
      if (removeTheme) {
        removeTheme();
        removeTheme = null;
        lastSignature = null;
      }
      return;
    }
    const signature = statusSignature(status);
    if (signature === lastSignature && removeTheme) return;
    removeTheme?.();
    removeTheme = client.addTheme({
      id: THEME_ID,
      name: THEME_NAME,
      appearance: status.appearance,
      colors: status.colors,
    });
    lastSignature = signature;
  };

  const handle = client.subscribe(omarchyThemeWatch, {}, apply, {
    onClosed: (closed) => {
      if (closed.error) console.error("Omarchy theme subscription closed", closed.error);
    },
  });
  handle.ready.catch((error) => {
    console.error("Omarchy theme subscription failed", error);
  });

  return () => {
    void handle.release().catch(() => {});
    removeTheme?.();
    removeTheme = null;
    lastSignature = null;
  };
}
