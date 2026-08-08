import React, { useEffect } from 'react'
import { Redirect, Route, Switch, useLocation } from 'react-router-dom'

import Header from './components/Header'
import Footer from './components/Footer'

import Landing from './pages/Landing'
import Docs from './pages/Docs'
import Tutorial from './pages/Tutorial'

// Jump to the top when the route (but not the docs topic hash) changes, so
// navigating from a scrolled page does not land mid-content.
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

const App: React.FC = () => (
  <>
    <ScrollToTop />
    <Header />

    <Switch>
      <Route exact path="/" component={Landing} />
      <Route path="/docs/:topic?" component={Docs} />
      <Route path="/tutorial" component={Tutorial} />
      <Redirect to="/" />
    </Switch>

    <Footer />
  </>
)

export default App
