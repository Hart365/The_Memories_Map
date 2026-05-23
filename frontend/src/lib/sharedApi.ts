import axios from 'axios'

const sharedApi = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  withCredentials: false,
})

sharedApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('guest_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default sharedApi