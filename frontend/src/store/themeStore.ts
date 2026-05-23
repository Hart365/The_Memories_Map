/**
 * Theme store – Mantine handles color scheme via its own manager.
 * This store is kept for backward compatibility but only exposes isDarkMode
 * as a convenience selector.
 */
import { create } from 'zustand'

interface ThemeStore {
  isDarkMode: boolean
  setIsDarkMode: (dark: boolean) => void
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  isDarkMode: false,
  setIsDarkMode: (dark: boolean) => set({ isDarkMode: dark }),
}))
