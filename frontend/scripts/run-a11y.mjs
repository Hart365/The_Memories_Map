import { spawn } from 'node:child_process'

const PREVIEW_URL = 'http://127.0.0.1:4173'

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
      }
    })

    child.on('error', reject)
  })
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Keep polling until the timeout.
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  throw new Error(`Timed out waiting for preview server at ${url}`)
}

async function main() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

  if (process.platform === 'win32' && !process.env.CHROME_PATH) {
    process.env.CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  }

  await runCommand(npmCommand, ['run', 'build'])
  const previewServer = spawn(
    npmCommand,
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  )

  try {
    await waitForServer(PREVIEW_URL)
    await runCommand(npmCommand, ['run', 'a11y:pa11y'])
    await runCommand(npmCommand, ['run', 'a11y:axe'])
  } finally {
    if (process.platform === 'win32') {
      await runCommand('taskkill', ['/PID', String(previewServer.pid), '/T', '/F']).catch(() => undefined)
    } else {
      previewServer.kill('SIGTERM')
    }
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
