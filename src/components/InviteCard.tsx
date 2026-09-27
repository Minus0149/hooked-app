import { useEffect, useRef } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { colors, fonts } from "../design/tokens";

type Invites = {
  enabled: boolean;
  code: string | null;
  link: string | null;
  cap: number;
  used: number;
  remaining: number;
  joined: number;
  foundingListener: boolean;
  people: { name: string; joined: boolean; at: string }[];
};

/**
 * "Invite friends" — the web's InviteCard, ported. The link opens the landing's
 * beta form with the code; a friend applying through it skips the waitlist
 * (convex/referrals.ts). The Android share sheet also offers "copy".
 */
export function InviteCard() {
  const data = useQuery(anyApi.referrals.mine, {}) as Invites | null | undefined;
  const ensureCode = useMutation(anyApi.referrals.ensureCode);
  const asked = useRef(false);

  useEffect(() => {
    if (!data || !data.enabled || data.code || asked.current) return;
    asked.current = true;
    void ensureCode({}).catch(() => {
      asked.current = false;
    });
  }, [data, ensureCode]);

  if (!data || !data.enabled) return null;
  const full = data.remaining === 0;

  const share = () => {
    if (!data.link) return;
    void Share.share({
      message: `Come find songs with me on HookedCue — this link skips the waitlist. ${data.link}`,
      url: data.link,
      title: "HookedCue",
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>INVITE FRIENDS</Text>
        {data.foundingListener ? <Text style={styles.badge}>FOUNDING LISTENER</Text> : null}
      </View>
      <Text style={styles.copy}>
        {full
          ? "You've used all your invites. Friends can still apply — they'll join the queue."
          : `Your link lets ${data.remaining} more ${data.remaining === 1 ? "friend" : "friends"} skip the waitlist.`}
        {!data.foundingListener ? " Two friends who join make you a founding listener." : ""}
      </Text>
      <Text style={styles.link} numberOfLines={1} selectable>
        {data.link ?? "making your link…"}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.share, (!data.link || pressed) && { opacity: 0.6 }]}
        onPress={share}
        disabled={!data.link}
        accessibilityRole="button"
      >
        <Text style={styles.shareText}>Share invite</Text>
      </Pressable>
      <Text style={styles.note}>
        {data.used} of {data.cap} used
      </Text>
      {data.people.length > 0 ? (
        <View style={styles.people}>
          {data.people.map((p, i) => (
            <View key={`${p.name}-${i}`} style={styles.person}>
              <Text style={styles.personName}>{p.name}</Text>
              <Text style={[styles.state, p.joined && { color: colors.save }]}>{p.joined ? "joined" : "invited"}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// web .invite-card and friends
const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 14,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.4, color: colors.muted },
  badge: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.7,
    color: "#0B0B10",
    backgroundColor: colors.accentDefault,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  copy: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 10, marginBottom: 12 },
  link: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  share: {
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: colors.accentDefault,
    paddingVertical: 14,
    alignItems: "center",
  },
  shareText: { fontFamily: fonts.displayBold, fontSize: 15, color: "#0B0B10" },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 10 },
  people: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  person: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  personName: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  state: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted },
});
