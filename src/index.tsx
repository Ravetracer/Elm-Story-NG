import React from 'react'
import { render } from 'react-dom'
import { HashRouter as Router } from 'react-router-dom'

import AppProvider from './contexts/AppContext'

import { applyUIScale, loadUIScale } from './lib/uiScale'

import App from './App'

// before the first render, so the window does not paint at one size and then
// jump to the author's chosen one
applyUIScale(loadUIScale())

render(
  <Router>
    <AppProvider>
      <App />
    </AppProvider>
  </Router>,
  document.getElementById('root')
)
