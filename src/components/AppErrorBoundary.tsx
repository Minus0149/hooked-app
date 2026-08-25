import { Component, useEffect, useState, type ReactNode } from "react";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import Constants from "expo-constants";
import { colors, fonts } from "../design/tokens";
import { BUILD_TAG } from "../buildInfo";

/**
 * The last line of defence — and now also the owner's eyes.
 *
 * Without this a render error unmounts the whole tree and the app shows a bare
 * black screen. React has no hook form of this; it has to be a class. The
 * fallback's report panel IS a function component, so it can reach the convex
 * mutation even while the app around it is dead.
 *
 * Recovery re-mounts the tree rather than reloading, because the store rebuilds
 * from AsyncStorage on mount and the listener keeps their library.
 */
type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // shows up in `npx expo start` and in device logs on a dev build
    console.error("[hooked] render error:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>that broke</Text>
        <Text style={styles.body}>
          Something went wrong drawing the screen. Your library is saved on this
          device and nothing has been lost.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => this.setState({ error: null })}
          accessibilityRole="button"
          accessibilityLabel="try again"
        >
          <Text style={styles.buttonText}>try again</Text>
        </Pressable>
        <ReportPanel error={error} onDismiss={() => this.setState({ error: null })} />
        <Text style={styles.detail} numberOfLines={3}>
          {error.message}
        </Text>
      </View>
    );
  }
}

/** Send / share / describe — three ways to get the crash to the inbox. */
function ReportPanel({
  error,
  onDismiss,
}: {
  error: Error;
  onDismiss: () => void;
}) {
  const send = useMutation(anyApi.errors.report);
  const [description, setDescription] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [anonKey, setAnonKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    void AsyncStorage.getItem("hooked.anon").then((k) => setAnonKey(k ?? undefined));
  }, []);

  const payload = {
    message: error.message || "unknown error",
    stack: error.stack?.slice(0, 8000),
    description: description.trim() || undefined,
    platform: "android",
    appVersion: `${Constants.expoConfig?.version ?? "?"} ${BUILD_TAG}`,
    anonKey,
  };

  const sendReport = () => {
    setState("sending");
    void send(payload as never)
      .then(() => setState("sent"))
      .catch(() => setState("failed"));
  };

  const shareReport = () => {
    void Share.share({
      message: `hooked error report\n${payload.message}\n${payload.stack ?? ""}`,
    }).catch(() => undefined);
  };

  return (
    <View style={styles.report}>
      {state === "sent" ? (
        <Text style={styles.sentText}>Report sent — thank you.</Text>
      ) : (
        <>
          <TextInput
            style={styles.notes}
            placeholder="what were you doing when it broke? (optional)"
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            multiline
          />
          <View style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.chip, styles.chipOn, pressed && { opacity: 0.85 }]}
              onPress={sendReport}
              disabled={state === "sending"}
            >
              <Text style={styles.chipOnText}>
                {state === "sending" ? "sending…" : "send report"}
              </Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={shareReport}>
              <Text style={styles.chipText}>share</Text>
            </Pressable>
          </View>
          {state === "failed" && (
            <Text style={styles.note}>
              couldn't reach the backend (likely the same problem) — share works
              offline
            </Text>
          )}
        </>
      )}
      <Pressable onPress={onDismiss}>
        <Text style={styles.dismiss}>try to continue anyway</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 320,
  },
  button: {
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.accentDefault,
  },
  buttonText: { color: "#0b0b10", fontWeight: "700", fontSize: 14 },
  detail: { marginTop: 10, fontSize: 11, color: colors.muted, opacity: 0.6 },
  report: {
    width: "100%",
    maxWidth: 340,
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 10,
  },
  notes: {
    width: "100%",
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    padding: 10,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 8, justifyContent: "center" },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  chipOn: { backgroundColor: colors.accentDefault, borderColor: colors.accentDefault },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  chipOnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  sentText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.save, textAlign: "center" },
  note: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted, textAlign: "center" },
  dismiss: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted, textAlign: "center" },
});
