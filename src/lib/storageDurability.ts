/**
 * Storage durability for the browser build (TODO §10).
 *
 * The desktop app keeps a storyworld in Electron's own persistent storage; the
 * browser build keeps it in an **origin's** IndexedDB, which the browser is free
 * to *evict* — Safari after roughly seven idle days, Chromium under storage
 * pressure — with no warning and no recovery. An author's half-written novel can
 * simply vanish. Two defences, both here:
 *
 * 1. Ask for persistent storage (`navigator.storage.persist()`), which moves the
 *    origin out of the evictable bucket. The browser may still decline.
 * 2. Because it may decline, treat an exported, re-importable copy as the real
 *    backup and nag when the open storyworld has none or a stale one.
 *
 * Everything here is guarded by `IS_WEB_BUILD` at its call sites — the desktop
 * build needs none of it. The pure helpers (`isBackupStale`, `formatTimeAgo`) are
 * exported for `src/__tests__/storageDurability.test.ts`.
 */

// Replaced by Vite: true in the browser build, false in the desktop renderer.
// The `typeof` guard keeps this safe under Vitest, where the define is absent.
export const IS_WEB_BUILD =
  typeof __ESG_WEB__ !== 'undefined' && __ESG_WEB__ === true

// Per-world timestamp of the last re-importable export, keyed by world id.
const LAST_EXPORT_KEY = 'esg-world-last-export'

// A backup older than this — or none at all — is stale, and the composer nags.
// Kept to a day because a day-old backup is a day of writing an eviction loses.
export const BACKUP_STALE_MS = 24 * 60 * 60 * 1000

export interface StorageStatus {
  // false when the Storage API is absent (older browsers): nothing to report.
  supported: boolean
  persisted: boolean
  usage?: number
  quota?: number
}

/**
 * Ask the browser to make this origin's storage persistent. Idempotent — returns
 * true immediately if it already is. Never throws; a false means "still
 * evictable", which is the state the warning banner exists for.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (!navigator.storage?.persist) return false

  try {
    if (await navigator.storage.persisted()) return true

    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export const getStorageStatus = async (): Promise<StorageStatus> => {
  if (!navigator.storage?.persisted) {
    return { supported: false, persisted: false }
  }

  try {
    const persisted = await navigator.storage.persisted()
    const estimate = navigator.storage.estimate
      ? await navigator.storage.estimate()
      : {}

    return {
      supported: true,
      persisted,
      usage: estimate.usage,
      quota: estimate.quota
    }
  } catch {
    return { supported: false, persisted: false }
  }
}

type LastExportMap = Record<string, number>

const readLastExportMap = (): LastExportMap => {
  try {
    const raw = localStorage.getItem(LAST_EXPORT_KEY)

    return raw ? (JSON.parse(raw) as LastExportMap) : {}
  } catch {
    return {}
  }
}

export const recordWorldExport = (worldId: string, at: number): void => {
  try {
    const map = readLastExportMap()

    map[worldId] = at

    localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(map))
  } catch {
    // localStorage can throw (private mode, quota). A lost timestamp only makes
    // the banner over-nag, which is the safe direction to fail.
  }
}

export const getWorldLastExport = (worldId: string): number | undefined =>
  readLastExportMap()[worldId]

/**
 * Pure so the nag can be tested without a clock. `undefined` (never exported) is
 * stale by definition — a world with no backup at all is exactly what to warn
 * about.
 */
export const isBackupStale = (
  lastExport: number | undefined,
  now: number,
  thresholdMs = BACKUP_STALE_MS
): boolean => lastExport === undefined || now - lastExport > thresholdMs

/**
 * A coarse "N ago" for the banner, pure for the same reason. Only ever describes
 * the past, so a negative delta (clock skew) reads as "just now".
 */
export const formatTimeAgo = (from: number, now: number): string => {
  const seconds = Math.max(0, Math.floor((now - from) / 1000))

  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
