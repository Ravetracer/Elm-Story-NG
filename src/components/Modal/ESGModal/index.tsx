import { ipcRenderer } from 'electron'

import React, { useContext } from 'react'

import { AppContext } from '../../../contexts/AppContext'
import { WINDOW_EVENT_TYPE } from '../../../lib/events'
import { LANDING_URL, REPO_URL } from '../../../lib/links'

import { Modal } from 'antd'

// An editable file rather than the inline component this replaced, so the
// wordmark can be redrawn without touching code. See the notes inside it.
import bannerUrl from './banner.svg'

import styles from './styles.module.less'

/**
 * The info box behind the title bar mark.
 *
 * The only links it carries point at the maintainer's *own* pages — the landing
 * site and the source repository. That distinction is the whole point: the box
 * once held six social icons, the site and the licence, every one of them pointing
 * at an account or a domain belonging to the *original* authors (elmstory.com and
 * docs.elmstory.com no longer resolve; the itch.io, Reddit and Twitch pages that
 * do still answer are the original project's), which is exactly the confusion the
 * rename exists to prevent. Those were all removed. A link to a page the people
 * behind *this* app actually run is the opposite case, so the landing and source
 * links belong here — and nothing pointing at the original authors does.
 *
 * `LICENSE` and `CREDITS` in the repository are where the licence text and the
 * original authors are recorded.
 */
const ESGModal: React.FC<{ visible: boolean; onCancel: () => void }> = ({
  visible = false,
  onCancel
}) => {
  const { app } = useContext(AppContext)

  const openExternal = (url: string) =>
    ipcRenderer.send(WINDOW_EVENT_TYPE.OPEN_EXTERNAL_LINK, [url])

  return (
    <Modal
      visible={visible}
      destroyOnClose
      centered
      onCancel={onCancel}
      footer={null}
      className={styles.ESGModal}
    >
      <div>
        <div className={styles.ESGBanner}>
          <img src={bannerUrl} alt="Elm Story - NG" />
        </div>

        <div className={styles.content}>
          <div className={styles.version}>
            <div>
              <span className={styles.versionHeader}>
                Elm Story - NG Version
              </span>{' '}
              {app.release}
            </div>
            <div>
              {/* the version an exported storyworld is written as, which moves
                  only when the transport schema does */}
              <span className={styles.versionHeader}>Storyworld Schema</span>{' '}
              {app.version}
            </div>
            <div>
              <span className={styles.versionHeader}>Elm Story - NG Build</span>{' '}
              {app.build}
            </div>
          </div>

          <p className={styles.continuation}>
            A continuation of <strong>Elm Story</strong>, which its original
            authors stopped developing at 0.7.0 in April 2022. This is not their
            work and they do not support it.
          </p>

          <div className={styles.links}>
            <a onClick={() => openExternal(LANDING_URL)}>Website</a>
            <a onClick={() => openExternal(REPO_URL)}>Source on GitHub</a>
          </div>
        </div>

        <div className={styles.copyright}>
          <a onClick={() => openExternal(REPO_URL)}>
            Christian Nielebock | Ravetracer
          </a>{' '}
          | GPL-3.0-or-later | see <code>LICENSE</code> and <code>CREDITS</code>
        </div>
      </div>
    </Modal>
  )
}

export default ESGModal
