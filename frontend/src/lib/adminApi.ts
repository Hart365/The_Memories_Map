import axios from 'axios'
import { useAdminStore } from '@/store/adminStore'

const adminApi = axios.create({
  baseURL: '/api/admin',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  withCredentials: false,
})

adminApi.interceptors.request.use((config) => {
  const token = useAdminStore.getState().adminToken
  if (token) {
    config.headers['X-Admin-Token'] = token
  }
  return config
})

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAdminStore.getState().clearAdminToken()
    }
    return Promise.reject(err)
  },
)

export default adminApi
