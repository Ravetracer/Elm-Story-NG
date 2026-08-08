import { ipcRenderer } from 'electron'

import React, { useContext, useEffect, useState } from 'react'

import getWorldDataJSON from '../../lib/getWorldDataJSON'
import { WINDOW_EVENT_TYPE } from '../../lib/events'
import { WORLD_EXPORT_TYPE } from '../../data/types'
import { formatAssetBytes } from '../../lib/assets'
import {
  StorageStatus,
  formatTimeAgo,
  getStorageStatus,
  getWorldLastExport,
  isBackupStale,
  recordWorldExport,
  requestPersistentStorage
} from '../../lib/storageDurability'

import { AppContext, APP_LOCATION } from '../../contexts/AppContext'

import { ExclamationCircleFilled } from '@ant-design/icons'

import styles from './styles.module.less'

/**
 * The web build's storage-durability chrome (TODO §10). Rendered only in the
 * browser build — see App.tsx's IS_WEB_BUILD guard and lib/storageDurability for
 * why the desktop app needs none of this.
 *
 * One slim bottom bar, one message at a time:
 *
 * - **Persistence warning** (anywhere): the origin's storage is still evictable,
 *   so the author's storyworlds could vanish. Takes precedence — it is the larger
 *   risk and the reminder below assumes data that still exists.
 * - **Backup reminder** (composer, a world open): that world has no re-importable
 *   export, or a stale one, with a one-click ZIP backup. No file is ever written
 *   without the click — a browser piles up or throttles silent downloads, and
 *   unattended files are hostile.
 */
const StorageBanner: React.FC = () => {
  const { app } = useContext(AppContext)

  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [persistDismissed, setPersistDismissed] = useState(false)
  // the world id whose reminder was dismissed this session, so "Later" silences
  // only the world it was clicked for
  const [reminderDismissedFor, setReminderDismissedFor] = useState<
    string | null
  >(null)
  const [lastExport, setLastExport] = useState<number | undefined>(undefined)
  const [exporting, setExporting] = useState(false)

  // Ask for persistence once on mount, then read where it landed.
  useEffect(() => {
    let active = true

    ;(async () => {
      await requestPersistentStorage()

      const next = await getStorageStatus()

      if (active) setStatus(next)
    })()

    return () => {
      active = false
    }
  }, [])

  // Refresh the current world's last-backup time whenever the open world changes.
  useEffect(() => {
    setLastExport(
      app.selectedWorldId ? getWorldLastExport(app.selectedWorldId) : undefined
    )
  }, [app.selectedWorldId])

  const studioId = app.selectedStudioId
  const worldId = app.selectedWorldId
  const inComposer = app.location === APP_LOCATION.COMPOSER

  const showPersistWarning =
    status !== null && status.supported && !status.persisted && !persistDismissed

  const showReminder =
    !showPersistWarning &&
    inComposer &&
    !!worldId &&
    reminderDismissedFor !== worldId &&
    isBackupStale(lastExport, Date.now())

  const enablePersistence = async () => {
    await requestPersistentStorage()

    setStatus(await getStorageStatus())
  }

  const exportBackup = async () => {
    if (!studioId || !worldId) return

    setExporting(true)

    try {
      const data = await getWorldDataJSON(studioId, worldId, app.version, false)

      await ipcRenderer.invoke(WINDOW_EVENT_TYPE.EXPORT_WORLD_START, {
        type: WORLD_EXPORT_TYPE.ZIP,
        data
      })

      const now = Date.now()

      recordWorldExport(worldId, now)
      setLastExport(now)
    } finally {
      setExporting(false)
    }
  }

  if (!showPersistWarning && !showReminder) return null

  const usage =
    status?.usage !== undefined ? formatAssetBytes(status.usage) : null

  return (
    <div
      className={`${styles.storageBanner} ${
        showPersistWarning ? styles.warning : ''
      }`}
    >
      <ExclamationCircleFilled className={styles.icon} />

      {showPersistWarning ? (
        <>
          <span className={styles.message}>
            Storage isn&apos;t persistent{usage ? ` (${usage} used)` : ''} — the
            browser could evict your storyworlds without warning. Export backups
            you can re-import.
          </span>

          <button className={styles.primary} onClick={enablePersistence}>
            Enable persistence
          </button>
          <button
            className={styles.secondary}
            onClick={() => setPersistDismissed(true)}
          >
            Dismiss
          </button>
        </>
      ) : (
        <>
          <span className={styles.message}>
            {lastExport
              ? `Last backup of this storyworld was ${formatTimeAgo(
                  lastExport,
                  Date.now()
                )}.`
              : 'This storyworld has never been backed up.'}{' '}
            A browser can lose it — export a copy you can re-import.
          </span>

          <button
            className={styles.primary}
            disabled={exporting}
            onClick={exportBackup}
          >
            {exporting ? 'Exporting…' : 'Export backup ZIP'}
          </button>
          <button
            className={styles.secondary}
            onClick={() => worldId && setReminderDismissedFor(worldId)}
          >
            Later
          </button>
        </>
      )}
    </div>
  )
}

export default StorageBanner
