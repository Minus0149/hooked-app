import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { authClient } from "../lib/auth-client";
import {
  ACCESS_GENRES as GENRES,
  MAX_ACCESS_GENRES as MAX_GENRES,
  applyBody,
  emailLooksValid,
  stageAfterApply,
  toggleAccessGenre,
  type AccessStage as Stage,
  type ApplyResult,
} from "../lib/accessApply";
import { CONVEX_SITE_URL, WEB_APP_URL } from "../config/env";
import { colors, fonts, mixHex, withAlpha } from "../design/tokens";
import { AuthForm } from "./ProfileScreen";

/**
 * The wall after the free swipes run out — the same application the web app
 * shows (web/src/components/AccessGate.tsx), not a signup: accounts only work
 * once an admin has approved the email, so a password field first would only
 * produce accounts that can't do anything. It posts to the same /access/apply
 * route; a native request carries no Origin, which that route accepts.
 */
export function AccessGate({
  freeSwipes,
  accent,
  onClose,
}: {
  freeSwipes: number;
  accent: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [device, setDevice] = useState("");
  const [notes, setNotes] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<string>("pending");
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const apply = async (
    extra: { device?: string; notes?: string; genres?: string[] },
  ): Promise<ApplyResult | null> => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${CONVEX_SITE_URL}/access/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // no honeypot on a phone: there is no bot-fillable hidden field here
        body: JSON.stringify(applyBody({ name, email, trap: "", startedAt: startedAt.current }, extra)),
      });
      const data = (await res.json().catch(() => ({}))) as ApplyResult;
      if (!res.ok || !data.ok) {
        setError(data.message ?? "that didn't go through. try again?");
        return null;
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "that didn't go through. try again?");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    if (!emailLooksValid(email)) {
      setError("that email doesn't look right");
      return;
    }
    const data = await apply({});
    if (!data) return;
    if (data.duplicate) setExisting(data.status ?? "pending");
    setStage(stageAfterApply(data));
  };

  const sendDetails = async () => {
    if (busy) return;
    const hasAny = device.trim() || notes.trim() || genres.length > 0;
    if (!hasAny) {
      setStage("sent");
      return;
    }
    const data = await apply({ device, notes, genres });
    if (data) setStage("sent");
  };

  let body: React.ReactNode;
  if (stage === "signin") {
    body = (
      <View style={s.done}>
        <Text style={s.kicker}>you're approved</Text>
        <Text style={s.copy}>sign in and the deck never stops.</Text>
        <AuthForm accent={accent} compact />
      </View>
    );
  } else if (stage === "sent" || stage === "already") {
    const rejected = stage === "already" && existing === "rejected";
    body = (
      <Animated.View entering={FadeInDown.duration(260)} style={s.done} accessibilityRole="summary">
        <PulseDot />
        <Text style={s.kicker}>{rejected ? "not this round" : "you're on the list"}</Text>
        <Text style={s.copy}>
          {rejected
            ? "this email isn't on the list for the current round. nothing else to do for now."
            : "we'll email you when you're in. then create an account with this address and pick up right where you left off."}
        </Text>
        <Pressable onPress={() => setStage("signin")}>
          <Text style={s.close}>already approved? sign in</Text>
        </Pressable>
      </Animated.View>
    );
  } else if (stage === "details") {
    body = (
      <Animated.View entering={FadeInDown.duration(260)} style={s.form}>
        <PulseDot />
        <Text style={s.kicker}>you're on the list</Text>
        <Text style={s.copy}>that's all we need. two optional things help us tune your first deck:</Text>

        <View style={s.field}>
          <Text style={s.label}>your phone</Text>
          <Field
            accent={accent}
            style={s.input}
            placeholder="pixel 8a, redmi note 13, …"
            placeholderTextColor={colors.muted}
            value={device}
            onChangeText={setDevice}
            maxLength={80}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>
            what you actually play <Text style={s.labelSmall}>up to {MAX_GENRES}</Text>
          </Text>
          <View style={s.pills}>
            {GENRES.map((g) => {
              const on = genres.includes(g);
              const disabled = !on && genres.length >= MAX_GENRES;
              return (
                <Pressable
                  key={g}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled }}
                  disabled={disabled}
                  onPress={() => setGenres((list) => toggleAccessGenre(list, g))}
                  style={[s.pill, on && s.pillOn, disabled && s.pillDisabled]}
                >
                  <Text style={[s.pillText, on && s.pillTextOn]}>{g}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>anything else</Text>
          <Field
            accent={accent}
            style={[s.input, s.notes]}
            placeholder="bugs you expect, features you want, complaints"
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
        </View>

        {error && <Text style={s.error}>{error}</Text>}

        <View style={s.actions}>
          <Pressable
            style={({ pressed }) => [s.primary, busy && s.dim, pressed && s.pressed]}
            disabled={busy}
            onPress={() => void sendDetails()}
          >
            <Text style={s.primaryText}>{busy ? "sending…" : "send"}</Text>
          </Pressable>
          <Pressable onPress={() => setStage("sent")}>
            <Text style={s.close}>skip — I'm done</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  } else {
    body = (
      <View style={s.form}>
        <Text style={s.kicker}>that was your {freeSwipes} free tastes</Text>
        <Text style={s.copy}>
          hookedcue is invite-only while it's in testing. leave your email and we'll let you in.
        </Text>

        <View style={s.field}>
          <Text style={s.label}>email</Text>
          <Field
            accent={accent}
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            maxLength={200}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
          />
        </View>
        {email.includes("@") && (
          <Animated.View entering={FadeIn.duration(220)} style={s.field}>
            <Text style={s.label}>
              your name <Text style={s.labelSmall}>optional</Text>
            </Text>
            <Field
            accent={accent}
              style={s.input}
              placeholder="what should we call you?"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              autoComplete="name"
              maxLength={60}
            />
          </Animated.View>
        )}

        {error && <Text style={s.error}>{error}</Text>}

        <View style={s.actions}>
          <Pressable
            style={({ pressed }) => [s.primary, (busy || !email.trim()) && s.dim, pressed && s.pressed]}
            disabled={busy || !email.trim()}
            onPress={() => void submit()}
          >
            <Text style={s.primaryText}>{busy ? "sending…" : "put me on the list"}</Text>
          </Pressable>
          <Pressable onPress={() => setStage("signin")}>
            <Text style={s.close}>already approved? sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(250)} style={s.overlay}>
      <Animated.View
        entering={FadeInDown.duration(350)}
        style={[s.card, { shadowColor: accent }]}
      >
        <ScrollView
          contentContainerStyle={s.cardBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body}
          <Pressable onPress={onClose}>
            <Text style={s.close}>not now — just looking</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Signed in, but the server won't create a profile yet — the same four answers
 * the web app gives (AccessPending there), with the same way out.
 */
export function AccessPending({
  reason,
  email,
  onRecheck,
}: {
  reason: "pending" | "rejected" | "none" | "unverified";
  email: string;
  onRecheck: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const resend = async () => {
    setResent("sending");
    const res = await authClient
      .sendVerificationEmail({ email, callbackURL: WEB_APP_URL })
      .catch(() => ({ error: true }));
    setResent(res && "error" in res && res.error ? "failed" : "sent");
  };
  const signOut = async () => {
    setBusy(true);
    await authClient.signOut();
    setBusy(false);
  };
  return (
    <View style={s.overlay}>
      <Animated.View entering={FadeInDown.duration(300)} style={s.card} accessibilityRole="summary">
        <View style={[s.cardBody, s.done]}>
          <PulseDot />
          <Text style={s.kicker}>
            {reason === "rejected"
              ? "not this round"
              : reason === "none"
                ? "no request on file"
                : reason === "unverified"
                  ? "check your inbox"
                  : "thank you for your interest"}
          </Text>
          <Text style={s.copy}>
            {reason === "rejected"
              ? "this account isn't on the list for the current round."
              : reason === "none"
                ? "this email hasn't asked for access yet. sign out, swipe a few, and the form will come to you."
                : reason === "unverified"
                  ? `you're approved. we sent a confirmation link to ${email} — open it, then come back here.`
                  : "we'll get back to you. your account works the moment you're approved — nothing else to do."}
          </Text>
          {reason === "unverified" && (
            <View style={s.actions}>
              <Pressable style={({ pressed }) => [s.primary, pressed && s.pressed]} onPress={onRecheck}>
                <Text style={s.primaryText}>I've confirmed it</Text>
              </Pressable>
              <Pressable
                disabled={resent === "sending" || resent === "sent"}
                onPress={() => void resend()}
              >
                <Text style={s.link}>
                  {resent === "sending"
                    ? "sending…"
                    : resent === "sent"
                      ? "sent — give it a minute (and check spam)"
                      : resent === "failed"
                        ? "couldn't send — try again"
                        : "resend the link"}
                </Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={() => void signOut()} disabled={busy}>
            <Text style={s.close}>{busy ? "signing out..." : "sign out"}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/** A text field that takes the accent while focused (web .auth-input:focus). */
function Field({
  accent,
  style,
  ...props
}: React.ComponentProps<typeof TextInput> & { accent: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      style={[style, focused && { borderColor: withAlpha(accent, 0.7) }]}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
    />
  );
}

/** The green "you're in the queue" dot, breathing like the web's accesspulse. */
function PulseDot() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value * 0.55,
    transform: [{ scale: 1 - t.value * 0.18 }],
  }));
  return <Animated.View style={[s.dot, style]} />;
}

const cardBg = mixHex(colors.surface, "#000000", 0.88);

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3,3,5,0.72)",
    padding: 18,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "92%",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: cardBg,
    shadowOpacity: 0.3,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
    elevation: 24,
    overflow: "hidden",
  },
  cardBody: { paddingTop: 22, paddingHorizontal: 20, paddingBottom: 14 },
  form: { gap: 10 },
  done: { gap: 10, alignItems: "stretch" },
  kicker: {
    fontFamily: fonts.display,
    fontSize: 21,
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.2,
    paddingHorizontal: 6,
  },
  copy: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 6,
  },
  field: { gap: 6 },
  label: {
    marginTop: 6,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.muted,
  },
  labelSmall: { fontFamily: fonts.body, letterSpacing: 0.5, textTransform: "none", fontSize: 11 },
  input: {
    width: "100%",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14.5,
  },
  notes: { minHeight: 56, textAlignVertical: "top", lineHeight: 21 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  pill: {
    backgroundColor: "rgba(8,8,12,0.5)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  pillOn: { backgroundColor: colors.save, borderColor: colors.save },
  pillDisabled: { opacity: 0.35 },
  pillText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  pillTextOn: { color: colors.ink, fontFamily: fonts.bodySemiBold },
  error: { color: "#ff8080", fontSize: 12.5, fontFamily: fonts.body, marginTop: 2 },
  actions: { marginTop: 8, gap: 2 },
  primary: {
    width: "100%",
    paddingVertical: 17,
    borderRadius: 18,
    backgroundColor: colors.text,
    alignItems: "center",
  },
  primaryText: { color: colors.ink, fontFamily: fonts.displayBold, fontSize: 15 },
  dim: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.97 }] },
  close: {
    marginTop: 6,
    padding: 12,
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.bodySemiBold,
    textAlign: "center",
  },
  link: {
    padding: 10,
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.body,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  dot: {
    alignSelf: "center",
    width: 11,
    height: 11,
    borderRadius: 999,
    marginTop: 2,
    marginBottom: 6,
    backgroundColor: colors.save,
  },
});
