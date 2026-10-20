import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { colors, fonts, radii } from "../design/tokens";
import { normalizeUsername, usernameProblem, USERNAME_MAX } from "../lib/username";
import { useT } from "../lib/lang";

/**
 * The listener's @handle on their profile: shown when set, edited in place.
 * Rules as you type (src/lib/username.ts, mirrored from web), availability a
 * moment after you stop, both checked again by the server on save. Same
 * behaviour as web/src/components/UsernameField.tsx.
 */
export function UsernameField({ accent }: { accent: string }) {
  const tt = useT();
  const library = useQuery(anyApi.library.getLibrary) as { username?: string | null } | null | undefined;
  const current = library?.username ?? null;
  const save = useMutation(anyApi.library.setUsername);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [debounced, setDebounced] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = normalizeUsername(draft);
  const localProblem = name ? usernameProblem(name) : null;
  useEffect(() => {
    const id = setTimeout(() => setDebounced(name), 350);
    return () => clearTimeout(id);
  }, [name]);
  const remote = useQuery(
    anyApi.library.usernameStatus,
    editing && debounced && !usernameProblem(debounced) && debounced !== current ? { username: debounced } : "skip",
  ) as { ok: boolean; problem: string | null } | undefined;

  if (library === undefined) return null;

  if (!editing) {
    return (
      <Pressable
        onPress={() => {
          setDraft(current ?? "");
          setError(null);
          setEditing(true);
        }}
        style={[styles.chip, !current && styles.chipEmpty]}
        accessibilityRole="button"
        accessibilityLabel={current ? `@${current}, ${tt("edit")}` : tt("Choose a username")}
      >
        <Text style={[styles.chipText, { color: current ? accent : colors.muted }]}>
          {current ? `@${current}` : tt("Choose a username")}
        </Text>
        <Text style={styles.chipEdit}>{current ? tt("edit") : "+"}</Text>
      </Pressable>
    );
  }

  const unchanged = name === (current ?? "");
  const checking = !!name && !localProblem && !unchanged && (debounced !== name || remote === undefined);
  const message = error ?? localProblem ?? (remote && !remote.ok ? remote.problem : null);
  const good = !message && remote?.ok && !unchanged;
  const canSave = !busy && !unchanged && (name === "" || (!localProblem && !checking && remote?.ok === true));

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await save({ username: name });
      setEditing(false);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(/Uncaught Error: (.+?)(\n|$)/.exec(raw)?.[1] ?? tt("Couldn't save that. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={[styles.inputWrap, message ? { borderColor: colors.never } : good ? { borderColor: colors.save } : null]}>
        <Text style={styles.at}>@</Text>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(v) => {
            setDraft(v);
            setError(null);
          }}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={USERNAME_MAX + 1}
          placeholder="yourname"
          placeholderTextColor={colors.muted}
          selectionColor={accent}
          accessibilityLabel={tt("Username")}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
        {checking && <ActivityIndicator size="small" color={colors.muted} />}
      </View>
      <Text style={[styles.note, message ? { color: colors.never } : good ? { color: colors.save } : null]} accessibilityLiveRegion="polite">
        {message
          ? tt(message)
          : checking
            ? tt("Checking…")
            : good
              ? tt("@{name} is free.", { name })
              : name === "" && current
                ? tt("Saving an empty name removes it.")
                : tt("Letters, numbers, dots and underscores.")}
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={() => setEditing(false)} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>{tt("Cancel")}</Text>
        </Pressable>
        <Pressable
          onPress={() => void submit()}
          disabled={!canSave}
          style={[styles.save, !canSave && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          <Text style={styles.saveText}>{busy ? tt("Saving…") : tt("Save")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  chipEmpty: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.line },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  chipEdit: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.muted, letterSpacing: 0.6, textTransform: "uppercase" },
  form: { alignSelf: "stretch", gap: 8, marginTop: 4 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  at: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted },
  input: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 0 },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  cancel: { paddingVertical: 14, paddingHorizontal: 16 },
  cancelText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.muted },
  save: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: colors.text, alignItems: "center" },
  saveText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.bg },
});
