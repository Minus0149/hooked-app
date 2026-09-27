import { SettingsPage } from "./SettingsPage";
import { Block, Segmented } from "./kit";
import { useLang, type LangSetting } from "../../lib/lang";

const OPTIONS: { id: LangSetting; label: string }[] = [
  { id: "auto", label: "Follow my phone" },
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
];

/** Settings → App language (web: LanguagePage in SettingsScreen). Stored on this phone only. */
export function LanguagePage({ onBack }: { onBack: () => void }) {
  const { setting, setLang } = useLang();
  return (
    <SettingsPage title="App language" onBack={onBack}>
      <Block>
        <Segmented<LangSetting> options={OPTIONS} value={setting} onChange={setLang} />
      </Block>
    </SettingsPage>
  );
}
