/**
 * Guard: the phone and the web app talk to the same backend.
 *
 * A store build has no .env (it's git-ignored, so EAS never uploads it); it
 * runs on the defaults in src/config/env.ts. The web app pins its production
 * backend in web/.env.production. If the two ever name different deployments,
 * a listener's library is on one backend in the browser and another on the
 * phone — and neither app shows an error.
 *
 * Skips cleanly when the web repo isn't checked out beside this one, like the
 * other cross-repo guards.
 *
 * Usage: node scripts/check-backend.mjs [path/to/web]
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const WEB = resolve(process.argv[2] ?? "../web");
let pinned;
try {
  pinned = readFileSync(join(WEB, ".env.production"), "utf8");
} catch {
  console.log(`backend: skipped — no web/.env.production at ${WEB}`);
  process.exit(0);
}

const webValue = (key) =>
  pinned
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${key}=`))
    ?.slice(key.length + 1)
    .trim();

const source = readFileSync("src/config/env.ts", "utf8");
const mobileDefault = (key) => {
  // `process.env.KEY ?? "default"`, read without a regex so escaping can't bite
  const at = source.indexOf(`process.env.${key}`);
  if (at < 0) return undefined;
  const rest = source.slice(at).split("??")[1] ?? "";
  return rest.split('"')[1];
};

const pairs = [
  ["EXPO_PUBLIC_CONVEX_URL", "VITE_CONVEX_URL"],
  ["EXPO_PUBLIC_CONVEX_SITE_URL", "VITE_CONVEX_SITE_URL"],
];
const problems = [];
for (const [mobileKey, webKey] of pairs) {
  const m = mobileDefault(mobileKey);
  const w = webValue(webKey);
  if (!m) problems.push(`src/config/env.ts has no default for ${mobileKey}`);
  else if (!w) problems.push(`web/.env.production has no ${webKey}`);
  else if (m !== w) problems.push(`${mobileKey} defaults to ${m}, but the web app uses ${w}`);
}

if (problems.length) {
  console.error("backend: the two clients point at different backends");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`backend: both clients use ${webValue("VITE_CONVEX_URL")}`);
