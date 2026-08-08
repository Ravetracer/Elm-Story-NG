import {
  app,
  Menu,
  BrowserWindow,
  MenuItemConstructorOptions,
  WebContents
} from 'electron'

import { WINDOW_EVENT_TYPE, ZOOM_UI_TYPE } from './lib/events'

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string
  submenu?: DarwinMenuItemConstructorOptions[] | Menu
}

/**
 * elmstorygames/feedback#284
 *
 * The zoom factor itself is set by the renderer (see lib/uiScale.ts), which
 * owns the UI scale preference, persists it and shows it in the title bar. The
 * accelerators only ask for a step, so the keyboard and the picker cannot
 * report different sizes and a step survives a restart.
 */
const zoomUI = (webContents: WebContents, zoomType: ZOOM_UI_TYPE) =>
  webContents.send(WINDOW_EVENT_TYPE.ZOOM_UI, [zoomType])

export default class MenuBuilder {
  mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  buildMenu(): Menu {
    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate()

    const menu = Menu.buildFromTemplate(template)

    Menu.setApplicationMenu(menu)

    return menu
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'Elm Story - NG',
      submenu: [
        {
          label: 'Hide Elm Story - NG',
          accelerator: 'CmdOrCtrl+H',
          selector: 'hide:'
        },
        {
          label: 'Hide Others',
          accelerator: 'CmdOrCtrl+Shift+H',
          selector: 'hideOtherApplications:'
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    }

    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          selector: 'cut:'
        },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          selector: 'selectAll:'
        }
      ]
    }

    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Zoom UI In',
          accelerator: 'CmdOrCtrl+Alt+=',
          click: () => zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.IN)
        },
        {
          label: 'Zoom UI Out',
          accelerator: 'CmdOrCtrl+Alt+-',
          click: () => zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.OUT)
        },
        {
          label: 'Reset UI Zoom',
          accelerator: 'CmdOrCtrl+Alt+0',
          click: () => zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.RESET)
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => this.mainWindow.webContents.reload()
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () =>
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen())
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+CmdOrCtrl+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools()
          }
        }
      ]
    }

    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Zoom UI In',
          accelerator: 'CmdOrCtrl+Alt+=',
          click: () => zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.IN)
        },

        {
          label: 'Zoom UI Out',
          accelerator: 'CmdOrCtrl+Alt+-',
          click: () => zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.OUT)
        },
        {
          label: 'Reset UI Zoom',
          accelerator: 'CmdOrCtrl+Alt+0',
          click: () => zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.RESET)
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => this.mainWindow.webContents.reload()
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+CmdOrCtrl+F',
          click: () =>
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen())
        }
        // #DEV - test prod builds
        // {
        //   label: 'Toggle Developer Tools',
        //   accelerator: 'Alt+CmdOrCtrl+I',
        //   click: () => this.mainWindow.webContents.toggleDevTools()
        // }
      ]
    }

    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          selector: 'performMiniaturize:'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () =>
            this.mainWindow.webContents.send(
              WINDOW_EVENT_TYPE.CLOSE_TAB_OR_WINDOW
            )
        },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' }
      ]
    }

    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          // Opens the in-app overview, replacing the dead elmstory.com "Help"
          // and "Community" links. Same reasoning as ESGModal: a link to a page
          // the maintainers do not run is worse than none, and the help lives in
          // the app now (ElementHelp).
          label: 'Overview',
          click: () =>
            this.mainWindow.webContents.send(WINDOW_EVENT_TYPE.OPEN_HELP)
        }
      ]
    }

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp]
  }

  buildDefaultTemplate() {
    const templateDefault: MenuItemConstructorOptions[] = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Open',
            accelerator: 'CmdOrCtrl+O'
          },
          {
            label: '&Close',
            accelerator: 'CmdOrCtrl+W',
            click: () =>
              this.mainWindow.webContents.send(
                WINDOW_EVENT_TYPE.CLOSE_TAB_OR_WINDOW
              )
          }
        ]
      },
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
            ? [
                {
                  label: 'Zoom UI In',
                  accelerator: 'CmdOrCtrl+Alt+=',
                  click: () =>
                    zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.IN)
                },

                {
                  label: 'Zoom UI Out',
                  accelerator: 'CmdOrCtrl+Alt+-',
                  click: () =>
                    zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.OUT)
                },
                {
                  label: 'Reset UI Zoom',
                  accelerator: 'CmdOrCtrl+Alt+0',
                  click: () =>
                    zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.RESET)
                },
                {
                  label: '&Reload',
                  accelerator: 'CmdOrCtrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload()
                  }
                },
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen()
                    )
                  }
                },
                {
                  label: 'Toggle &Developer Tools',
                  accelerator: 'Alt+CmdOrCtrl+I',
                  click: () => {
                    this.mainWindow.webContents.toggleDevTools()
                  }
                }
              ]
            : [
                {
                  label: 'Zoom UI In',
                  accelerator: 'CmdOrCtrl+Alt+=',
                  click: () =>
                    zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.IN)
                },
                {
                  label: 'Zoom UI Out',
                  accelerator: 'CmdOrCtrl+Alt+-',
                  click: () =>
                    zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.OUT)
                },
                {
                  label: 'Reset UI Zoom',
                  accelerator: 'CmdOrCtrl+Alt+0',
                  click: () =>
                    zoomUI(this.mainWindow.webContents, ZOOM_UI_TYPE.RESET)
                },
                {
                  label: '&Reload',
                  accelerator: 'CmdOrCtrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload()
                  }
                },
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen()
                    )
                  }
                }
                // #DEV - test prod builds
                // {
                //   label: 'Toggle &Developer Tools',
                //   accelerator: 'Alt+CmdOrCtrl+I',
                //   click: () => {
                //     this.mainWindow.webContents.toggleDevTools()
                //   }
                // }
              ]
      },
      {
        label: 'Help',
        submenu: [
          {
            // See the note on the Darwin template's Help menu above.
            label: 'Overview',
            click: () =>
              this.mainWindow.webContents.send(WINDOW_EVENT_TYPE.OPEN_HELP)
          }
        ]
      }
    ]

    return templateDefault
  }
}
