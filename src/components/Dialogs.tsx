import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, withAlpha } from "../design/tokens";

/**
 * The app's own confirm dialog and notices — the phone's counterpart of
 * web/src/components/ui/Dialogs.tsx.
 *
 * These used to be Alert.alert: the operating system's dialog, in the OS's
 * font and colours, with buttons laid out however Android or iOS felt like
 * that year. Mid-session, a bright system box in the middle of a dark music
 * app reads as an error from the phone, not a question from hooked.
 */

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive: the confirm button is red */
  danger?: boolean;
}

type Tone = "info" | "success" | "error";

interface Dialogs {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notify: (message: string, tone?: Tone) => void;
}

const DialogContext = createContext<Dialogs | null>(null);

export function useDialogs(): Dialogs {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialogs needs <DialogProvider> above it");
  return ctx;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<{ id: number; message: string; tone: Tone } | null>(null);
  const nextId = useRef(1);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending((prev) => {
          prev?.resolve(false);
          return { ...options, resolve };
        });
      }),
    [],
  );
  const answer = useCallback((ok: boolean) => {
    setPending((prev) => {
      prev?.resolve(ok);
      return null;
    });
  }, []);

  const notify = useCallback((message: string, tone: Tone = "info") => {
    const id = nextId.current++;
    setNotice({ id, message, tone });
    setTimeout(() => setNotice((n) => (n?.id === id ? null : n)), tone === "error" ? 6000 : 3200);
  }, []);

  // Android's back button answers "cancel", like it would for any dialog
  useEffect(() => {
    if (!pending) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      answer(false);
      return true;
    });
    return () => sub.remove();
  }, [pending, answer]);

  const value = useMemo(() => ({ confirm, notify }), [confirm, notify]);

  return (
    <DialogContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {pending && (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => answer(false)} accessibilityLabel="Cancel" />
            <Animated.View
              entering={FadeInDown.springify().stiffness(420).damping(32)}
              style={styles.card}
              accessibilityRole="alert"
              accessibilityViewIsModal
            >
              <Text style={styles.title}>{pending.title}</Text>
              {pending.body ? <Text style={styles.body}>{pending.body}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  onPress={() => answer(false)}
                  style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.btnText}>{pending.cancelLabel ?? "Cancel"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => answer(true)}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnPrimary,
                    pending.danger && styles.btnDanger,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.btnText, styles.btnPrimaryText]}>{pending.confirmLabel ?? "OK"}</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        )}
        {notice && (
          <Animated.View
            key={notice.id}
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(150)}
            style={[
              styles.notice,
              { bottom: insets.bottom + 24 },
              notice.tone === "error" && { borderColor: withAlpha(colors.never, 0.55) },
            ]}
            accessibilityRole="alert"
          >
            <View
              style={[
                styles.dot,
                notice.tone === "error" && { backgroundColor: colors.never },
                notice.tone === "success" && { backgroundColor: colors.save },
              ]}
            />
            <Text style={styles.noticeText}>{notice.message}</Text>
            <Pressable onPress={() => setNotice(null)} hitSlop={10} accessibilityLabel="Dismiss">
              <Text style={styles.close}>×</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </DialogContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    elevation: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(3,3,5,0.72)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    padding: 22,
    paddingBottom: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.text, marginBottom: 8, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, lineHeight: 21 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  btn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: colors.text, borderColor: colors.text },
  btnDanger: { backgroundColor: colors.never, borderColor: colors.never },
  pressed: { opacity: 0.8 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  btnPrimaryText: { color: colors.ink },
  notice: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 2001,
    elevation: 21,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 16,
    backgroundColor: "rgba(19,19,27,0.97)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  close: { fontSize: 20, color: colors.muted, paddingHorizontal: 4 },
});
