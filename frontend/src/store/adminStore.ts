import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminState {
  adminToken: string | null
  setAdminToken: (token: string) => void
  clearAdminToken: () => void
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      adminToken: null,
      setAdminToken: (token) => set({ adminToken: token }),
      clearAdminToken: () => set({ adminToken: null }),
    }),
    {
      name: 'memories-map-admin-auth',
      partialize: (s) => ({ adminToken: s.adminToken }),
    },
  ),
)
