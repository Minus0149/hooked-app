import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { WEB_APP_URL } from "../config/env";
import { authClient } from "../lib/auth-client";
import {
  AUTH_COPY,
  authProblem,
  friendlyAuthError,
  isNotApproved,
  type AuthMode,
} from "../lib/authForms";
import { colors, fonts } from "../design/tokens";

/**
 * Sign in, or — with an invite — create the account. The web's AuthForm
 * (web/src/components/AuthForm.tsx), same words (lib/authForms.ts), same order.
 *
 * hookedcue is a beta you apply for, so this leads with signing in. Creating
 * an account is for invited emails only: the server refuses anyone else and
 * the form turns that refusal into an Apply button. `compact` drops the
 * headline — the invite gate shows it under its own pitch.
 */
export function AuthForm({
  accent,
  compact = false,
  initialMode = "signin",
  initialEmail = "",
  onApply,
}: {
  accent: string;
  compact?: boolean;
  initialMode?: AuthMode;
  initialEmail?: string;
  /** open the beta application */
  onApply?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notApproved, setNotApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);
  const copy = AUTH_COPY[mode];

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotApproved(false);
    setPassword("");
  };

  const submit = async () => {
    if (busy) return;
    const problem = authProblem(mode, email, password);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setNotApproved(false);
    setBusy(true);
    // a request that throws (offline, a timeout) instead of returning an error
    // used to leave the button on "Signing in…" for good
    let result: { error?: { message?: string } | null } | undefined;
    try {
      result =
        mode === "join"
          ? await authClient.signUp.email({
              email: email.trim(),
              password,
              name: email.trim().split("@")[0],
              // the confirmation link opens the web app; the phone rechecks on return
              callbackURL: WEB_APP_URL,
            })
          : await authClient.signIn.email({ email: email.trim(), password });
    } catch (err) {
      result = { error: { message: err instanceof Error ? err.message : "" } };
    }
    setBusy(false);
    if (result?.error) {
      const message = result.error.message ?? "";
      const refused = isNotApproved(message);
      setNotApproved(refused);
      setError(refused ? message : friendlyAuthError(message));
    }
  };

  // the reset link opens the web app's /reset-password, where the new
  // password is set — then signing in here just works
  const sendReset = async () => {
    if (resetting) return;
    if (authProblem("signin", email, "x")) {
      setError("Type your email above, then tap “Forgot password?” again.");
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const res = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${WEB_APP_URL}/reset-password`,
      });
      if (res.error) throw new Error(res.error.message ?? "Couldn't send it");
      setResetSent(true);
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : null));
    } finally {
      setResetting(false);
    }
  };

  const form = (
    <Animated.View entering={FadeInDown.duration(320)} style={s.form}>
      {!compact && (
        <>
          <Text style={s.title}>
            {copy.title.lead} <Text style={{ color: accent }}>{copy.title.accent}</Text>
          </Text>
          <Text style={s.copy}>{copy.copy}</Text>
        </>
      )}

      <View style={s.field}>
        <Text style={s.label}>{AUTH_COPY.emailLabel}</Text>
        <Input
          placeholder={AUTH_COPY.emailPlaceholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="next"
        />
      </View>

      <View style={s.field}>
        <View style={s.labelRow}>
          <Text style={s.label}>{AUTH_COPY.passwordLabel}</Text>
          {mode === "signin" && (
            <Pressable onPress={() => void sendReset()} hitSlop={10} accessibilityRole="button">
              <Text style={s.link}>{resetting ? "Sending…" : AUTH_COPY.forgot}</Text>
            </Pressable>
          )}
        </View>
        <View>
          <Input
            placeholder={mode === "signin" ? AUTH_COPY.signinPasswordPlaceholder : AUTH_COPY.joinPasswordPlaceholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete={mode === "join" ? "new-password" : "current-password"}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            style={{ paddingRight: 68 }}
          />
          <Pressable
            style={s.toggle}
            onPress={() => setShowPassword((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          >
            <Text style={s.toggleText}>{showPassword ? AUTH_COPY.hidePassword : AUTH_COPY.showPassword}</Text>
          </Pressable>
        </View>
      </View>

      {resetSent && !error && (
        <View style={s.note} accessibilityRole="summary">
          <Text style={s.noteText}>{AUTH_COPY.resetSent}</Text>
        </View>
      )}
      {error && (
        <View style={s.error} accessibilityRole="alert">
          <Text style={s.errorText}>{error}</Text>
          {notApproved && onApply && (
            <Pressable onPress={onApply} accessibilityRole="button">
              <Text style={s.errorAction}>Apply for the beta</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [s.primary, busy && { opacity: 0.5 }, pressed && s.pressed]}
        disabled={busy}
        onPress={() => void submit()}
        accessibilityRole="button"
      >
        <Text style={s.primaryText}>{busy ? copy.busy : copy.submit}</Text>
      </Pressable>

      <View style={s.alt}>
        {mode === "signin" ? (
          <>
            {onApply && (
              <Pressable
                style={({ pressed }) => [s.secondary, pressed && s.pressed]}
                onPress={onApply}
                accessibilityRole="button"
              >
                <Text style={s.secondaryText}>{AUTH_COPY.apply}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => switchMode("join")} accessibilityRole="button">
              <Text style={s.switchMode}>{AUTH_COPY.haveInvite}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => switchMode("signin")} accessibilityRole="button">
            <Text style={s.switchMode}>{AUTH_COPY.haveAccount}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );

  // inside the gate's own scrolling card, a second scroll view would fight it
  if (compact) return <View style={{ paddingTop: 8 }}>{form}</View>;
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.body}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {form}
    </ScrollView>
  );
}

/**
 * A text field whose focus is a quiet brightening (web .auth-input:focus) — a
 * pink ring on an empty, just-focused field read as "you did something wrong".
 */
export function Input({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[s.input, focused && s.inputFocused, style]}
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

export const authStyles = StyleSheet.create({
  error: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,82,82,0.32)",
    backgroundColor: "rgba(255,82,82,0.10)",
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  errorText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, lineHeight: 19, color: "#ff9a9a" },
  primary: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: colors.accentDefault,
  },
  primaryText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.ink },
});

const s = StyleSheet.create({
  body: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20 },
  form: { gap: 14, width: "100%", maxWidth: 380, alignSelf: "center" },
  title: {
    fontFamily: fonts.display,
    fontSize: 31,
    lineHeight: 35,
    letterSpacing: -1,
    color: colors.text,
    textAlign: "center",
  },
  copy: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    // RN has no text-wrap: balance; this width breaks the line where the web's does
    maxWidth: 250,
    alignSelf: "center",
    marginTop: -4,
    marginBottom: 6,
  },
  field: { gap: 7 },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.muted,
  },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.muted },
  input: {
    width: "100%",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  inputFocused: { borderColor: "rgba(244,242,238,0.45)" },
  toggle: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    minWidth: 52,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.muted },
  note: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,229,160,0.30)",
    backgroundColor: "rgba(0,229,160,0.10)",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  noteText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.save },
  error: authStyles.error,
  errorText: authStyles.errorText,
  errorAction: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.text,
    textDecorationLine: "underline",
  },
  primary: { ...authStyles.primary, marginTop: 4 },
  primaryText: authStyles.primaryText,
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  alt: { gap: 4, marginTop: 4 },
  secondary: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.text },
  switchMode: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 12,
    minHeight: 44,
  },
});
