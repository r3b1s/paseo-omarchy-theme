import type { PluginServerContext } from "@getpaseo/plugin/server";
import { omarchyThemeStatusRpc, omarchyThemeWatch } from "./shared/omarchy";
import { OmarchyThemeWatcher, stateDirectory } from "./server/omarchy";

export default function contribute(server: PluginServerContext) {
  const watcher = new OmarchyThemeWatcher();

  server.handle(omarchyThemeStatusRpc, () => watcher.current());

  server.handle(omarchyThemeWatch, (_input, { push, signal }) => {
    void push(watcher.current());
    const unsubscribe = watcher.onChange((status) => {
      void push(status);
    });
    signal.addEventListener("abort", unsubscribe, { once: true });
  });

  watcher.start();

  const initial = watcher.current();
  if (initial.available) {
    console.log(`Omarchy detected at ${stateDirectory()}; theme "${initial.themeName}"`);
  } else {
    console.log(`No Omarchy state at ${stateDirectory()}; contributing no theme (${initial.error})`);
  }

  return () => {
    watcher.stop();
  };
}
