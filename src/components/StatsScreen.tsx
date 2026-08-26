import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { authClient } from "../lib/auth-client";
import { colors, fonts } from "../design/tokens";
import { SettingsPage } from "./settings/SettingsPage";

/**
 * Analytics, on the phone.
 *
 * Web's admin dashboard is the full cockpit; this is the pocket version — the
 * numbers that matter at a glance for whoever is running the deck, plus
 * per-track play/save stats for creators checking on their own songs.
 */

type AdminStats = {
  userCount: number;
  swipeCount: number;
  saveRate: number;
  todayByAction: { save: number; skip: number; more: number; never: number };
  activityHours: number[];
} | null;

type CreatorTrack = {
  trackId: string;
  title: string;
  hooks: { plays: number; saves: number }[];
};

type CreatorDash = {
  creator: unknown;
  curator: boolean;
  tracks: CreatorTrack[];
} | null;

function Big({ n, label, accent }: { n: string; label: string; accent?: string }) {
  return (
    <View style={styles.big}>
      <Text style={[styles.bigNum, accent ? { color: accent } : undefined]}>{n}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const session = authClient.useSession();
  const authed = session.data?.user != null;
  const stats = useQuery(anyApi.admin.stats, authed ? {} : "skip") as
    | AdminStats
    | null
    | undefined;
  const dash = useQuery(anyApi.creators.dashboard, authed ? {} : "skip") as
    | CreatorDash
    | null
    | undefined;

  const isAdminView = stats !== null && stats !== undefined;
  const creatorTracks = dash?.tracks ?? [];
  const isCreatorView = (dash?.creator ?? null) !== null || dash?.curator === true;

  const peak = Math.max(1, ...(stats?.activityHours ?? [1]));

  return (
    <SettingsPage
      title="Analytics"
      sub="Live numbers, straight from the same source as the web dashboard."
      onBack={onBack}
    >
      {isAdminView && (
        <>
          <Text style={styles.group}>the deck right now</Text>
          <View style={styles.card}>
            <View style={styles.bigRow}>
              <Big n={String(stats!.userCount)} label="listeners" accent={colors.more} />
              <Big n={String(stats!.swipeCount)} label="total swipes" />
              <Big
                n={`${Math.round(stats!.saveRate * 100)}%`}
                label="save rate"
                accent={colors.save}
              />
            </View>
            <Text style={styles.today}>
              today: {stats!.todayByAction.save} saved · {stats!.todayByAction.skip} skipped ·{" "}
              {stats!.todayByAction.more} more-like · {stats!.todayByAction.never} never
            </Text>
          </View>

          <Text style={styles.group}>last 24 hours</Text>
          <View style={styles.card}>
            <View style={styles.sparkRow}>
              {(stats!.activityHours ?? []).map((v, i) => (
                <View
                  key={i}
                  style={[
                   styles.sparkBar,
                    { height: Math.max(2, (v / peak) * 56), opacity: v > 0 ? 1 : 0.25 },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.sparkNote}>swipes per hour, oldest → now</Text>
          </View>
        </>
      )}

      {isCreatorView && creatorTracks.length > 0 && (
        <>
          <Text style={styles.group}>your tracks</Text>
          {creatorTracks.map((t) => {
            const plays = t.hooks.reduce((s, h) => s + (h.plays ?? 0), 0);
            const saves = t.hooks.reduce((s, h) => s + (h.saves ?? 0), 0);
            const rate = plays > 0 ? Math.round((saves / plays) * 100) : 0;
            return (
              <View key={t.trackId} style={styles.trackRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text style={styles.trackSub}>
                    {plays} plays · {saves} saves
                  </Text>
                </View>
                <Text style={[styles.trackRate, { color: rate >= 30 ? colors.save : colors.muted }]}>
                  {rate}%
                </Text>
              </View>
            );
          })}
        </>
      )}

      {!isAdminView && !isCreatorView && authed && (
        <Text style={styles.empty}>
          Nothing to see here yet — analytics appear for the admin and for
          creators with published tracks.
        </Text>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  group: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  bigRow: { flexDirection: "row", justifyContent: "space-between" },
  big: { alignItems: "center", flex: 1 },
  bigNum: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text },
  bigLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted, marginTop: 2 },
  today: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  sparkRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 58,
  },
  sparkBar: {
    flex: 1,
    backgroundColor: colors.accentDefault,
    borderRadius: 2,
  },
  sparkNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    color: colors.muted,
    textAlign: "center",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  trackTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  trackSub: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  trackRate: { fontFamily: fonts.displayBold, fontSize: 16 },
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    padding: 20,
  },
});
