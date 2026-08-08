declare module '*.less' {
  const resource: { [key: string]: string }
  export = resource
}

// Build-time flag, replaced by Vite: true in the browser build
// (vite.web.config.mts), false in the desktop renderer (electron.vite.config.ts).
// Guards the web-only storage-durability chrome. See src/lib/storageDurability.ts.
declare const __ESG_WEB__: boolean
