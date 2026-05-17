import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({
  // Always use same-origin API path. In dev, Vite proxies /api to backend.
  // This avoids cross-origin upload/network issues in the browser.
  baseURL: '/api',
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  // Token auth is sent via Authorization header; cookies are not required.
  withCredentials: false,
})

// Attach bearer token from store
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear auth and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default api
