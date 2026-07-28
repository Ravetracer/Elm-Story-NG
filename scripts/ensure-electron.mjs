/**
 * Downloads Electron's platform binary if it is missing.
 *
 * Electron used to fetch its binary from its own postinstall hook. As of v43
 * the published package declares no install scripts at all (it is absent from
 * hasInstallScript in package-lock.json), so npm never fetches the binary and
 * `electron-vite dev` fails with "Error: Electron uninstall".
 *
 * electron/install.js exits immediately when the binary is already present, so
 * this is cheap to run on every install.
 *
 * Skipped silently when the file is absent, which is the case for a production
 * install: electron is a devDependency, so `npm ci --omit=dev` must not fail
 * here.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const installer = path.join(projectRoot, 'node_modules', 'electron', 'install.js')

if (!existsSync(installer)) {
  console.log('electron is not installed, skipping binary download.')
  process.exit(0)
}

execFileSync(process.execPath, [installer], {
  cwd: projectRoot,
  stdio: 'inherit'
})
