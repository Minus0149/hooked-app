import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { detectLang, isLang, translate, type Lang } from "./i18n";

/**
 * The app's language on this phone (same design as web/src/lib/lang.tsx).
 *
 * "auto" follows the phone's language; an explicit pick is stored in
 * AsyncStorage ("hooked.lang") and sticks. Not synced to the account: the
 * same person can want Hindi on the phone and English on a laptop.
 */
const KEY = "hooked.lang";
export type LangSetting = Lang | "auto";

type LangValue = {
  lang: Lang;
  setting: LangSetting;
  setLang: (s: LangSetting) => void;
  t: (text: string, vars?: Record<string, string | number>) => string;
};

const LangContext = createContext<LangValue | null>(null);

function deviceLang(): Lang {
  try {
    return detectLang(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return "en";
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<LangSetting>("auto");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (isLang(v)) setSetting(v);
      })
      .catch(() => undefined);
  }, []);

  const setLang = useCallback((s: LangSetting) => {
    setSetting(s);
    (s === "auto" ? AsyncStorage.removeItem(KEY) : AsyncStorage.setItem(KEY, s)).catch(() => undefined);
  }, []);

  const lang: Lang = setting === "auto" ? deviceLang() : setting;
  const value = useMemo<LangValue>(
    () => ({ lang, setting, setLang, t: (text, vars) => translate(lang, text, vars) }),
    [lang, setting, setLang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** The translator for the current language. Outside a provider it is English. */
export function useLang(): LangValue {
  return (
    useContext(LangContext) ?? {
      lang: "en",
      setting: "auto",
      setLang: () => undefined,
      t: (text, vars) => translate("en", text, vars),
    }
  );
}

export function useT() {
  return useLang().t;
}
