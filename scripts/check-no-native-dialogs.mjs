/**
 * Guard: the phone uses its own dialogs (src/components/Dialogs.tsx), never
 * the operating system's. Alert.alert / Alert.prompt put a system box — the
 * OS's font, colours and button layout — in the middle of a dark music app,
 * where it reads as an error from the phone rather than a question from us.
 *
 * Usage: node scripts/check-no-native-dialogs.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["App.tsx", "src"];
const files = [];
const walk = (p) => {
  if (statSync(p).isDirectory()) for (const n of readdirSync(p)) walk(join(p, n));
  else if (/\.(tsx?|jsx?)$/.test(p)) files.push(p);
};
roots.forEach(walk);

const offenders = [];
for (const f of files) {
  const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  if (/\bAlert\.(alert|prompt)\s*\(/.test(code)) offenders.push(f);
}
if (offenders.length) {
  console.error("native dialogs: use useDialogs() from src/components/Dialogs.tsx instead of Alert in:");
  for (const f of offenders) console.error("  - " + f);
  process.exit(1);
}
console.log(`native dialogs: none across ${files.length} files`);
