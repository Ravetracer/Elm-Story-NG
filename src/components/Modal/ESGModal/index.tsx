import React, { useContext } from 'react'

import { AppContext } from '../../../contexts/AppContext'

import { Modal } from 'antd'

// An editable file rather than the inline component this replaced, so the
// wordmark can be redrawn without touching code. See the notes inside it.
import bannerUrl from './banner.svg'

import styles from './styles.module.less'

/**
 * The info box behind the title bar mark.
 *
 * It carries no links at all, which is deliberate rather than an oversight. It
 * used to hold six social icons, the site and the licence, every one of them
 * pointing at an account or a domain belonging to the original authors:
 * elmstory.com and docs.elmstory.com no longer resolve, the Patreon redirects to
 * Patreon's own front page, the Twitter account is gone, and the itch.io, Reddit
 * and Twitch pages that do still answer are the *original project's* — which is
 * exactly the confusion the rename exists to prevent. A link that sends someone
 * asking for help with this app to a page the people behind it do not run is
 * worse than no link, so the box states what it is and stops there.
 *
 * `LICENSE` and `CREDITS` in the repository are where the licence text and the
 * original authors are recorded.
 */
const ESGModal: React.FC<{ visible: boolean; onCancel: () => void }> = ({
  visible = false,
  onCancel
}) => {
  const { app } = useContext(AppContext)

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
        </div>

        <div className={styles.copyright}>
          &copy; 2022 Elm Story Games LLC | GPL-3.0-or-later | see{' '}
          <code>LICENSE</code> and <code>CREDITS</code>
        </div>
      </div>
    </Modal>
  )
}

export default ESGModal
