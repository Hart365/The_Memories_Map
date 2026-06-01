import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Container, Title, Button, Paper, Group, Stack, Text,
  TextInput, PasswordInput, Alert, Select, useComputedColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconUser, IconKey, IconTrash, IconAlertCircle } from '@tabler/icons-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import NativeConfirmDialog from '@/components/common/NativeConfirmDialog'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'
import { DATE_FORMAT_OPTIONS, type UserDateFormat } from '@/lib/dateFormatting'
import useAppVersion from '@/hooks/useAppVersion'

interface TimezoneOption {
  value: string
  label: string
  location: string
  utc_offset: string
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user: storeUser, setAuth, clearAuth } = useAuthStore()
  const isDark = useComputedColorScheme('light') === 'dark'
  const appVersion = useAppVersion()
  const [deleteInput, setDeleteInput] = useState('')
  const [confirmDeleteAccountOpen, setConfirmDeleteAccountOpen] = useState(false)

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
  const brand = isDark ? '#22d3e0' : '#005f63'

  const { data: timezoneOptions = [], isLoading: timezonesLoading } = useQuery<TimezoneOption[]>({
    queryKey: ['profile-timezones'],
    queryFn: () => api.get('/profile/timezones').then((res) => res.data.data),
  })

  const profileForm = useForm({
    initialValues: {
      name: storeUser?.name ?? '',
      email: storeUser?.email ?? '',
      default_timezone: storeUser?.default_timezone ?? 'Etc/UTC',
      date_format: (storeUser?.date_format as UserDateFormat | undefined) ?? 'YYYY-MM-DD',
    },
    validate: {
      name: (v) => v.trim().length < 2 ? 'Name must be at least 2 characters' : null,
      email: (v) => /^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email',
      default_timezone: (v) => v.trim().length < 1 ? 'Timezone is required' : null,
      date_format: (v) => v.trim().length < 1 ? 'Date format is required' : null,
    },
  })

  const passwordForm = useForm({
    initialValues: { current_password: '', password: '', password_confirmation: '' },
    validate: {
      current_password: (v) => v.length < 1 ? 'Required' : null,
      password: (v) => v.length < 8 ? 'Min 8 characters' : null,
      password_confirmation: (v, vals) => v !== vals.password ? 'Passwords do not match' : null,
    },
  })

  const updateProfile = useMutation({
    mutationFn: (vals: { name: string; email: string; default_timezone: string; date_format: UserDateFormat }) => api.put('/profile', vals),
    onSuccess: (res) => {
      setAuth(useAuthStore.getState().token!, res.data)
      notifications.show({ message: 'Profile updated!', color: 'teal' })
    },
    onError: () => notifications.show({ message: 'Failed to update profile.', color: 'red' }),
  })

  const changePassword = useMutation({
    mutationFn: (vals: { current_password: string; password: string; password_confirmation: string }) =>
      api.put('/profile/password', vals),
    onSuccess: () => {
      clearAuth()
      navigate('/login')
      notifications.show({ message: 'Password changed. Please log in again.', color: 'teal' })
    },
    onError: () => notifications.show({ message: 'Failed to change password. Check your current password.', color: 'red' }),
  })

  const deleteAccount = useMutation({
    mutationFn: () => api.delete('/profile', { data: { password: deleteInput } }),
    onSuccess: () => {
      clearAuth()
      navigate('/login')
    },
    onError: () => notifications.show({ message: 'Failed to delete account. Check your password.', color: 'red' }),
  })

  return (
    <Container size="md" py="lg">
      <Title order={1} mb="lg" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Settings</Title>

      <Paper p="xl" radius="lg" mb="lg" style={{ backgroundColor: surface, border }}>
        <Group gap="sm" mb="md">
          <IconUser size={22} color={brand} aria-hidden />
          <Title order={3} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Profile</Title>
        </Group>
        <form onSubmit={profileForm.onSubmit((vals) => updateProfile.mutate(vals))}>
          <Stack gap="md">
            <TextInput label="Name" required {...profileForm.getInputProps('name')} aria-label="Full name" />
            <TextInput label="Email" type="email" required {...profileForm.getInputProps('email')} aria-label="Email address" />
            <Select
              label="Default Timezone"
              description="All timezones are listed with Location and UTC offset. Used as the source camera timezone when EXIF has no timezone metadata."
              required
              data={timezoneOptions}
              placeholder={timezonesLoading ? 'Loading timezones...' : 'Select timezone'}
              searchable
              limit={1000}
              maxDropdownHeight={360}
              nothingFoundMessage="No timezone found"
              aria-label="Default timezone"
              disabled={timezonesLoading}
              {...profileForm.getInputProps('default_timezone')}
            />
            <Select
              label="Date Format"
              description="Controls how dates are shown throughout the app."
              required
              data={DATE_FORMAT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              aria-label="Date format"
              {...profileForm.getInputProps('date_format')}
            />
            <Group justify="flex-end">
              <Button type="submit" variant="default" styles={getMapSectionButtonStyles('consolidated', 'solid')} loading={updateProfile.isPending}>Save Profile</Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Paper p="xl" radius="lg" mb="lg" style={{ backgroundColor: surface, border }}>
        <Group gap="sm" mb="md">
          <IconKey size={22} color={brand} aria-hidden />
          <Title order={3} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Change Password</Title>
        </Group>
        <form onSubmit={passwordForm.onSubmit((vals) => changePassword.mutate(vals))}>
          <Stack gap="md">
            <PasswordInput label="Current Password" required {...passwordForm.getInputProps('current_password')} aria-label="Current password" />
            <PasswordInput label="New Password" required {...passwordForm.getInputProps('password')} aria-label="New password" />
            <PasswordInput label="Confirm New Password" required {...passwordForm.getInputProps('password_confirmation')} aria-label="Confirm new password" />
            <Group justify="flex-end">
              <Button type="submit" variant="default" styles={getMapSectionButtonStyles('upload', 'solid')} loading={changePassword.isPending}>Change Password</Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Paper p="xl" radius="lg" style={{ backgroundColor: surface, border: '1px solid rgba(220,38,38,0.3)' }}>
        <Group gap="sm" mb="md">
          <IconTrash size={22} color="#dc2626" aria-hidden />
          <Title order={3} style={{ color: '#dc2626' }}>Danger Zone</Title>
        </Group>
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md" role="alert">
          Deleting your account is irreversible. All your maps and media will be permanently removed.
        </Alert>
        <Stack gap="md">
          <PasswordInput
            label="Enter your password to confirm deletion"
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.currentTarget.value)}
            aria-label="Password to confirm account deletion"
          />
          <Group justify="flex-end">
            <Button variant="default" styles={getMapSectionButtonStyles('danger', 'solid')} loading={deleteAccount.isPending}
              disabled={deleteInput.length < 1} leftSection={<IconTrash size={16} aria-hidden />}
              onClick={() => setConfirmDeleteAccountOpen(true)}>
              Delete Account
            </Button>
          </Group>
        </Stack>
      </Paper>

      <NativeConfirmDialog
        opened={confirmDeleteAccountOpen}
        title="Delete account?"
        message="This will permanently remove your account and all associated maps and media. This action cannot be undone."
        confirmLabel="Delete account"
        tone="danger"
        loading={deleteAccount.isPending}
        onCancel={() => setConfirmDeleteAccountOpen(false)}
        onConfirm={() => {
          setConfirmDeleteAccountOpen(false)
          deleteAccount.mutate()
        }}
      />

      <Group justify="center" mt="xl">
        <Text size="sm" style={{ color: isDark ? '#94a3b8' : '#4a5568' }} aria-label={`Application version ${appVersion}`}>
          Memories Map v{appVersion}
        </Text>
      </Group>
    </Container>
  )
}
