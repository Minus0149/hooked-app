import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import type { Track } from "../types";
import { colors, fonts } from "../design/tokens";
import { sheetText } from "./Sheet";
import { authStyles, Input } from "./AuthForm";
import {
  REPORT_COPY,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  cleanReportNote,
  type ReportReason,
} from "../lib/contentReport";

/**
 * "Report this song", inside the full-song sheet (Google Play's UGC policy) —
 * the web's ReportSong, same words and order (lib/contentReport.ts). Works
 * signed out: the install's anonymous key holds guests to a rate limit.
 */
export function ReportSong({
  track,
  anonKey,
  onBack,
  onDone,
}: {
  track: Track;
  anonKey?: string | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const submit = useMutation(anyApi.contentReports.submit);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (busy) return;
    if (!reason) {
      setError(REPORT_COPY.pick);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submit({
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        reason,
        note: cleanReportNote(note) || undefined,
        anonKey: anonKey ?? undefined,
      });
      setSent(true);
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setError(/rate|too many|slow down/i.test(m) ? "That's a lot of reports — try again in a while." : "Couldn't send that report. Try again?");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={{ gap: 12 }} accessibilityRole="summary">
        <Text style={sheetText.title}>{REPORT_COPY.doneTitle}</Text>
        <Text style={sheetText.sub}>{REPORT_COPY.doneSub}</Text>
        <Pressable style={authStyles.primary} onPress={onDone} accessibilityRole="button">
          <Text style={authStyles.primaryText}>{REPORT_COPY.close}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={sheetText.title}>{REPORT_COPY.title}</Text>
      <Text style={sheetText.sub}>
        "{track.title}" — {track.artist}. {REPORT_COPY.sub}
      </Text>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {REPORT_REASONS.map((r) => {
          const on = reason === r.id;
          return (
            <Pressable
              key={r.id}
              style={[s.reason, on && s.reasonOn]}
              onPress={() => {
                setReason(r.id);
                setError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <View style={[s.dot, on && s.dotOn]}>{on && <View style={s.dotFill} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={s.reasonLabel}>{r.label}</Text>
                <Text style={s.reasonHint}>{r.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ gap: 7 }}>
        <Text style={s.label}>{REPORT_COPY.noteLabel}</Text>
        <Input
          placeholder={REPORT_COPY.notePlaceholder}
          value={note}
          onChangeText={setNote}
          maxLength={REPORT_NOTE_MAX}
          multiline
          style={{ minHeight: 64, textAlignVertical: "top" }}
        />
      </View>
      {error && (
        <View style={authStyles.error} accessibilityRole="alert">
          <Text style={authStyles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        style={({ pressed }) => [authStyles.primary, busy && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
        disabled={busy}
        onPress={() => void send()}
        accessibilityRole="button"
      >
        <Text style={authStyles.primaryText}>{busy ? REPORT_COPY.busy : REPORT_COPY.submit}</Text>
      </Pressable>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={s.back}>{REPORT_COPY.back}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  reasonOn: { borderColor: "rgba(244,242,238,0.55)" },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOn: { borderColor: colors.accentDefault },
  dotFill: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentDefault },
  reasonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  reasonHint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.muted,
  },
  back: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 12,
    minHeight: 44,
  },
});
