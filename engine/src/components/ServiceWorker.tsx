import React, { useEffect, useState } from 'react'

import { useRegisterSW } from 'virtual:pwa-register/react'

import useInterfaceText from '../lib/hooks/useInterfaceText'
import { INTERFACE_TEXT_KEY } from '../lib/interfaceText'


const ServiceWorker: React.FC = () => {
  const t = useInterfaceText()

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered: (r) => {
      r && setInterval(() => r.update(), 60 * 60 * 1000) // 1 hour
    }
  })

  const [updateApp, setUpdateApp] = useState(false)

  useEffect(() => {
    import.meta.env.DEV && !needRefresh && setNeedRefresh(true)
  }, [])

  return (
    <>
      {needRefresh && (
        <div id="world-update-toast">
          <span>{t(
              updateApp
                ? INTERFACE_TEXT_KEY.NOTIFICATION_UPDATING
                : INTERFACE_TEXT_KEY.NOTIFICATION_UPDATE_AVAILABLE
            )}</span>

          <button
            onClick={() => {
              import.meta.env.DEV && setNeedRefresh(false)

              if (!import.meta.env.DEV) {
                setUpdateApp(true)
                updateServiceWorker(true)
              }
            }}
            disabled={updateApp}
          >
            Reload
          </button>
        </div>
      )}
    </>
  )
}

ServiceWorker.displayName = 'ServiceWorker'

export default ServiceWorker
