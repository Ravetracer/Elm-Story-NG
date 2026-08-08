import { ipcRenderer } from 'electron'
import React, { useContext, useEffect } from 'react'
import { usePageVisibility } from 'react-page-visibility'

import { WINDOW_EVENT_TYPE, ZOOM_UI_TYPE } from './lib/events'
import { applyUIScale, saveUIScale } from './lib/uiScale'

import { IS_WEB_BUILD } from './lib/storageDurability'

import { AppContext, APP_ACTION_TYPE } from './contexts/AppContext'

import Routes from './routes'

import TitleBar from './components/TitleBar'
import AppMenu from './components/AppMenu'
import StorageBanner from './components/StorageBanner'

import './App.global.less'

const App: React.FC = () => {
  const { app, appDispatch } = useContext(AppContext)

  const visible = usePageVisibility()

  useEffect(() => {
    appDispatch({ type: APP_ACTION_TYPE.SET_VISIBLE, visible })
  }, [visible])

  useEffect(() => {
    ipcRenderer.on(WINDOW_EVENT_TYPE.PLATFORM, (_, [platform]) =>
      appDispatch({ type: APP_ACTION_TYPE.PLATFORM, platform })
    )
  }, [])

  // the View menu's zoom accelerators are handled here rather than in the title
  // bar, which mounts only once the platform has arrived over IPC
  useEffect(() => {
    const onZoomUI = (_: unknown, [zoomType]: [ZOOM_UI_TYPE]) =>
      appDispatch({ type: APP_ACTION_TYPE.STEP_UI_SCALE, zoomType })

    ipcRenderer.on(WINDOW_EVENT_TYPE.ZOOM_UI, onZoomUI)

    return () => {
      ipcRenderer.removeListener(WINDOW_EVENT_TYPE.ZOOM_UI, onZoomUI)
    }
  }, [])

  // one place applies and stores the scale, whether it was changed from the
  // title bar picker or by an accelerator
  useEffect(() => {
    applyUIScale(app.uiScale)
    saveUIScale(app.uiScale)
  }, [app.uiScale])

  return (
    <>
      {app.platform && (
        <>
          <Routes />

          <TitleBar />
          <AppMenu />

          {/* Web build only: the origin's IndexedDB can be evicted, so this
              requests persistence and nags to export re-importable backups. */}
          {IS_WEB_BUILD && <StorageBanner />}
        </>
      )}
    </>
  )
}

export default App
