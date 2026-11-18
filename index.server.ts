import type { PluginServerContext } from "@getpaseo/plugin/server";
import { omarchySettings, omarchyThemeStatusRpc, omarchyThemeWatch } from "./shared/omarchy";
import { OmarchyThemeWatcher, stateDirectory } from "./server/omarchy";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(omarchySettings);
  const watcher = new OmarchyThemeWatcher();
  let stopped = false;

  server.handle(omarchyThemeStatusRpc, () => watcher.current());

  server.handle(omarchyThemeWatch, (_input, { push, signal }) => {
    void push(watcher.current());
    const unsubscribe = watcher.onChange((status) => {
      void push(status);
    });
    signal.addEventListener("abort", unsubscribe, { once: true });
  });

  watcher.start();

  void settings.read().then((state) => {
    if (!stopped && state.status === "ready") {
      watcher.setContrastMode(state.values.contrastMode);
    }
  });

  const stopSettings = settings.subscribe((state) => {
    if (state.status === "ready") {
      watcher.setContrastMode(state.values.contrastMode);
    }
  });

  const initial = watcher.current();
  if (initial.available) {
    console.log(`Omarchy detected at ${stateDirectory()}; theme "${initial.themeName}"`);
  } else {
    console.log(`No Omarchy state at ${stateDirectory()}; contributing no theme (${initial.error})`);
  }

  return () => {
    stopped = true;
    stopSettings();
    watcher.stop();
  };
}
