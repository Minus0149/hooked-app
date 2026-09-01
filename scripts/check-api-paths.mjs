/**
 * Guard: every `anyApi.<module>.<fn>` this app calls must exist on the server.
 *
 * The web client imports the generated Convex API and gets a compile error the
 * moment a server function is renamed. This app cannot: the backend lives in a
 * different repository (hooked-website), so the calls go through `anyApi`,
 * which by design accepts any path at all. `anyApi.library.setPrefrences` is a
 * perfectly valid expression that fails only when a real person taps the thing
 * — and only on the screen nobody re-tested.
 *
 * This closes the gap without coupling the repos. It reads the server source
 * when the two are checked out side by side (the normal working layout, and
 * what CI can be given), and says so and passes when they are not. A guard
 * that fails on a standalone clone would just get deleted.
 *
 * Usage: node scripts/check-api-paths.mjs [path/to/convex]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const CONVEX = resolve(process.argv[2] ?? "../web/convex");
const SOURCES = ["App.tsx", "src"];

// exported Convex functions: `export const name = query({`, and the mutation,
// action and internal* variants
const EXPORTED =
  /^export const ([A-Za-z_$][\w$]*)\s*=\s*(?:internal)?(?:query|mutation|action|Query|Mutation|Action)\s*\(/gm;
// what this app calls: anyApi.module.fn
const CALLED = /\banyApi\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g;

function walk(path, out = []) {
  let st;
  try {
    st = statSync(path);
  } catch {
    return out;
  }
  if (st.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry === "node_modules" || entry === "android" || entry === ".expo") continue;
      walk(join(path, entry), out);
    }
    return out;
  }
  if ([".ts", ".tsx"].includes(extname(path))) out.push(path);
  return out;
}

let convexFiles;
try {
  convexFiles = readdirSync(CONVEX).filter((f) => f.endsWith(".ts"));
} catch {
  console.log(`api paths: skipped — no server source at ${CONVEX}`);
  console.log("  (check out hooked-website beside this repo to enable this guard)");
  process.exit(0);
}

/** module name -> the functions it exports */
const server = new Map();
for (const file of convexFiles) {
  const module = file.replace(/\.ts$/, "");
  const text = readFileSync(join(CONVEX, file), "utf8");
  const names = new Set();
  for (const m of text.matchAll(EXPORTED)) names.add(m[1]);
  server.set(module, names);
}

const files = SOURCES.flatMap((s) => walk(s, []));
if (files.length === 0) {
  console.error(`api paths: no source found under ${SOURCES.join(", ")} — this guard is looking at nothing`);
  process.exit(1);
}

const problems = [];
const calls = new Set();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(CALLED)) {
    const [, module, fn] = m;
    calls.add(`${module}.${fn}`);
    if (!server.has(module)) {
      problems.push(`${file}: anyApi.${module}.${fn} — no convex/${module}.ts on the server`);
    } else if (!server.get(module).has(fn)) {
      const near = [...server.get(module)].filter((n) => n.toLowerCase().includes(fn.slice(0, 4).toLowerCase()));
      problems.push(
        `${file}: anyApi.${module}.${fn} — ${module}.ts exports no such function` +
          (near.length ? ` (did you mean ${near.join(", ")}?)` : ""),
      );
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(
    `\n${problems.length} call(s) point at a server function that does not exist. ` +
      "These compile, and fail when somebody taps them.",
  );
  process.exit(1);
}

if (calls.size === 0) {
  // The app is built on these calls; matching none means the pattern stopped
  // working, not that the app stopped calling. A guard that passes because it
  // looked at nothing is worse than no guard at all.
  console.error("api paths: matched no anyApi.<module>.<fn> calls — has the call style changed?");
  process.exit(1);
}

console.log(
  `api paths: ${calls.size} call(s) across ${files.length} files resolve against ${server.size} server modules`,
);
