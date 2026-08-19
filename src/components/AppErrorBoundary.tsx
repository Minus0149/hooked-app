import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../design/tokens";

/**
 * The last line of defence.
 *
 * Without this a render error unmounts the whole tree and the app shows a bare
 * black screen with no way out — indistinguishable from a freeze, and the kind
 * of thing a store reviewer meets once and fails the submission over. React has
 * no hook form of this; it has to be a class.
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
        <Text style={styles.detail} numberOfLines={3}>
          {error.message}
        </Text>
      </View>
    );
  }
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
});
