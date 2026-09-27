import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { notificationTimes, planDays, type HookPick } from "./hookOfDay";
import type { Track } from "../types";

/**
 * Hook of the day on the phone: local notifications only.
 *
 * No push service, no token, nothing sent to a server — the next seven days
 * of picks (lib/hookOfDay.ts) are scheduled on the device at the listener's
 * chosen time, and rescheduled whenever the app opens so the picks stay fresh.
 * Scheduling uses plain date triggers, so the app never asks for Android's
 * restricted exact-alarm permission. On Android 13+ the POST_NOTIFICATIONS
 * prompt only appears after the listener turns this on and reads why.
 */
export const HISTORY_KEY = "hooked.hotd.history";
const SETTINGS_KEY = "hooked.hotd.notify";
const CHANNEL = "hook-of-the-day";
const ID_PREFIX = "hotd-";
const DAYS_AHEAD = 7;

export type HookNotifySettings = { enabled: boolean; hour: number; minute: number; showOnHome: boolean };
export const DEFAULT_NOTIFY: HookNotifySettings = { enabled: false, hour: 20, minute: 0, showOnHome: true };

export async function readNotifySettings(): Promise<HookNotifySettings> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? "null");
    if (v && typeof v === "object") return { ...DEFAULT_NOTIFY, ...v };
  } catch {
    /* fall through */
  }
  return DEFAULT_NOTIFY;
}

const settingsListeners = new Set<(s: HookNotifySettings) => void>();

export async function writeNotifySettings(s: HookNotifySettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s)).catch(() => undefined);
  settingsListeners.forEach((l) => l(s));
}

/** Hear about Settings changes (the Home card and the scheduler both follow them). */
export function onNotifySettings(l: (s: HookNotifySettings) => void): () => void {
  settingsListeners.add(l);
  return () => settingsListeners.delete(l);
}

export async function readHistory(): Promise<HookPick[]> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) ?? "[]");
    return Array.isArray(v) ? v.filter((h) => h && typeof h.day === "string" && typeof h.trackId === "string") : [];
  } catch {
    return [];
  }
}

export async function writeHistory(h: HookPick[]) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(h)).catch(() => undefined);
}

export const notificationsSupported = Platform.OS !== "web";

/** Current permission, without prompting. */
export async function notificationPermission(): Promise<"granted" | "denied" | "undetermined"> {
  if (!notificationsSupported) return "denied";
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

/** Ask the OS (the in-app explanation has already been shown by the caller). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Hook of the day",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

/** Remove every hook-of-the-day notification this app scheduled. */
export async function cancelHookNotifications() {
  if (!notificationsSupported) return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * (Re)schedule the next week of picks. Returns how many were scheduled.
 * `ranked` is the deck's ranked queue; `exclude` is the library.
 */
export async function scheduleHookNotifications(
  ranked: Track[],
  exclude: Set<string>,
  settings: HookNotifySettings,
  text: { title: string },
): Promise<number> {
  if (!notificationsSupported) return 0;
  await cancelHookNotifications();
  if (!settings.enabled || (await notificationPermission()) !== "granted") return 0;

  const now = new Date();
  const times = notificationTimes(now, settings.hour, settings.minute, DAYS_AHEAD);
  const { history, picks } = planDays(ranked.slice(1, 120), await readHistory(), times[0], DAYS_AHEAD, exclude);
  await writeHistory(history);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Hook of the day",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let n = 0;
  for (let i = 0; i < picks.length && i < times.length; i++) {
    const { track, day } = picks[i];
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${day}`,
      content: {
        title: text.title,
        body: `${track.title} — ${track.artist}`,
        data: { trackId: track.id, kind: "hook-of-the-day" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: times[i],
        channelId: CHANNEL,
      },
    });
    n++;
  }
  return n;
}

/** Show the banner even when the app is open (the listener asked for it). */
export function installForegroundHandler() {
  if (!notificationsSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Call back with the song when a hook-of-the-day notification is tapped. */
export function onHookNotificationTap(open: (trackId: string) => void): () => void {
  if (!notificationsSupported) return () => undefined;
  const handle = (r: Notifications.NotificationResponse | null) => {
    const data = r?.notification.request.content.data as { trackId?: unknown; kind?: unknown } | undefined;
    if (data?.kind !== "hook-of-the-day" || typeof data.trackId !== "string") return;
    // otherwise every later cold start would replay yesterday's tap
    Notifications.clearLastNotificationResponse();
    open(data.trackId);
  };
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
