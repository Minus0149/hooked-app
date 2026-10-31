import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { useDialogs } from "./Dialogs";
import { GroupLabel, Row, RowValue } from "./settings/kit";
import { colors, fonts, radii } from "../design/tokens";
import { useT } from "../lib/lang";
import { serverMessage } from "../lib/serverError";

/**
 * The phone's side of blocking and of a shared playlist's members — the same
 * Convex functions as web/src/components/SocialScreens.tsx (social.block,
 * social.unblock, social.blocked, social.playlist, social.removeMember).
 *
 * The phone has no pages for other people, so the one place it shows someone
 * else is a shared playlist's people list: that is where Block lives here.
 */

interface Person {
  username: string | null;
  name: string;
}

/** The same question the web asks before blocking (the app's own dialog). */
function useBlock() {
  const tx = useT();
  const block = useMutation(anyApi.social.block);
  const { confirm, notify } = useDialogs();
  return async (username: string) => {
    const ok = await confirm({
      title: tx("Block @{name}?", { name: username }),
      body: tx(
        "You'll stop following each other, they leave your playlists and rooms, and neither of you sees the other's page or shares.",
      ),
      confirmLabel: tx("Block"),
      danger: true,
    });
    if (!ok) return;
    try {
      await block({ username });
    } catch (e) {
      notify(`${tx("Couldn't do that")}: ${serverMessage(e)}`, "error");
    }
  };
}

/** Settings → Data & privacy: the people you've blocked, each with an Unblock. */
export function BlockedPeople() {
  const tx = useT();
  const people = useQuery(anyApi.social.blocked) as Person[] | undefined;
  const unblock = useMutation(anyApi.social.unblock);
  const { notify } = useDialogs();
  if (!people || people.length === 0) return null;
  return (
    <>
      <GroupLabel>blocked people</GroupLabel>
      {people.map((x) => (
        <Row
          key={x.username ?? x.name}
          glyph="·"
          label={x.name}
          sub={x.username ? `@${x.username}` : undefined}
          right={<RowValue color={colors.more}>unblock</RowValue>}
          onPress={async () => {
            if (!x.username) return;
            try {
              await unblock({ username: x.username });
            } catch (e) {
              notify(`${tx("Couldn't do that")}: ${serverMessage(e)}`, "error");
            }
          }}
        />
      ))}
    </>
  );
}

type SharedPlaylist = {
  id: string;
  isOwner: boolean;
  owner: Person;
  members: (Person & { memberId: string | null })[];
} | null;

/**
 * A playlist's people, under its header: the owner can take one member out
 * (web 981ba72), and anyone else listed can be blocked. Hidden for a playlist
 * nobody else is in, and for one this device made before it synced.
 */
export function PlaylistPeople({ playlistId, accent }: { playlistId: string; accent: string }) {
  const tx = useT();
  const library = useQuery(anyApi.library.getLibrary) as { username?: string | null } | null | undefined;
  const signedIn = library != null;
  const pl = useQuery(anyApi.social.playlist, signedIn ? { playlistId } : "skip") as SharedPlaylist | undefined;
  const removeMember = useMutation(anyApi.social.removeMember);
  const { confirm, notify } = useDialogs();
  const askBlock = useBlock();
  const [busy, setBusy] = useState<string | null>(null);
  if (!pl) return null;

  const me = library?.username ?? null;
  const others = pl.isOwner
    ? pl.members
    : [{ ...pl.owner, memberId: null }, ...pl.members.filter((m) => !me || m.username !== me)];
  if (others.length === 0) return null;

  const remove = async (m: Person & { memberId: string | null }) => {
    const who = m.username ? `@${m.username}` : m.name;
    const ok = await confirm({
      title: tx("Remove {name}?", { name: who }),
      body: tx("They lose this playlist. Songs they added stay until you remove them."),
      confirmLabel: tx("Remove"),
      danger: true,
    });
    if (!ok) return;
    try {
      await removeMember({ playlistId: pl.id, memberId: m.memberId });
    } catch (e) {
      notify(`${tx("Couldn't do that")}: ${serverMessage(e)}`, "error");
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        {pl.isOwner
          ? tx("People in it. Turning off Public and Collaborative takes everyone out.")
          : tx("Shared with you by {name}.", { name: pl.owner.username ? `@${pl.owner.username}` : pl.owner.name })}
      </Text>
      {others.map((m) => {
        const key = String(m.memberId ?? m.username ?? m.name);
        return (
          <View key={key} style={styles.person}>
            <View style={[styles.avatar, { borderColor: accent }]}>
              <Text style={[styles.avatarText, { color: accent }]}>{(m.name || "?").slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>
                {m.name}
              </Text>
              {m.username ? (
                <Text style={styles.handle} numberOfLines={1}>
                  @{m.username}
                </Text>
              ) : null}
            </View>
            {pl.isOwner && m.memberId && (
              <Pressable
                style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
                disabled={busy === key}
                onPress={async () => {
                  setBusy(key);
                  await remove(m);
                  setBusy(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={tx("Remove {name}?", { name: m.username ? `@${m.username}` : m.name })}
              >
                <Text style={styles.btnText}>{tx("Remove")}</Text>
              </Pressable>
            )}
            {m.username && m.username !== me && (
              <Pressable
                style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
                disabled={busy === key}
                onPress={async () => {
                  setBusy(key);
                  await askBlock(m.username!);
                  setBusy(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={tx("Block @{name}?", { name: m.username })}
              >
                <Text style={[styles.btnText, { color: colors.never }]}>{tx("Block")}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, gap: 6 },
  hint: { fontFamily: fonts.bodyMedium, fontSize: 11.5, lineHeight: 17, color: colors.muted, marginBottom: 2 },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  meta: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  handle: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.muted },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.text },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
