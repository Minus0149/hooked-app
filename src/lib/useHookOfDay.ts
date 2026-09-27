import { useEffect, useMemo, useState } from "react";
import type { Track } from "../types";
import { dayKey, pickForDay, pruneHistory, type HookPick } from "./hookOfDay";
import {
  DEFAULT_NOTIFY,
  onNotifySettings,
  readHistory,
  readNotifySettings,
  writeHistory,
  type HookNotifySettings,
} from "./hookOfDayNotify";

/**
 * Today's hook of the day on the phone (web: src/lib/useHookOfDay.ts).
 *
 * Same rules (lib/hookOfDay.ts) and the same AsyncStorage history the
 * notification scheduler writes, so the Home card and tonight's notification
 * are always the same song.
 */
export function useNotifySettings(): HookNotifySettings {
  const [settings, setSettings] = useState<HookNotifySettings>(DEFAULT_NOTIFY);
  useEffect(() => {
    let live = true;
    void readNotifySettings().then((s) => live && setSettings(s));
    const off = onNotifySettings(setSettings);
    return () => {
      live = false;
      off();
    };
  }, []);
  return settings;
}

/**
 * @param ranked the deck's ranked queue
 * @param catalog every track, to find today's pick again once it has left the queue
 * @param exclude songs already in the library
 */
export function useHookOfDay(ranked: Track[], catalog: Track[], exclude: Set<string>): Track | null {
  // null until AsyncStorage answers: picking before that could overwrite the
  // pick tonight's notification already announced
  const [history, setHistory] = useState<HookPick[] | null>(null);
  const today = dayKey(new Date());

  useEffect(() => {
    let live = true;
    void readHistory().then((h) => live && setHistory(h));
    return () => {
      live = false;
    };
  }, []);

  const pick = useMemo(() => {
    if (!history) return null;
    const existing = history.find((h) => h.day === today);
    if (existing) {
      const t = catalog.find((c) => c.id === existing.trackId) ?? ranked.find((c) => c.id === existing.trackId);
      if (t) return t;
    }
    // the same stretch of the ranked deck the scheduler picks from
    return pickForDay(ranked.slice(1, 120), history, today, exclude);
  }, [history, today, catalog, ranked, exclude]);

  useEffect(() => {
    if (!pick || !history || history.some((h) => h.day === today)) return;
    const next = [...pruneHistory(history, today), { day: today, trackId: pick.id }];
    setHistory(next);
    void writeHistory(next);
  }, [pick, history, today]);

  return pick;
}
