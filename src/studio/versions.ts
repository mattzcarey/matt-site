// Content-addressed version storage for a fork.
//
// A version is a manifest mapping workspace paths to content hashes; file
// bytes live once per hash in blob/<hash> and dedupe across versions (a
// typical turn touches 1-2 files). This replaces the single `versions` array
// of full CSS strings, which breaks under multi-file forks (25 x ~300KB page
// sets would blow the DO's 2MB-per-value cap).
//
// Layout in DO storage:
//   verIndex        -> string[] (ordered version ids, "original" first)
//   currentId       -> the served version id
//   ver/<id>        -> VersionManifest
//   blob/<hash>     -> file content (string)
//
// Revert and post-failure rollback are the same operation: materialize a
// manifest's files into the workspace (deleting workspace files not in it).

import { ROOT } from "./config";

export interface VersionManifest {
  id: string;
  message: string;
  createdAt: number;
  /** workspace path -> sha-256 hex of the file content */
  files: Record<string, string>;
}

export interface VersionSummary {
  id: string;
  short: string;
  message: string;
  current: boolean;
}

// The minimal slice of Workspace the version store needs (structural, so it
// works with @cloudflare/think's Workspace without a direct shell dependency).
export interface WorkspaceFiles {
  glob(pattern: string): Promise<Array<{ path: string; type: string }>>;
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string, mimeType?: string): Promise<void>;
  deleteFile(path: string): Promise<boolean>;
}

export const ORIGINAL_ID = "original";
const INDEX_KEY = "verIndex";
const CURRENT_KEY = "currentId";
const VER_PREFIX = "ver/";
const BLOB_PREFIX = "blob/";
// Cap history so a fork can't grow unbounded ("original" is never evicted).
const MAX_VERSIONS = 25;

