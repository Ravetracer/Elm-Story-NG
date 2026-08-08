import { beforeEach, describe, expect, it } from 'vitest'

import {
  BACKUP_STALE_MS,
  formatTimeAgo,
  getWorldLastExport,
  isBackupStale,
  recordWorldExport
} from '../lib/storageDurability'

/**
 * The browser build's durability nag (lib/storageDurability). The persistence
 * request and estimate need a live Storage API, so they are exercised in the
 * running browser; here the concern is the pure staleness rule, the "N ago"
 * wording, and the per-world last-export bookkeeping the reminder reads.
 */
describe('storage durability', () => {
  const NOW = 1_700_000_000_000

  describe('isBackupStale', () => {
    it('treats a world that has never been exported as stale', () => {
      expect(isBackupStale(undefined, NOW)).toBe(true)
    })

    it('is fresh just under the threshold and stale just over it', () => {
      expect(isBackupStale(NOW - (BACKUP_STALE_MS - 1000), NOW)).toBe(false)
      expect(isBackupStale(NOW - (BACKUP_STALE_MS + 1000), NOW)).toBe(true)
    })

    it('honours a custom threshold', () => {
      expect(isBackupStale(NOW - 5000, NOW, 10_000)).toBe(false)
      expect(isBackupStale(NOW - 20_000, NOW, 10_000)).toBe(true)
    })
  })

  describe('formatTimeAgo', () => {
    it('describes the elapsed time coarsely', () => {
      expect(formatTimeAgo(NOW - 5_000, NOW)).toBe('just now')
      expect(formatTimeAgo(NOW - 60_000, NOW)).toBe('1 minute ago')
      expect(formatTimeAgo(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago')
      expect(formatTimeAgo(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago')
      expect(formatTimeAgo(NOW - 2 * 86_400_000, NOW)).toBe('2 days ago')
    })

    it('reads clock skew as just now rather than a negative time', () => {
      expect(formatTimeAgo(NOW + 10_000, NOW)).toBe('just now')
    })
  })

  describe('per-world last-export bookkeeping', () => {
    beforeEach(() => localStorage.clear())

    it('records and reads a timestamp per world', () => {
      expect(getWorldLastExport('world-1')).toBeUndefined()

      recordWorldExport('world-1', NOW)
      recordWorldExport('world-2', NOW + 1000)

      expect(getWorldLastExport('world-1')).toBe(NOW)
      expect(getWorldLastExport('world-2')).toBe(NOW + 1000)
    })

    it('overwrites a world without disturbing the others', () => {
      recordWorldExport('world-1', NOW)
      recordWorldExport('world-2', NOW)
      recordWorldExport('world-1', NOW + 5000)

      expect(getWorldLastExport('world-1')).toBe(NOW + 5000)
      expect(getWorldLastExport('world-2')).toBe(NOW)
    })
  })
})
