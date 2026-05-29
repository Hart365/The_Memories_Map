import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const publicDir = resolve(process.cwd(), '../backend/public')
const assetsDir = resolve(publicDir, 'assets')
const indexHtml = resolve(publicDir, 'index.html')

if (existsSync(assetsDir)) {
    rmSync(assetsDir, { recursive: true, force: true })
}

if (existsSync(indexHtml)) {
    rmSync(indexHtml, { force: true })
}
