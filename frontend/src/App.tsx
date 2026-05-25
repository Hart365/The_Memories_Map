import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Center, Loader, Stack, Text } from '@mantine/core'
import { useAuthStore } from '@/store/authStore'
import Layout from '@/components/layout/Layout'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const AdminPage = lazy(() => import('@/pages/AdminPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const MapViewPage = lazy(() => import('@/pages/MapViewPage'))
const TimelinePage = lazy(() => import('@/pages/TimelinePage'))
const GalleryPage = lazy(() => import('@/pages/GalleryPage'))
const MediaViewerPage = lazy(() => import('@/pages/MediaViewerPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const GuestAccessPage = lazy(() => import('@/pages/GuestAccessPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function RouteFallback() {
  return (
    <Center mih="50vh" role="status" aria-live="polite">
      <Stack align="center" gap="sm">
        <Loader color="teal" />
        <Text size="sm" c="dimmed">Loading page…</Text>
      </Stack>
    </Center>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/shared/:token" element={<GuestAccessPage />} />

          {/* Protected */}
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/maps/:mapId" element={<MapViewPage />} />
            <Route path="/maps/:mapId/consolidated" element={<MapViewPage />} />
            <Route path="/maps/:mapId/map" element={<MapViewPage />} />
            <Route path="/maps/:mapId/timeline" element={<TimelinePage />} />
            <Route path="/maps/:mapId/gallery" element={<GalleryPage />} />
            <Route path="/maps/:mapId/media/:mediaId" element={<MediaViewerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
