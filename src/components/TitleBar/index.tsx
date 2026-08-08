import { ipcRenderer } from 'electron'

import React, { useEffect, useRef, useContext, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { WINDOW_EVENT_TYPE } from '../../lib/events'
import { UI_SCALES, uiScalePercentage } from '../../lib/uiScale'
import { PLATFORM_TYPE } from '../../data/types'

import {
  AppContext,
  APP_ACTION_TYPE,
  APP_LOCATION
} from '../../contexts/AppContext'

import { Dropdown, Menu } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  FontSizeOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MinusOutlined,
  QuestionCircleFilled
} from '@ant-design/icons'

import { ESGModal } from '../Modal'
import { HelpModal } from '../ElementHelp'

// An editable file rather than the inline component this replaced, so the mark
// can be redrawn without touching code. See the notes inside it.
import markUrl from './mark.svg'

import styles from './styles.module.less'

enum TITLE_BAR_BUTTON_TYPE {
  FLOATING = 'FLOATING',
  FULLSCREEN = 'FULLSCREEN',
  HELP = 'HELP',
  MENU = 'MENU',
  MINIMIZE = 'MINIMIZE',
  QUIT = 'QUIT',
  UI_SCALE = 'UI_SCALE'
}

/**
 * Mirrors .titleBarButton's width and .titleBarButtonsContainer's offset in
 * styles.module.less. The drag region has to start clear of whichever buttons
 * are showing, and both are absolutely positioned, so the two cannot be derived
 * from one another in CSS alone.
 */
const TITLE_BAR_BUTTON_WIDTH = 23,
  TITLE_BAR_BUTTONS_OFFSET = 10,
  // the mark on the opposite corner, at its own 15px offset. It has to clear
  // mark.svg's own width or the drag region covers it and the info box stops
  // opening.
  TITLE_BAR_MARK_WIDTH = 22,
  TITLE_BAR_ICON_WIDTH = TITLE_BAR_MARK_WIDTH + 15

interface TitleBarButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  type: TITLE_BAR_BUTTON_TYPE
}

/**
 * A forwardRef component rather than a plain one because antd's Dropdown clones
 * its child to attach a ref and its own handlers. A function component would
 * take neither, so the UI size menu would never open or position itself.
 */
const TitleBarButton = React.forwardRef<HTMLDivElement, TitleBarButtonProps>(
  ({ type, ...props }, ref) => {
    let buttonTitle,
      buttonIcon: JSX.Element = <></>

    switch (type) {
      case TITLE_BAR_BUTTON_TYPE.QUIT:
        buttonIcon = <CloseOutlined />
        buttonTitle = 'Quit'
        break
      case TITLE_BAR_BUTTON_TYPE.MINIMIZE:
        buttonIcon = <MinusOutlined />
        buttonTitle = 'Minimize'
        break
      case TITLE_BAR_BUTTON_TYPE.FULLSCREEN:
        buttonIcon = <FullscreenOutlined />
        buttonTitle = 'Enter Fullscreen'
        break
      case TITLE_BAR_BUTTON_TYPE.FLOATING:
        buttonIcon = <FullscreenExitOutlined />
        buttonTitle = 'Exit Fullscreen'
        break
      case TITLE_BAR_BUTTON_TYPE.HELP:
        buttonIcon = <QuestionCircleFilled />
        buttonTitle = 'Help'
        break
      case TITLE_BAR_BUTTON_TYPE.MENU:
        buttonTitle = 'Menu'
        break
      case TITLE_BAR_BUTTON_TYPE.UI_SCALE:
        buttonIcon = <FontSizeOutlined />
        buttonTitle = 'UI Size'
        break
      default:
        throw new Error('Unable to generate TitleBarButton. Missing type.')
    }

    return (
      <div
        {...props}
        ref={ref}
        className={`${styles.titleBarButton} ${
          type === TITLE_BAR_BUTTON_TYPE.HELP ? styles.helpButton : ''
        }`}
        title={buttonTitle}
      >
        {buttonIcon}
      </div>
    )
  }
)

TitleBarButton.displayName = 'TitleBarButton'

