// Colour themes removed. Dark/Light mode is handled by Mantine's localStorageColorSchemeManager.
export const themes = {} as const
export const defaultTheme = { id: 'default', light: {}, dark: {} } as const
export type AppTheme = typeof defaultTheme
