import { type ReactNode } from 'react'
import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { mantineTheme } from '@/styles/mantine-theme'

const colorSchemeManager = localStorageColorSchemeManager({ key: 'memories-map-color-scheme' })

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <MantineProvider
      theme={mantineTheme}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme="light"
    >
      <Notifications position="bottom-right" zIndex={2000} />
      {children}
    </MantineProvider>
  )
}
