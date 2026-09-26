import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONVEX_SITE_URL } from "../config/env";
import {
  catalogAction,
  fetchCatalog,
  joinParts,
  type CatalogTrack,
  type CatalogVersion,
} from "./catalogCodec";

/**
 * The catalogue, without the websocket — the phone's twin of web/src/lib/useCatalog.ts.
 *
 * Watches catalog:version and downloads the catalogue's parts over plain HTTP
 * only when that version isn't already stored on the phone. A warm start
 * applies the stored catalogue before the websocket connects and downloads
 * nothing. As tracks.list it was 2 MB as the first message on the websocket,
 * and everything queued behind it waited.
 *
 * Stored as one AsyncStorage key per part (~180 KB each): Android's
 * AsyncStorage refuses a single row near 2 MB, and the catalogue grows nightly.
 */

const PREFIX = "hooked.catalog.v1";
const META_KEY = `${PREFIX}.meta`;
const partKey = (i: number) => `${PREFIX}.part.${i}`;

type Meta = { version: number; parts: number };

async function readCache(): Promise<{ version: number; tracks: CatalogTrack[] } | null> {
  try {
    const meta = JSON.parse((await AsyncStorage.getItem(META_KEY)) ?? "null") as Meta | null;
    if (!meta || !Number.isInteger(meta.parts) || meta.parts <= 0) return null;
    const rows = await AsyncStorage.multiGet(Array.from({ length: meta.parts }, (_, i) => partKey(i)));
    const docs = rows.map(([, raw]) => (raw ? (JSON.parse(raw) as unknown) : null));
    return joinParts(docs);
  } catch {
    return null;
  }
}

async function writeCache(version: number, docs: unknown[]): Promise<void> {
  try {
    const old = JSON.parse((await AsyncStorage.getItem(META_KEY)) ?? "null") as Meta | null;
    // parts first, meta last: a half-written cache is never read as complete
    await AsyncStorage.multiSet(docs.map((d, i) => [partKey(i), JSON.stringify(d)] as [string, string]));
    await AsyncStorage.setItem(META_KEY, JSON.stringify({ version, parts: docs.length } satisfies Meta));
    if (old && old.parts > docs.length) {
      await AsyncStorage.multiRemove(
        Array.from({ length: old.parts - docs.length }, (_, i) => partKey(docs.length + i)),
      );
    }
  } catch {
    // a full or broken store just means downloading again next start
  }
}

/** Calls onCatalog with the full catalogue: from storage at once, then again whenever a new version lands. */
export function useCatalog(onCatalog: (tracks: CatalogTrack[]) => void): void {
  const ver = useQuery(anyApi.catalog.version) as CatalogVersion | undefined;
  const have = useRef<number | null>(null); // version currently applied
  const loaded = useRef(false); // storage has been read (hit or miss)
  const busy = useRef<number | null>(null); // version being downloaded
  const onCatalogRef = useRef(onCatalog);
  useEffect(() => {
    onCatalogRef.current = onCatalog;
  }, [onCatalog]);

  // warm start: the stored catalogue, before anything else answers
  useEffect(() => {
    void readCache().then((cached) => {
      loaded.current = true;
      if (cached && have.current === null) {
        have.current = cached.version;
        onCatalogRef.current(cached.tracks);
      }
    });
  }, []);

  const v = ver?.v;
  const parts = ver?.parts;
  useEffect(() => {
    if (v === undefined || parts === undefined) return;
    const run = async () => {
      // don't race the storage read: a stored copy of this very version means no download
      if (!loaded.current) {
        const cached = await readCache();
        loaded.current = true;
        if (cached && have.current === null) {
          have.current = cached.version;
          onCatalogRef.current(cached.tracks);
        }
      }
      if (catalogAction(have.current, v) !== "fetch" || busy.current === v) return;
      busy.current = v;
      try {
        const got = await fetchCatalog(CONVEX_SITE_URL, { v, parts }, (url, init) => fetch(url, init));
        // the version decides, not timing: an older download finishing late
        // must never replace a newer catalogue
        if (have.current !== null && got.version <= have.current) return;
        have.current = got.version;
        onCatalogRef.current(got.tracks);
        void writeCache(got.version, got.docs);
      } catch {
        // keep dealing what we have; the next version change (or next start) tries again
      } finally {
        if (busy.current === v) busy.current = null;
      }
    };
    void run();
  }, [v, parts]);
}
