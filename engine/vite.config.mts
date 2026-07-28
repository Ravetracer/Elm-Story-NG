import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import banner from 'vite-plugin-banner'

import pkg from './package.json'

const license = `
/*
  @license ${pkg.name} ${pkg.version} / ESG Storyteller
  Copyright (c) Elm Story Games LLC. All rights reserved.
  Storyworld content (c) original author(s).
  Generated: ${Date.now()} | https://elmstory.com
*/
`

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'robots.txt',
        'apple-touch-icon.png',
        'fonts/*.ttf'
      ],
      manifest: {
        name: '___worldTitle___',
        short_name: '___worldTitle___',
        description: '___worldDescription___',
        theme_color: '#080808',
        background_color: '#080808',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    }),
    banner(license)
  ],
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true
      }
    }
  },
  build: {
    // The editor's PWA export pipeline reads this manifest from the output
    // root to locate the entry chunk (see src/main.dev.ts). Vite defaults to
    // '.vite/manifest.json' since v5, so the name is pinned explicitly.
    manifest: 'manifest.json',
    minify: true,
    outDir: '../assets/engine-dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // The export pipeline string-replaces placeholder tokens inside the
        // single entry chunk and rewrites its precache revision in sw.js.
        // Inlining every dependency keeps that a one-file operation.
        manualChunks: undefined
      }
    }
  }
})
