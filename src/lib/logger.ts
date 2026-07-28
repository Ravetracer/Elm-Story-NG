/**
 * Console logger shared by the main and renderer processes.
 *
 * This previously wrapped winston. That worked under webpack's
 * 'electron-renderer' target, which resolved Node's built-in modules for the
 * renderer, but winston reaches for fs, os, http, https and zlib and cannot be
 * bundled for a browser environment. Roughly 60 renderer modules import this
 * logger, so it has to be safe on both sides of the process boundary.
 *
 * Nothing is lost: the winston instance was configured with a single Console
 * transport at the 'info' level and silenced in production, which is exactly
 * what this does. Only .info and .error are used across the codebase; .warn and
 * .debug are provided for symmetry.
 *
 * The production check matches the original behaviour rather than tightening
 * it. electron-vite sets NODE_ENV to 'production' for builds, so packaged
 * applications stay silent.
 */
const silent = process.env.NODE_ENV === 'production'

const format = (level: string, args: unknown[]): unknown[] => [
  `${level}:`,
  ...args
]

const logger = {
  info: (...args: unknown[]): void => {
    if (!silent) console.info(...format('info', args))
  },
  warn: (...args: unknown[]): void => {
    if (!silent) console.warn(...format('warn', args))
  },
  error: (...args: unknown[]): void => {
    if (!silent) console.error(...format('error', args))
  },
  debug: (...args: unknown[]): void => {
    if (!silent) console.debug(...format('debug', args))
  }
}

export default logger
