import puppeteer from 'puppeteer'
import axe from 'axe-core'

const PUBLIC_URLS = [
  'http://127.0.0.1:4173/login',
  'http://127.0.0.1:4173/register',
]

const BASE_URL = 'http://127.0.0.1:4173'

async function runAxeForUrl(browser, url) {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle2' })
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
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
    // Docker containers often run as root, so Chrome needs no-sandbox flags.
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  let hasViolations = false

  try {
    for (const url of PUBLIC_URLS) {
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
      console.warn('Skipping authenticated accessibility checks: A11Y_TEST_EMAIL/A11Y_TEST_PASSWORD not set.')
    } else {
      const loginPage = await browser.newPage()
      await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' })
      await loginPage.type('input[type="email"]', email)
      await loginPage.type('input[type="password"]', password)
      await loginPage.click('button[type="submit"]')
      await loginPage.waitForNavigation({ waitUntil: 'networkidle2' })

      await verifySkipLinkKeyboardFlow(loginPage, `${BASE_URL}/dashboard`)

      const authenticatedUrls = [
        `${BASE_URL}/dashboard`,
        `${BASE_URL}/settings`,
      ]

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
        authenticatedUrls.push(mapUrl)
        authenticatedUrls.push(`${mapUrl}/map`)
        authenticatedUrls.push(`${mapUrl}/timeline`)
        authenticatedUrls.push(`${mapUrl}/gallery`)
      }

      if (explicitMapId) {
        const mapUrl = `${BASE_URL}/maps/${explicitMapId}`
        authenticatedUrls.push(mapUrl)
        authenticatedUrls.push(`${mapUrl}/map`)
        authenticatedUrls.push(`${mapUrl}/timeline`)
        authenticatedUrls.push(`${mapUrl}/gallery`)
      }

      const uniqueAuthenticatedUrls = [...new Set(authenticatedUrls)]

      await loginPage.close()

      for (const url of uniqueAuthenticatedUrls) {
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
