import React from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { HashRouter as Router } from 'react-router-dom'

import { ipcRenderer } from 'electron'

import AppProvider from '../contexts/AppContext'
import App from '../App'

/**
 * Mount smoke test. App reads AppContext and renders route content, so it needs
 * the same providers index.tsx gives it; rendering it bare throws inside
 * react-router.
 *
 * Its worth is in the import graph rather than the assertions: reaching a render
 * at all exercises antd, rc-dock, slate, react-flow-renderer and the embedded
 * storyteller, which is where upgrade breakage in this project tends to surface.
 */
describe('App', () => {
  const renderApp = () =>
    render(
      <Router>
        <AppProvider>
          <App />
        </AppProvider>
      </Router>
    )

  it('mounts without throwing', () => {
    expect(() => renderApp()).not.toThrow()
  })

  it('subscribes to the main process platform event', () => {
    renderApp()

    // App gates its entire tree on app.platform, which arrives over IPC, so the
    // subscription is what makes the editor appear at all.
    expect(ipcRenderer.on).toHaveBeenCalledWith('PLATFORM', expect.any(Function))
  })

  it('renders nothing until a platform is known', () => {
    const { container } = renderApp()

    expect(container).toBeEmptyDOMElement()
  })
})
