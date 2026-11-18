import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useSubscription } from "@getpaseo/plugin/client";
import { SettingsCard, SettingsRow, SettingsSection } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { omarchyThemeWatch, type OmarchyThemeStatus } from "../shared/omarchy";

function themeLabel(name: string | null): string {
  if (!name) return "None";
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTime(syncedAt: string | null): string {
  if (!syncedAt) return "Never";
  const date = new Date(syncedAt);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export function OmarchySettingsScreen({ theme, layout }: PluginSurfaceProps) {
  const [status, setStatus] = useState<OmarchyThemeStatus | null>(null);
  const subscription = useSubscription(omarchyThemeWatch, {}, setStatus);

  const styles = useMemo(
    () => ({
      value: { color: theme.colors.foreground },
      muted: { color: theme.colors.foregroundMuted },
      danger: { color: theme.colors.statusDanger },
      note: { color: theme.colors.foregroundMuted, fontSize: layout.compact ? 12 : 13 },
    }),
    [theme, layout.compact],
  );

  const syncState = (() => {
    if (subscription.status === "error") return { label: "Subscription error", style: styles.danger };
    if (subscription.status === "connecting") return { label: "Connecting", style: styles.muted };
    if (!status) return { label: "Waiting for first sync", style: styles.muted };
    if (status.available) return { label: "Syncing", style: styles.value };
    return { label: "Not available", style: styles.danger };
  })();

  const contrastSummary = (() => {
    const wcag = status?.wcag;
    if (!status?.available || !wcag) return "—";
    const minRatio = wcag.minTextContrast.toFixed(1);
    if (wcag.adjustedTokens.length === 0) return `WCAG 2.2 AA · Passed natively (${minRatio}:1 min)`;
    return `WCAG 2.2 AA · ${wcag.adjustedTokens.length} adjusted (${minRatio}:1 min)`;
  })();

  return (
    <SettingsSection title="Omarchy theme sync" info="Follows the active theme of the Omarchy desktop on this host.">
      <SettingsCard>
        <SettingsRow label="Status">
          <Text style={syncState.style}>{syncState.label}</Text>
        </SettingsRow>
        <SettingsRow label="Omarchy theme">
          <Text style={status?.available ? styles.value : styles.muted}>{themeLabel(status?.themeName ?? null)}</Text>
        </SettingsRow>
        <SettingsRow label="Contrast">
          <Text style={status?.available && status?.wcag ? styles.value : styles.muted}>{contrastSummary}</Text>
        </SettingsRow>
        <SettingsRow label="Generation">
          <Text style={styles.muted}>{status?.generation ?? "—"}</Text>
        </SettingsRow>
        <SettingsRow label="Last sync">
          <Text style={styles.muted}>{formatTime(status?.syncedAt ?? null)}</Text>
        </SettingsRow>
      </SettingsCard>
      <SettingsCard>
        <View style={{ gap: 4 }}>
          <Text style={styles.note}>
            Select the theme named Omarchy under Settings, Appearance to follow the desktop theme on this device. Devices
            that keep a built-in theme are not affected.
          </Text>
          {status?.available && status.wcag && status.wcag.adjustedTokens.length > 0 ? (
            <Text style={styles.note}>Adjusted tokens: {status.wcag.adjustedTokens.join(", ")}</Text>
          ) : null}
          {status && !status.available && status.error ? <Text style={styles.danger}>{status.error}</Text> : null}
        </View>
      </SettingsCard>
    </SettingsSection>
  );
}