const TitleBar: React.FC = () => {
  const { pathname } = useLocation()
  const { app, appDispatch } = useContext(AppContext)
  /**
   * TODO: this is used to prevent toggling out of full screen
   * on development reload
   */
  const isFirstRun = useRef(true)

  const [esgModalVisible, setESGModalVisible] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [appLocationTitle, setAppLocationTitle] = useState<
      'DASHBOARD' | 'COMPOSER'
    >('DASHBOARD')

  const titleBarButtonData = [
    {
      type: TITLE_BAR_BUTTON_TYPE.QUIT,
      onClick: () => ipcRenderer.send(WINDOW_EVENT_TYPE.QUIT)
    },
    {
      type: TITLE_BAR_BUTTON_TYPE.MINIMIZE,
      onClick: () => ipcRenderer.send(WINDOW_EVENT_TYPE.MINIMIZE)
    },
    {
      type: app.fullscreen
        ? TITLE_BAR_BUTTON_TYPE.FLOATING
        : TITLE_BAR_BUTTON_TYPE.FULLSCREEN,
      onClick: () =>
        appDispatch({
          type: app.fullscreen
            ? APP_ACTION_TYPE.FLOATING
            : APP_ACTION_TYPE.FULLSCREEN
        })
    },
    {
      // The Help button opened docs.elmstory.com, which no longer resolves. It
      // now opens the in-app overview for wherever the author is — the same
      // content a docs site would carry, kept accurate against the code in
      // ElementHelp/content.tsx.
      type: TITLE_BAR_BUTTON_TYPE.HELP,
      onClick: () => setHelpOpen(true)
    },
    { type: TITLE_BAR_BUTTON_TYPE.UI_SCALE }
  ]

  // minimizing a window that has no frame to restore it from would strand the
  // author, so that button is dropped in fullscreen
  const visibleButtonData = titleBarButtonData.filter(
    ({ type }) => type !== TITLE_BAR_BUTTON_TYPE.MINIMIZE || !app.fullscreen
  )

  const buttonsOnLeft = app.platform === PLATFORM_TYPE.MACOS,
    // the platform's own window controls sit on the opposite side, so the order
    // is mirrored to keep quit outermost
    orderedButtonData = buttonsOnLeft
      ? visibleButtonData
      : [...visibleButtonData].reverse(),
    // plus the pixel of slack the 103px this replaced also had
    buttonsWidth =
      TITLE_BAR_BUTTONS_OFFSET +
      visibleButtonData.length * TITLE_BAR_BUTTON_WIDTH +
      1

  const uiScaleMenu = (
    <Menu
      className={styles.uiScaleMenu}
      onClick={({ key }) =>
        appDispatch({
          type: APP_ACTION_TYPE.SET_UI_SCALE,
          uiScale: Number.parseFloat(`${key}`)
        })
      }
    >
      {/* antd's Dropdown clones the menu with selectable: false, so the active
          size is marked by a check of its own rather than by selectedKeys */}
      <Menu.ItemGroup title="UI Size">
        {UI_SCALES.map(({ label, scale }) => (
          <Menu.Item key={`${scale}`}>
            <div
              className={`${styles.uiScaleRow} ${
                scale === app.uiScale ? styles.uiScaleRowActive : ''
              }`}
            >
              <span className={styles.uiScaleCheck}>
                {scale === app.uiScale && <CheckOutlined />}
              </span>
              <span className={styles.uiScaleLabel}>{label}</span>
              <span className={styles.uiScalePercentage}>
                {uiScalePercentage(scale)}
              </span>
            </div>
          </Menu.Item>
        ))}
      </Menu.ItemGroup>

      <Menu.Divider />

      {/* the View menu these accelerators live on is not rendered: the window
          is frameless, so this is the only place they are written down */}
      <Menu.Item key="hint" className={styles.uiScaleHint} disabled>
        {app.platform === PLATFORM_TYPE.MACOS ? 'Cmd' : 'Ctrl'}+Alt+ + / &minus;
        / 0
      </Menu.Item>
    </Menu>
  )

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
    } else {
      ipcRenderer.send(WINDOW_EVENT_TYPE.TOGGLE_FULLSCREEN, app.fullscreen)
    }
  }, [app.fullscreen])

  useEffect(() => {
    ipcRenderer.on(WINDOW_EVENT_TYPE.FULLSCREEN, () =>
      appDispatch({ type: APP_ACTION_TYPE.FULLSCREEN })
    )
    ipcRenderer.on(WINDOW_EVENT_TYPE.FLOAT, () =>
      appDispatch({ type: APP_ACTION_TYPE.FLOATING })
    )
  }, [])

  // The native Help menu (rendered on macOS; the frameless window hides it
  // elsewhere) opens the same in-app overview as the title bar's Help button.
  useEffect(() => {
    const onOpenHelp = () => setHelpOpen(true)

    ipcRenderer.on(WINDOW_EVENT_TYPE.OPEN_HELP, onOpenHelp)

    return () => {
      ipcRenderer.removeListener(WINDOW_EVENT_TYPE.OPEN_HELP, onOpenHelp)
    }
  }, [])

  useEffect(() => {
    switch (pathname) {
      case APP_LOCATION.DASHBOARD:
        appDispatch({
          type: APP_ACTION_TYPE.SET_LOCATION,
          location: APP_LOCATION.DASHBOARD
        })

        setAppLocationTitle('DASHBOARD')
        break
      case APP_LOCATION.COMPOSER:
        appDispatch({
          type: APP_ACTION_TYPE.SET_LOCATION,
          location: APP_LOCATION.COMPOSER
        })

        setAppLocationTitle('COMPOSER')
        break
      default:
        break
    }
  }, [pathname])

  return (
    <>
      <ESGModal
        visible={esgModalVisible}
        onCancel={() => setESGModalVisible(false)}
      />

      <HelpModal
        topic={
          app.location === APP_LOCATION.COMPOSER
            ? 'OVERVIEW_COMPOSER'
            : 'OVERVIEW_DASHBOARD'
        }
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />

      <div className={styles.titleBar}>
        {!app.fullscreen && (
          <div
            className={styles.dragBar}
            style={{
              left: buttonsOnLeft
                ? `${buttonsWidth}px`
                : `${TITLE_BAR_ICON_WIDTH}px`,
              right: buttonsOnLeft
                ? `${TITLE_BAR_ICON_WIDTH}px`
                : `${buttonsWidth}px`
            }}
          />
        )}

        <div
          className={styles.titleBarButtonsContainer}
          style={{
            left: buttonsOnLeft ? `${TITLE_BAR_BUTTONS_OFFSET}px` : 'initial',
            right: buttonsOnLeft ? 'initial' : `${TITLE_BAR_BUTTONS_OFFSET}px`
          }}
        >
          {orderedButtonData.map(({ type, onClick }) =>
            type === TITLE_BAR_BUTTON_TYPE.UI_SCALE ? (
              <Dropdown
                key={type}
                overlay={uiScaleMenu}
                trigger={['click']}
                placement={buttonsOnLeft ? 'bottomLeft' : 'bottomRight'}
              >
                <TitleBarButton type={type} />
              </Dropdown>
            ) : (
              <TitleBarButton key={type} type={type} onClick={onClick} />
            )
          )}

          {/* #137 */}
          {/* <TitleBarButton
          type={TITLE_BAR_BUTTON_TYPE.MENU}
          onClick={() =>
            appDispatch({
              type: app.menuOpen
                ? APP_ACTION_TYPE.MENU_CLOSE
                : APP_ACTION_TYPE.MENU_OPEN
            })
          }
        /> */}
        </div>

        <header>ELM STORY - NG : {appLocationTitle}</header>

        <div
          className={styles.titleBarIcon}
          style={{
            right: app.platform === PLATFORM_TYPE.MACOS ? '15px' : 'initial',
            left: app.platform !== PLATFORM_TYPE.MACOS ? '15px' : 'initial'
          }}
          onClick={() => setESGModalVisible(true)}
          title="About Elm Story - NG"
        >
          <img src={markUrl} width={TITLE_BAR_MARK_WIDTH} alt="" />
        </div>
      </div>
    </>
  )
}

export default TitleBar
