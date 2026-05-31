import puppeteer from 'puppeteer'
import axe from 'axe-core'

const BASE_URL = process.env.A11Y_BASE_URL || 'http://127.0.0.1:4173'
const DISCOVERY_LIMIT = Number(process.env.A11Y_DISCOVERY_LIMIT || 60)

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/admin',
  '/404',
  '/shared/invalid-token',
]

const AUTH_PATHS = [
  '/dashboard',
  '/settings',
]

function toAbsoluteUrl(path) {
  return new URL(path, BASE_URL).toString()
}

function normalizeUrl(input) {
  try {
    const url = new URL(input, BASE_URL)
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function isRouteCandidate(rawUrl) {
  const normalized = normalizeUrl(rawUrl)
  if (!normalized) return false

  const url = new URL(normalized)
  const base = new URL(BASE_URL)

  if (url.origin !== base.origin) return false
  if (url.pathname.startsWith('/api/')) return false
  if (url.pathname.startsWith('/assets/')) return false
  if (url.pathname.startsWith('/storage/')) return false
  if (/\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|pdf|zip|mp4|mov|avi|mkv)$/i.test(url.pathname)) return false

  return true
}

async function collectDiscoverableUrls(browser, seedUrls) {
  const queue = [...new Set(seedUrls.filter(isRouteCandidate).map((url) => normalizeUrl(url)).filter(Boolean))]
  const visited = new Set()

  while (queue.length > 0 && visited.size < DISCOVERY_LIMIT) {
    const nextUrl = queue.shift()
    if (!nextUrl || visited.has(nextUrl)) continue

    visited.add(nextUrl)

    const page = await browser.newPage()
    try {
      await page.goto(nextUrl, { waitUntil: 'networkidle2', timeout: 45000 })

      const hrefs = await page.$$eval('a[href]', (links) =>
        links
          .map((link) => link.getAttribute('href'))
          .filter((value) => typeof value === 'string' && value.length > 0),
      )

      for (const href of hrefs) {
        const candidate = normalizeUrl(href)
        if (!candidate || !isRouteCandidate(candidate) || visited.has(candidate)) {
          continue
        }
        if (!queue.includes(candidate)) {
          queue.push(candidate)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Skipping discovery for ${nextUrl}: ${message}`)
    } finally {
      await page.close()
    }
  }

  return [...visited]
}

async function runAxeForUrl(browser, url) {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 })
  await page.addScriptTag({ content: axe.source })
  const result = await page.evaluate(async () => {
    // @ts-expect-error axe injected by addScriptTag
    return await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2aaa'] } })
  })
  await page.close()
  return result
}

function formatViolation(url, violation) {
  const firstNode = violation.nodes[0]
  return [
    `URL: ${url}`,
    `Rule: ${violation.id} (${violation.impact ?? 'unknown'})`,
    `Description: ${violation.description}`,
    `Help: ${violation.help}`,
    `Selector: ${firstNode?.target?.join(' > ') ?? 'n/a'}`,
  ].join('\n')
}

async function verifySkipLinkKeyboardFlow(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2' })
  await page.keyboard.press('Tab')

  const focusState = await page.evaluate(() => {
    const active = document.activeElement
    return {
      href: active?.getAttribute('href'),
    }
  })

  if (focusState.href !== '#main-content') {
    throw new Error(`Skip link did not receive focus on ${url}`)
  }

  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.id === 'main-content')
  console.log(`Keyboard skip-link passed: ${url}`)
}

async function run() {
  const publicSeedUrls = PUBLIC_PATHS.map(toAbsoluteUrl)
  const requireAuth = process.env.A11Y_REQUIRE_AUTH === '1'

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH
  const launchOptions = {
    headless: true,
    // Docker containers often run as root, so Chrome needs no-sandbox flags.
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }

  if (executablePath) {
    launchOptions.executablePath = executablePath
  }

  const browser = await puppeteer.launch(launchOptions)
  let hasViolations = false

  try {
    const publicUrls = await collectDiscoverableUrls(browser, publicSeedUrls)

    for (const url of publicUrls) {
      const result = await runAxeForUrl(browser, url)

      if (result.violations.length > 0) {
        hasViolations = true
        for (const violation of result.violations) {
          console.error(formatViolation(url, violation))
          console.error('---')
        }
      } else {
        console.log(`Axe passed: ${url}`)
      }

    }

    const email = process.env.A11Y_TEST_EMAIL
    const password = process.env.A11Y_TEST_PASSWORD
    const explicitMapId = process.env.A11Y_TEST_MAP_ID

    if (!email || !password) {
      if (requireAuth) {
        throw new Error('Authenticated accessibility checks are required. Set A11Y_TEST_EMAIL and A11Y_TEST_PASSWORD.')
      }
      console.warn('Skipping authenticated accessibility checks: A11Y_TEST_EMAIL/A11Y_TEST_PASSWORD not set.')
    } else {
      const loginPage = await browser.newPage()
      await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 45000 })
      await loginPage.type('input[type="email"]', email)
      await loginPage.type('input[type="password"]', password)
      await loginPage.click('button[type="submit"]')
      await loginPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 })

      await verifySkipLinkKeyboardFlow(loginPage, `${BASE_URL}/dashboard`)

      const authenticatedSeedUrls = AUTH_PATHS.map(toAbsoluteUrl)

      let firstMapHref = await loginPage.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href^="/maps/"]'))
        const first = links.find((link) => {
          const href = link.getAttribute('href') || ''
          return /^\/maps\/\d+$/.test(href)
        })
        return first ? first.getAttribute('href') : null
      })

      if (!firstMapHref) {
        firstMapHref = await loginPage.evaluate(async () => {
          try {
            const response = await fetch('/api/maps', {
              headers: { Accept: 'application/json' },
            })
            if (!response.ok) return null
            const data = await response.json()
            const first = Array.isArray(data) ? data[0] : null
            return first?.id ? `/maps/${first.id}` : null
          } catch {
            return null
          }
        })
      }

      if (firstMapHref) {
        const mapUrl = `${BASE_URL}${firstMapHref}`
        authenticatedSeedUrls.push(mapUrl)
        authenticatedSeedUrls.push(`${mapUrl}/map`)
        authenticatedSeedUrls.push(`${mapUrl}/timeline`)
        authenticatedSeedUrls.push(`${mapUrl}/gallery`)

        const firstMediaId = await loginPage.evaluate(async (mapIdPath) => {
          const mapId = mapIdPath.split('/').pop()
          if (!mapId) return null
          try {
            const response = await fetch(`/api/maps/${mapId}/media?per_page=1`, {
              headers: { Accept: 'application/json' },
            })
            if (!response.ok) return null
            const payload = await response.json()
            const first = Array.isArray(payload?.data) ? payload.data[0] : null
            return first?.id ? String(first.id) : null
          } catch {
            return null
          }
        }, firstMapHref)

        if (firstMediaId) {
          authenticatedSeedUrls.push(`${mapUrl}/media/${firstMediaId}`)
        }
      }

      if (explicitMapId) {
        const mapUrl = `${BASE_URL}/maps/${explicitMapId}`
        authenticatedSeedUrls.push(mapUrl)
        authenticatedSeedUrls.push(`${mapUrl}/map`)
        authenticatedSeedUrls.push(`${mapUrl}/timeline`)
        authenticatedSeedUrls.push(`${mapUrl}/gallery`)
      }

      const authenticatedUrls = await collectDiscoverableUrls(browser, authenticatedSeedUrls)

      await loginPage.close()

      for (const url of authenticatedUrls) {
        const result = await runAxeForUrl(browser, url)
        if (result.violations.length > 0) {
          hasViolations = true
          for (const violation of result.violations) {
            console.error(formatViolation(url, violation))
            console.error('---')
          }
        } else {
          console.log(`Axe passed: ${url}`)
        }
      }
    }
  } finally {
    await browser.close()
  }

  if (hasViolations) {
    process.exit(1)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
