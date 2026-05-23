import type { ActionIconProps, ButtonProps, NavLinkProps } from '@mantine/core'

type MapSectionButtonTone = 'consolidated' | 'timeline' | 'map' | 'gallery' | 'upload' | 'danger'
type MapSectionButtonEmphasis = 'soft' | 'solid'

type SectionButtonPalette = {
  softBackground: string
  softBorder: string
  softText: string
  softHoverBackground: string
  softHoverBorder: string
  softShadow: string
  solidBackground: string
  solidBorder: string
  solidText: string
  solidShadow: string
}

const SECTION_BUTTON_PALETTES: Record<MapSectionButtonTone, SectionButtonPalette> = {
  consolidated: {
    softBackground: '#80e4ee',
    softBorder: '#00a8b4',
    softText: '#003d40',
    softHoverBackground: '#4dd8e6',
    softHoverBorder: '#00878f',
    softShadow: '0 10px 22px rgba(0, 168, 180, 0.22)',
    solidBackground: '#005f63',
    solidBorder: '#005f63',
    solidText: '#ffffff',
    solidShadow: '0 12px 24px rgba(0, 95, 99, 0.24)',
  },
  timeline: {
    softBackground: '#ffc999',
    softBorder: '#d96500',
    softText: '#5c2600',
    softHoverBackground: '#ffe3c2',
    softHoverBorder: '#b55200',
    softShadow: '0 10px 22px rgba(217, 101, 0, 0.22)',
    solidBackground: '#8a3a00',
    solidBorder: '#8a3a00',
    solidText: '#ffffff',
    solidShadow: '0 12px 24px rgba(138, 58, 0, 0.24)',
  },
  map: {
    softBackground: '#80e3ff',
    softBorder: '#00a8d8',
    softText: '#004258',
    softHoverBackground: '#b3eeff',
    softHoverBorder: '#0088b0',
    softShadow: '0 10px 22px rgba(0, 168, 216, 0.2)',
    solidBackground: '#004258',
    solidBorder: '#004258',
    solidText: '#ffffff',
    solidShadow: '0 12px 24px rgba(0, 100, 128, 0.24)',
  },
  gallery: {
    softBackground: '#cc94ff',
    softBorder: '#8520f5',
    softText: '#290660',
    softHoverBackground: '#e1bfff',
    softHoverBorder: '#6e17d1',
    softShadow: '0 10px 22px rgba(133, 32, 245, 0.2)',
    solidBackground: '#3f0a84',
    solidBorder: '#3f0a84',
    solidText: '#ffffff',
    solidShadow: '0 12px 24px rgba(63, 10, 132, 0.24)',
  },
  upload: {
    softBackground: '#96e4bc',
    softBorder: '#18a358',
    softText: '#043d22',
    softHoverBackground: '#6ad89f',
    softHoverBorder: '#118247',
    softShadow: '0 10px 22px rgba(24, 163, 88, 0.2)',
    solidBackground: '#085e33',
    solidBorder: '#085e33',
    solidText: '#ffffff',
    solidShadow: '0 12px 24px rgba(8, 94, 51, 0.24)',
  },
  danger: {
    softBackground: '#ffd6de',
    softBorder: '#d92357',
    softText: '#5c0822',
    softHoverBackground: '#fff0f3',
    softHoverBorder: '#b51847',
    softShadow: '0 10px 22px rgba(217, 35, 87, 0.2)',
    solidBackground: '#8a0f35',
    solidBorder: '#8a0f35',
    solidText: '#ffffff',
    solidShadow: '0 12px 24px rgba(138, 15, 53, 0.24)',
  },
}

export function getMapSectionPalette(tone: MapSectionButtonTone): SectionButtonPalette {
  return SECTION_BUTTON_PALETTES[tone]
}

export function getMapSectionButtonStyles(
  tone: MapSectionButtonTone,
  emphasis: MapSectionButtonEmphasis = 'soft',
): ButtonProps['styles'] {
  const palette = SECTION_BUTTON_PALETTES[tone]
  const isSolid = emphasis === 'solid'

  return {
    root: {
      backgroundColor: isSolid ? palette.solidBackground : palette.softBackground,
      color: isSolid ? palette.solidText : palette.softText,
      border: `2px solid ${isSolid ? palette.solidBorder : palette.softBorder}`,
      boxShadow: isSolid ? palette.solidShadow : palette.softShadow,
      transition: 'transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease',
      '&:hover': {
        backgroundColor: isSolid ? palette.solidBackground : palette.softHoverBackground,
        borderColor: isSolid ? palette.solidBorder : palette.softHoverBorder,
        boxShadow: isSolid ? palette.solidShadow : palette.softShadow,
        transform: 'translateY(-1px)',
      },
    },
    section: {
      color: 'inherit',
    },
    label: {
      color: 'inherit',
      fontWeight: 700,
    },
  }
}

export function getMapSectionNavLinkStyles(
  tone: MapSectionButtonTone,
  active = false,
): NavLinkProps['styles'] {
  const palette = SECTION_BUTTON_PALETTES[tone]

  return {
    root: {
      backgroundColor: active ? palette.solidBackground : palette.softBackground,
      color: active ? palette.solidText : palette.softText,
      border: `2px solid ${active ? palette.solidBorder : palette.softBorder}`,
      borderRadius: '14px',
      boxShadow: active ? palette.solidShadow : palette.softShadow,
      transition: 'transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease',
      '&:hover': {
        backgroundColor: active ? palette.solidBackground : palette.softHoverBackground,
        borderColor: active ? palette.solidBorder : palette.softHoverBorder,
        boxShadow: active ? palette.solidShadow : palette.softShadow,
        transform: 'translateX(2px)',
      },
    },
    label: {
      color: active ? palette.solidText : palette.softText,
      fontWeight: 700,
    },
    description: {
      color: active ? palette.solidText : palette.softText,
      opacity: active ? 1 : 0.88,
    },
    section: {
      color: active ? palette.solidText : palette.softText,
    },
  }
}

export function getMapSectionActionIconStyles(
  tone: MapSectionButtonTone,
  emphasis: MapSectionButtonEmphasis = 'soft',
): ActionIconProps['styles'] {
  const palette = SECTION_BUTTON_PALETTES[tone]
  const isSolid = emphasis === 'solid'

  return {
    root: {
      backgroundColor: isSolid ? palette.solidBackground : palette.softBackground,
      color: isSolid ? palette.solidText : palette.softText,
      border: `2px solid ${isSolid ? palette.solidBorder : palette.softBorder}`,
      boxShadow: isSolid ? palette.solidShadow : palette.softShadow,
      transition: 'transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease',
      '&:hover': {
        backgroundColor: isSolid ? palette.solidBackground : palette.softHoverBackground,
        borderColor: isSolid ? palette.solidBorder : palette.softHoverBorder,
        boxShadow: isSolid ? palette.solidShadow : palette.softShadow,
        transform: 'translateY(-1px)',
      },
    },
    icon: {
      color: 'inherit',
    },
  }
}