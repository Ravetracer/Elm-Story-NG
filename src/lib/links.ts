/**
 * The project's public web addresses, used by the About box and anywhere else the
 * app links out. These are the maintainer's own pages — which is what makes them
 * safe to link, unlike the original authors' dead/foreign links the About box
 * deliberately dropped (see ESGModal's note).
 *
 * Open them with `ipcRenderer.send(WINDOW_EVENT_TYPE.OPEN_EXTERNAL_LINK, [url])`,
 * which is `shell.openExternal` on the desktop and `window.open` in the browser
 * build.
 */

// The landing + documentation site.
export const LANDING_URL = 'https://elm-story-ng.ravetracer.de'

// The deployed browser editor (the web build).
export const EDITOR_URL = 'https://elm-story-ng-edit.ravetracer.de'

// Source and releases.
export const REPO_URL = 'https://github.com/Ravetracer/Elm-Story-NG'
