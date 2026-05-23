type Rgb = { r: number; g: number; b: number; a: number }

export type WcagViolation = {
  kind: 'text' | 'ui'
  selector: string
  ratio: number
  minimum: number
  fg: string
  bg: string
  textSample?: string
}

const MIN_UI_CONTRAST = 3

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function parseHexColor(color: string): Rgb | null {
  const hex = color.replace('#', '').trim()
  if (hex.length !== 3 && hex.length !== 6) {
    return null
  }

  const normalized = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex

  const intValue = Number.parseInt(normalized, 16)
  if (Number.isNaN(intValue)) {
    return null
  }

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
    a: 1,
  }
}

function parseRgbColor(color: string): Rgb | null {
  const match = color.match(/rgba?\(([^)]+)\)/i)
  if (!match) {
    return null
  }

  const parts = match[1].split(',').map((part) => part.trim())
  if (parts.length < 3) {
    return null
  }

  return {
    r: clamp(Number.parseFloat(parts[0]), 0, 255),
    g: clamp(Number.parseFloat(parts[1]), 0, 255),
    b: clamp(Number.parseFloat(parts[2]), 0, 255),
    a: parts[3] ? clamp(Number.parseFloat(parts[3]), 0, 1) : 1,
  }
}

function parseColor(color: string): Rgb | null {
  if (!color || color === 'transparent') {
    return null
  }

  if (color.startsWith('#')) {
    return parseHexColor(color)
  }

  if (color.startsWith('rgb')) {
    return parseRgbColor(color)
  }

  return null
}

function blend(top: Rgb, bottom: Rgb): Rgb {
  const alpha = top.a + bottom.a * (1 - top.a)
  if (alpha <= 0) {
    return { r: 255, g: 255, b: 255, a: 1 }
  }

  return {
    r: Math.round((top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha),
    g: Math.round((top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha),
    b: Math.round((top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha),
    a: alpha,
  }
}

function linearize(value: number): number {
  const normalized = value / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

function luminance(color: Rgb): number {
  const r = linearize(color.r)
  const g = linearize(color.g)
  const b = linearize(color.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(fg: Rgb, bg: Rgb): number {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function getGradientColors(backgroundImage: string): Rgb[] {
  if (!backgroundImage || backgroundImage === 'none' || !backgroundImage.includes('gradient')) {
    return []
  }

  const colors: Rgb[] = []
  const rgbMatches = backgroundImage.match(/rgba?\([^)]+\)/gi) ?? []
  for (const value of rgbMatches) {
    const parsed = parseColor(value)
    if (parsed) {
      colors.push(parsed)
    }
  }

  return colors
}

function getEffectiveBackground(element: Element): Rgb {
  const chain: Element[] = []
  let current: Element | null = element

  while (current) {
    chain.push(current)
    current = current.parentElement
  }

  let composite: Rgb = { r: 255, g: 255, b: 255, a: 1 }

  // Blend from outermost ancestor down to the element so nearer opaque
  // backgrounds correctly occlude parent backgrounds.
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const style = window.getComputedStyle(chain[i])
    const color = parseColor(style.backgroundColor)
    if (color && color.a > 0) {
      composite = blend(color, composite)
    }
  }

  return composite
}

function buildSelector(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element

  while (current && parts.length < 4) {
    const id = current.getAttribute('id')
    if (id) {
      parts.unshift(`#${id}`)
      break
    }

    const className = current.className
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .join('.')

    if (className) {
      parts.unshift(`${current.tagName.toLowerCase()}.${className}`)
    } else {
      parts.unshift(current.tagName.toLowerCase())
    }
    current = current.parentElement
  }

  return parts.join(' > ')
}

function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > 0
}

function isLargeText(style: CSSStyleDeclaration): boolean {
  const fontSize = Number.parseFloat(style.fontSize)
  const fontWeight = Number.parseInt(style.fontWeight, 10)
  return fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)
}

function auditElementContrast(element: HTMLElement, violations: WcagViolation[]): void {
  if (!isElementVisible(element)) {
    return
  }

  const style = window.getComputedStyle(element)
  const text = element.textContent?.trim() ?? ''
  const hasRenderableText = text.length > 0 && element.children.length === 0
  const fg = parseColor(style.color)
  if (!fg) {
    return
  }

  const bg = getEffectiveBackground(element)
  const gradientColors = getGradientColors(style.backgroundImage)
  const candidateBackgrounds = gradientColors.length > 0
    ? [bg, ...gradientColors.map((stop) => blend(stop, bg))]
    : [bg]

  const ratios = candidateBackgrounds.map((candidate) => contrastRatio(fg, candidate))
  const minRatio = Math.min(...ratios)
  const minBg = candidateBackgrounds[ratios.indexOf(minRatio)]

  if (hasRenderableText) {
    const minimum = isLargeText(style) ? 4.5 : 7
    if (minRatio < minimum) {
      violations.push({
        kind: 'text',
        selector: buildSelector(element),
        ratio: Number(minRatio.toFixed(2)),
        minimum,
        fg: style.color,
        bg: `rgb(${minBg.r}, ${minBg.g}, ${minBg.b})`,
        textSample: text.slice(0, 80),
      })
    }
    return
  }

  const isInteractive = element.matches('button, a, input, textarea, select, [role="button"], [role="switch"]')
  const controlBg = parseColor(style.backgroundColor)
  const parentBg = getEffectiveBackground(element.parentElement ?? element)
  const controlCandidates = gradientColors.length > 0
    ? gradientColors.map((stop) => blend(stop, parentBg))
    : []

  if (controlBg && controlBg.a > 0) {
    controlCandidates.push(blend(controlBg, parentBg))
  }

  const hasPaintedBackground = controlCandidates.length > 0
  if (isInteractive && hasPaintedBackground) {
    const uiRatios = controlCandidates.map((candidate) => contrastRatio(candidate, parentBg))
    const uiMinRatio = Math.min(...uiRatios)

    if (uiMinRatio < MIN_UI_CONTRAST) {
      violations.push({
        kind: 'ui',
        selector: buildSelector(element),
        ratio: Number(uiMinRatio.toFixed(2)),
        minimum: MIN_UI_CONTRAST,
        fg: style.backgroundColor,
        bg: `rgb(${parentBg.r}, ${parentBg.g}, ${parentBg.b})`,
      })
    }
  }

}

export function runWcagAudit(): WcagViolation[] {
  const violations: WcagViolation[] = []
  const elements = Array.from(document.querySelectorAll<HTMLElement>('main *'))
  elements.forEach((element) => auditElementContrast(element, violations))
  return violations
}
