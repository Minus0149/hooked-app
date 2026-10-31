// Upload a release bundle to Google Play with the Play Developer API, using the
// service account key outside the repo (F:\keystores-backup\hookedcue-play-publisher.json).
//
//   node scripts/play-upload.mjs tracks                       list tracks and their releases (read-only)
//   node scripts/play-upload.mjs upload <file.aab> <track> [notes]   upload + release to <track> (e.g. a closed-testing track)
//   PLAY_MAPPING=<mapping.txt> also uploads the R8 mapping for readable crash reports
//
// Never prints the key. Signs the OAuth assertion with node:crypto (no dependencies).
import fs from "node:fs";
import crypto from "node:crypto";
const KEY = process.env.PLAY_KEY ?? "F:/keystores-backup/hookedcue-play-publisher.json";
const PKG = "com.minus.hookedcue";
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;

async function token() {
  const sa = JSON.parse(fs.readFileSync(KEY, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3000,
  })}`;
  const assertion = `${unsigned}.${crypto.sign("RSA-SHA256", Buffer.from(unsigned), sa.private_key).toString("base64url")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`token: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

async function call(tok, method, url, body, headers = {}) {
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${tok}`, ...(body && !(body instanceof Uint8Array) ? { "content-type": "application/json" } : {}), ...headers },
    body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url.replace(API, "")} -> ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

const [cmd, file, track, notes] = process.argv.slice(2);
const tok = await token();
const edit = await call(tok, "POST", `${API}/edits`, {});
try {
  if (cmd === "tracks") {
    const { tracks } = await call(tok, "GET", `${API}/edits/${edit.id}/tracks`);
    for (const t of tracks ?? []) {
      console.log(t.track, JSON.stringify((t.releases ?? []).map((r) => ({ name: r.name, status: r.status, codes: r.versionCodes }))));
    }
  } else if (cmd === "upload") {
    if (!file || !track) throw new Error("usage: upload <file.aab> <track> [notes]");
    const bytes = new Uint8Array(fs.readFileSync(file));
    const up = await call(tok, "POST", `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}/edits/${edit.id}/bundles?uploadType=media`, bytes, { "content-type": "application/octet-stream" });
    console.log("uploaded versionCode", up.versionCode);
    const mapping = process.env.PLAY_MAPPING;
    if (mapping) {
      await call(tok, "POST", `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}/edits/${edit.id}/apks/${up.versionCode}/deobfuscationFiles/proguard?uploadType=media`, new Uint8Array(fs.readFileSync(mapping)), { "content-type": "application/octet-stream" });
      console.log("uploaded R8 mapping");
    }
    const release = { versionCodes: [String(up.versionCode)], status: "completed", ...(notes ? { releaseNotes: [{ language: "en-US", text: notes }] } : {}) };
    await call(tok, "PUT", `${API}/edits/${edit.id}/tracks/${track}`, { track, releases: [release] });
    const done = await call(tok, "POST", `${API}/edits/${edit.id}:commit`);
    console.log("committed edit", done.id, "→ track", track);
    process.exit(0);
  }
} finally {
  if (cmd !== "upload") await call(tok, "DELETE", `${API}/edits/${edit.id}`).catch(() => {});
}
