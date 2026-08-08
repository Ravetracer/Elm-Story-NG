import React, { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { EDITOR_URL, REPO_URL } from '../config'
import { ArrowRightIcon, CloseIcon, MenuIcon } from '../icons'

// The title-bar mark, imported as a URL asset Vite bundles locally.
import markUrl from '../../src/components/TitleBar/mark.svg'

const Header: React.FC = () => {
  const [open, setOpen] = useState(false)

  const links = (
    <>
      <NavLink exact to="/" activeClassName="active" onClick={() => setOpen(false)}>
        Home
      </NavLink>
      <NavLink to="/docs" activeClassName="active" onClick={() => setOpen(false)}>
        Documentation
      </NavLink>
      <NavLink
        to="/tutorial"
        activeClassName="active"
        onClick={() => setOpen(false)}
      >
        Tutorial
      </NavLink>
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
    </>
  )

  return (
    <header className="site-header">
      <nav>
        <Link to="/" className="brand">
          <img src={markUrl} alt="" />
          <span className="neon-text">Elm Story - NG</span>
        </Link>

        <div className="nav-links">{links}</div>

        <div className="nav-cta">
          <a className="btn btn-primary" href={EDITOR_URL}>
            Open the Editor <ArrowRightIcon />
          </a>
          <button
            className="menu-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      <div className={`mobile-menu ${open ? 'open' : ''}`}>
        {links}
        <a className="btn btn-primary" href={EDITOR_URL}>
          Open the Editor <ArrowRightIcon />
        </a>
      </div>
    </header>
  )
}

export default Header