async function sha256Hex(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function workspaceFiles(
  ws: WorkspaceFiles,
): Promise<Array<{ path: string; content: string; hash: string }>> {
  const entries = await ws.glob(`${ROOT}/**`);
  const out: Array<{ path: string; content: string; hash: string }> = [];
  for (const entry of entries) {
    if (entry.type !== "file") continue;
    const content = await ws.readFile(entry.path).catch(() => null);
    if (content === null) continue;
    out.push({ path: entry.path, content, hash: await sha256Hex(content) });
  }
  return out;
}

export async function getManifest(
  storage: DurableObjectStorage,
  id: string,
): Promise<VersionManifest | undefined> {
  return storage.get<VersionManifest>(VER_PREFIX + id);
}

export async function currentManifest(
  storage: DurableObjectStorage,
): Promise<VersionManifest | undefined> {
  const currentId = await storage.get<string>(CURRENT_KEY);
  if (!currentId) return undefined;
  return getManifest(storage, currentId);
}

export async function currentVersionId(storage: DurableObjectStorage): Promise<string | undefined> {
  return storage.get<string>(CURRENT_KEY);
}

export async function readBlob(
  storage: DurableObjectStorage,
  hash: string,
): Promise<string | null> {
  return (await storage.get<string>(BLOB_PREFIX + hash)) ?? null;
}

/** Read one file's content out of a manifest (null if the path isn't in it). */
export async function manifestFile(
  storage: DurableObjectStorage,
  manifest: VersionManifest,
  path: string,
): Promise<string | null> {
  const hash = manifest.files[path];
  if (!hash) return null;
  return readBlob(storage, hash);
}

function sameFiles(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((k) => a[k] === b[k]);
}

async function putVersion(
  storage: DurableObjectStorage,
  ws: WorkspaceFiles,
  id: string,
  message: string,
  createdAt: number,
): Promise<VersionManifest | null> {
  const snapshot = await workspaceFiles(ws);
  const files: Record<string, string> = {};
  for (const f of snapshot) files[f.path] = f.hash;

  const current = await currentManifest(storage);
  if (current && sameFiles(current.files, files)) return null;

  const manifest: VersionManifest = { id, message, createdAt, files };
  const writes: Record<string, unknown> = { [VER_PREFIX + id]: manifest };
  for (const f of snapshot) writes[BLOB_PREFIX + f.hash] = f.content;

  const index = (await storage.get<string[]>(INDEX_KEY)) ?? [];
  index.push(id);
  const evicted: string[] = [];
  while (index.length > MAX_VERSIONS) {
    const removed = index.splice(1, 1).at(0);
    if (removed) evicted.push(removed);
  }
  await storage.put(writes);
  await storage.put(INDEX_KEY, index);
  await storage.put(CURRENT_KEY, id);
  if (evicted.length > 0) await gcEvicted(storage, index, evicted);
  return manifest;
}

// Drop evicted manifests and any blobs no remaining manifest references.
async function gcEvicted(
  storage: DurableObjectStorage,
  index: string[],
  evicted: string[],
): Promise<void> {
  const kept = await storage.get<VersionManifest>(index.map((id) => VER_PREFIX + id));
  const referenced = new Set<string>();
  for (const manifest of kept.values()) {
    for (const hash of Object.values(manifest.files)) referenced.add(hash);
  }
  for (const id of evicted) {
    const manifest = await getManifest(storage, id);
    await storage.delete(VER_PREFIX + id);
    if (!manifest) continue;
    for (const hash of Object.values(manifest.files)) {
      if (!referenced.has(hash)) await storage.delete(BLOB_PREFIX + hash);
    }
  }
}

/**
 * Commit the workspace's current state as a new version. Returns null when
 * the workspace is identical to the current version (nothing to commit).
 */
export async function commitVersion(
  storage: DurableObjectStorage,
  ws: WorkspaceFiles,
  message: string,
): Promise<VersionManifest | null> {
  return putVersion(storage, ws, crypto.randomUUID(), message || "Restyle", Date.now());
}

/** Record the freshly seeded workspace as the immutable "original" version. */
export async function seedOriginalVersion(
  storage: DurableObjectStorage,
  ws: WorkspaceFiles,
): Promise<void> {
  await putVersion(storage, ws, ORIGINAL_ID, "Original site", 0);
}

/**
 * Materialize a version into the workspace: write its files, delete workspace
 * files it doesn't contain, and mark it current. Used for both user-initiated
 * revert and post-failure rollback.
 */
export async function materializeVersion(
  storage: DurableObjectStorage,
  ws: WorkspaceFiles,
  id: string,
): Promise<boolean> {
  const manifest = await getManifest(storage, id);
  if (!manifest) return false;
  const existing = await ws.glob(`${ROOT}/**`);
  for (const entry of existing) {
    if (entry.type !== "file") continue;
    if (!(entry.path in manifest.files)) await ws.deleteFile(entry.path).catch(() => false);
  }
  for (const [path, hash] of Object.entries(manifest.files)) {
    const content = await readBlob(storage, hash);
    if (content === null) continue;
    const current = await ws.readFile(path).catch(() => null);
    if (current !== content) await ws.writeFile(path, content);
  }
  await storage.put(CURRENT_KEY, id);
  return true;
}

/** Restore the workspace to the committed (current) version. */
export async function rollbackToCurrent(
  storage: DurableObjectStorage,
  ws: WorkspaceFiles,
): Promise<boolean> {
  const currentId = await storage.get<string>(CURRENT_KEY);
  if (!currentId) return false;
  return materializeVersion(storage, ws, currentId);
}

export async function listVersions(storage: DurableObjectStorage): Promise<VersionSummary[]> {
  const index = (await storage.get<string[]>(INDEX_KEY)) ?? [];
  if (index.length === 0) return [];
  const currentId = await storage.get<string>(CURRENT_KEY);
  const manifests = await storage.get<VersionManifest>(index.map((id) => VER_PREFIX + id));
  const out: VersionSummary[] = [];
  for (const id of index) {
    const manifest = manifests.get(VER_PREFIX + id);
    if (!manifest) continue;
    out.push({
      id,
      short: id === ORIGINAL_ID ? ORIGINAL_ID : id.slice(0, 7),
      message: manifest.message,
      current: id === currentId,
    });
  }
  return out;
}

/** Delete every version key (index, current pointer, manifests, blobs). */
export async function wipeVersions(storage: DurableObjectStorage): Promise<void> {
  await storage.delete(INDEX_KEY);
  await storage.delete(CURRENT_KEY);
  for (const prefix of [VER_PREFIX, BLOB_PREFIX]) {
    const keys = await storage.list({ prefix });
    for (const key of keys.keys()) await storage.delete(key);
  }
}
