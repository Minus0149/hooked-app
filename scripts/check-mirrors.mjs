/**
 * Guard: the shared data modules are byte-identical across the two clients.
 *
 * `taste.ts`, `ranking.ts`, `mood.ts` and `predict.ts` are the product's
 * judgement — what a mood means, how much a save is worth, how a pool is
 * ordered. `lib/authGate.ts` decides when a new account's profile may be
 * created; drift there is a sign-up that silently never syncs on one client. They exist twice because the two apps have separate bundles, and
 * nothing in either toolchain notices when one copy is edited and the other is
 * not. The failure is silent and slow: the phone and the browser rank the same
 * catalogue differently, which is two products wearing one name.
 *
 * Every difference is a real difference, with exactly one allowance: the header
 * comment says "Mirrored in web/…" on one side and "Mirrored from web/…" on the
 * other, because each file should point at the other.
 *
 * Skips cleanly when the server/web repo isn't checked out beside this one, for
 * the same reason check-api-paths.mjs does — a guard that fails on a standalone
 * clone gets deleted rather than fixed.
 *
 * Usage: node scripts/check-mirrors.mjs [path/to/web]
 */
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const WEB = resolve(process.argv[2] ?? "../web");
// paths under src/
const MODULES = [
  "data/taste.ts",
  "data/ranking.ts",
  "data/mood.ts",
  "data/predict.ts",
  "lib/authGate.ts",
  "data/sound.ts",
  "lib/playlistMood.ts",
  "lib/contrast.ts",
  "lib/accessApply.ts",
  "lib/accountDeletion.ts",
  "lib/tourCopy.ts",
  "lib/volume.ts",
  "lib/authForms.ts",
  "lib/contentReport.ts",
  "lib/backdrop.ts",
  "lib/attribution.ts",
  "lib/catalogCodec.ts",
];

try {
  statSync(join(WEB, "src/data"));
} catch {
  console.log(`mirrors: skipped — no web client at ${WEB}`);
  console.log("  (check out the web repo beside this one to enable this guard)");
  process.exit(0);
}

/** The one sanctioned difference: each copy points at the other. */
const normalise = (text) =>
  text
    .replace(/Mirrored (?:in|from) (?:web|mobile)\//g, "Mirrored <other>/")
    .replace(/\r\n/g, "\n")
    .replace(/^﻿/, "");

const problems = [];
let checked = 0;

for (const name of MODULES) {
  let here;
  let there;
  try {
    here = readFileSync(join("src", name), "utf8");
  } catch {
    problems.push(`src/${name} is missing from this app`);
    continue;
  }
  try {
    there = readFileSync(join(WEB, "src", name), "utf8");
  } catch {
    problems.push(`web/src/${name} is missing — was it renamed on one side?`);
    continue;
  }
  checked++;

  const a = normalise(here).split("\n");
  const b = normalise(there).split("\n");
  if (a.join("\n") === b.join("\n")) continue;

  // Report the first divergence with its line number: "they differ" sends you
  // to a diff tool, a line number sends you to the edit somebody forgot.
  const upto = Math.max(a.length, b.length);
  for (let i = 0; i < upto; i++) {
    if (a[i] === b[i]) continue;
    problems.push(
      `src/${name} and web/src/${name} diverge at line ${i + 1}\n` +
        `      mobile: ${(a[i] ?? "<end of file>").trim().slice(0, 90)}\n` +
        `      web:    ${(b[i] ?? "<end of file>").trim().slice(0, 90)}`,
    );
    break;
  }
}

if (checked === 0) {
  console.error("mirrors: compared nothing — has src/data moved?");
  process.exit(1);
}

if (problems.length > 0) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(
    `\n${problems.length} shared module(s) out of sync. Both clients must rank ` +
      "the same catalogue the same way; copy the change across rather than " +
      "letting the two drift.",
  );
  process.exit(1);
}

console.log(`mirrors: ${checked} shared module(s) identical across both clients`);
