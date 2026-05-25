import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert,
  Anchor,
  Button,
  Container,
  Group,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  useComputedColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconLock, IconMail, IconShieldCog } from '@tabler/icons-react'
import adminApi from '@/lib/adminApi'
import { useAdminStore } from '@/store/adminStore'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

interface AdminSiteSettings {
  admin_username: string
  allow_new_user_registration: boolean
}

interface AdminMailSettings {
  mailer: 'smtp' | 'log'
  host: string | null
  port: number | null
  username: string | null
  has_password: boolean
  encryption: 'tls' | 'ssl' | null
  from_address: string | null
  from_name: string | null
  timeout: number | null
  ehlo_domain: string | null
}

interface AdminSettingsResponse {
  site: AdminSiteSettings
  mail: AdminMailSettings
}

export default function AdminPage() {
  const isDark = useComputedColorScheme('light') === 'dark'
  const { adminToken, setAdminToken, clearAdminToken } = useAdminStore()
  const [loginError, setLoginError] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')

  const loginForm = useForm({
    initialValues: {
      username: 'MemoriesAdmin',
      password: 'WeC4nRemember!tForYouWh0le$al3',
    },
    validate: {
      username: (v) => (v.trim().length > 0 ? null : 'Username is required'),
      password: (v) => (v.trim().length > 0 ? null : 'Password is required'),
    },
  })

  const settingsForm = useForm({
    initialValues: {
      admin_username: 'MemoriesAdmin',
      admin_password: '',
      allow_new_user_registration: true,
      mailer: 'smtp' as 'smtp' | 'log',
      host: '',
      port: '587',
      username: '',
      password: '',
      encryption: 'tls' as 'tls' | 'ssl' | '',
      from_address: '',
      from_name: 'Memories Map',
      timeout: '30',
      ehlo_domain: '',
    },
    validate: {
      admin_username: (v) => (v.trim().length > 0 ? null : 'Admin username is required'),
      admin_password: (v) => (v.trim().length === 0 || v.trim().length >= 12 ? null : 'Admin password must be at least 12 characters'),
      host: (v, vals) => (vals.mailer === 'smtp' && v.trim().length < 1 ? 'SMTP host is required' : null),
      port: (v, vals) => {
        if (vals.mailer !== 'smtp') return null
        const n = Number(v)
        return Number.isInteger(n) && n >= 1 && n <= 65535 ? null : 'Port must be between 1 and 65535'
      },
      from_address: (v) => /^\S+@\S+\.\S+$/.test(v) ? null : 'Valid from email is required',
      from_name: (v) => v.trim().length < 1 ? 'From name is required' : null,
    },
  })

  const settingsQuery = useQuery<AdminSettingsResponse>({
    queryKey: ['admin-settings', adminToken],
    enabled: Boolean(adminToken),
    queryFn: () => adminApi.get('/settings').then((res) => res.data),
  })

  useEffect(() => {
    if (!settingsQuery.data) return
    const { site, mail } = settingsQuery.data
    const hydratedValues = {
      admin_username: site.admin_username,
      admin_password: '',
      allow_new_user_registration: site.allow_new_user_registration,
      mailer: mail.mailer,
      host: mail.host ?? '',
      port: mail.port ? String(mail.port) : '',
      username: mail.username ?? '',
      password: '',
      encryption: (mail.encryption ?? '') as 'tls' | 'ssl' | '',
      from_address: mail.from_address ?? '',
      from_name: mail.from_name ?? '',
      timeout: mail.timeout ? String(mail.timeout) : '',
      ehlo_domain: mail.ehlo_domain ?? '',
    }

    setTestEmail(mail.from_address ?? '')
    settingsForm.setValues(hydratedValues)
    settingsForm.resetDirty(hydratedValues)
  }, [settingsQuery.data, settingsForm])

  const hasUnsavedChanges = settingsForm.isDirty()

  const loginMutation = useMutation({
    mutationFn: (vals: typeof loginForm.values) => adminApi.post('/login', vals),
    onSuccess: (res) => {
      setAdminToken(res.data.admin_token)
      setLoginError(null)
      notifications.show({ message: 'Admin login successful.', color: 'teal' })
    },
    onError: () => {
      setLoginError('Invalid admin credentials.')
    },
  })

  const saveSettingsMutation = useMutation({
    mutationFn: (vals: typeof settingsForm.values) => adminApi.put('/settings', {
      site: {
        admin_username: vals.admin_username.trim(),
        admin_password: vals.admin_password.trim() || null,
        allow_new_user_registration: vals.allow_new_user_registration,
      },
      mail: {
        mailer: vals.mailer,
        host: vals.mailer === 'smtp' ? vals.host.trim() : null,
        port: vals.mailer === 'smtp' ? Number(vals.port) : null,
        username: vals.mailer === 'smtp' ? (vals.username.trim() || null) : null,
        password: vals.password.trim() || null,
        encryption: vals.mailer === 'smtp' ? (vals.encryption || null) : null,
        from_address: vals.from_address.trim(),
        from_name: vals.from_name.trim(),
        timeout: vals.mailer === 'smtp' && vals.timeout.trim() ? Number(vals.timeout) : null,
        ehlo_domain: vals.mailer === 'smtp' ? (vals.ehlo_domain.trim() || null) : null,
      },
    }),
    onSuccess: () => {
      notifications.show({ message: 'Admin settings saved.', color: 'teal' })
      settingsForm.resetDirty()
      settingsQuery.refetch()
    },
    onError: () => {
      notifications.show({ message: 'Failed to save admin settings.', color: 'red' })
    },
  })

  const testMailMutation = useMutation({
    mutationFn: () => adminApi.post('/settings/test-mail', { to_email: testEmail.trim() }),
    onSuccess: () => notifications.show({ message: 'Test email sent.', color: 'teal' }),
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notifications.show({ message: message ?? 'Test email failed. Check SMTP settings.', color: 'red' })
    },
  })

  const testConnectionMutation = useMutation({
    mutationFn: () => adminApi.post('/settings/test-connection'),
    onSuccess: (res) => notifications.show({ message: res.data?.message ?? 'SMTP connectivity check passed.', color: 'teal' }),
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notifications.show({ message: message ?? 'SMTP connectivity check failed.', color: 'red' })
    },
  })

  const resetMailMutation = useMutation({
    mutationFn: () => adminApi.post('/settings/reset-mail'),
    onSuccess: (res) => {
      const mail = res.data?.mail
      if (mail) {
        settingsForm.setValues({
          ...settingsForm.values,
          mailer: mail.mailer,
          host: mail.host ?? '',
          port: mail.port ? String(mail.port) : '',
          username: mail.username ?? '',
          password: '',
          encryption: (mail.encryption ?? '') as 'tls' | 'ssl' | '',
          from_address: mail.from_address ?? '',
          from_name: mail.from_name ?? '',
          timeout: mail.timeout ? String(mail.timeout) : '',
          ehlo_domain: mail.ehlo_domain ?? '',
        })
        settingsForm.resetDirty()
      }
      notifications.show({ message: 'Mail settings reset to environment defaults.', color: 'teal' })
    },
    onError: () => notifications.show({ message: 'Failed to reset mail settings.', color: 'red' }),
  })

  const logoutMutation = useMutation({
    mutationFn: () => adminApi.post('/logout'),
    onSettled: () => {
      clearAdminToken()
    },
  })

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'

  if (!adminToken) {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" radius="lg" style={{ backgroundColor: surface, border }}>
          <Stack gap="lg">
            <Group gap="sm">
              <IconShieldCog size={24} color={isDark ? '#22d3e0' : '#005f63'} aria-hidden />
              <Title order={2} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Admin Console</Title>
            </Group>
            <Text style={{ color: isDark ? '#d7e3ec' : '#334155' }}>
              Configure site-wide settings, administrator credentials, and mail delivery.
            </Text>
            {loginError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" role="alert">
                {loginError}
              </Alert>
            )}
            <form onSubmit={loginForm.onSubmit((vals) => loginMutation.mutate(vals))}>
              <Stack gap="md">
                <TextInput label="Admin Username" required {...loginForm.getInputProps('username')} />
                <PasswordInput label="Admin Password" required {...loginForm.getInputProps('password')} />
                <Group justify="space-between">
                  <Anchor component={Link} to="/login">Back to main login</Anchor>
                  <Button type="submit" variant="default" styles={getMapSectionButtonStyles('consolidated', 'solid')} loading={loginMutation.isPending} leftSection={<IconLock size={16} aria-hidden />}>
                    Sign in as Admin
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Container>
    )
  }

  return (
    <Container size="md" py="xl">
      <Group justify="space-between" align="center" mb="lg">
        <Title order={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Admin Settings</Title>
        <Button type="button" variant="default" styles={getMapSectionButtonStyles('danger', 'solid')} onClick={() => logoutMutation.mutate()} loading={logoutMutation.isPending}>
          Log out Admin
        </Button>
      </Group>

      {hasUnsavedChanges && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light" mb="lg" role="status">
          You have unsaved changes.
        </Alert>
      )}

      <form onSubmit={settingsForm.onSubmit((vals) => saveSettingsMutation.mutate(vals))}>
        <Stack gap="lg">
          <Paper p="xl" radius="lg" style={{ backgroundColor: surface, border }}>
            <Stack gap="md">
              <Group gap="sm">
                <IconShieldCog size={22} color={isDark ? '#22d3e0' : '#005f63'} aria-hidden />
                <Title order={3} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Site Controls</Title>
              </Group>
              <TextInput label="Admin Username" required {...settingsForm.getInputProps('admin_username')} />
              <PasswordInput
                label="Admin Password"
                description="Leave blank to keep current admin password."
                {...settingsForm.getInputProps('admin_password')}
              />
              <Switch
                label="Allow new user registration"
                checked={settingsForm.values.allow_new_user_registration}
                onChange={(e) => settingsForm.setFieldValue('allow_new_user_registration', e.currentTarget.checked)}
              />
            </Stack>
          </Paper>

          <Paper p="xl" radius="lg" style={{ backgroundColor: surface, border }}>
            <Stack gap="md">
              <Group gap="sm">
                <IconMail size={22} color={isDark ? '#22d3e0' : '#005f63'} aria-hidden />
                <Title order={3} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Mail Delivery</Title>
              </Group>

              <Select
                label="Mailer"
                required
                data={[
                  { value: 'smtp', label: 'SMTP' },
                  { value: 'log', label: 'Log (no delivery)' },
                ]}
                {...settingsForm.getInputProps('mailer')}
              />

              {settingsForm.values.mailer === 'smtp' && (
                <>
                  <TextInput label="SMTP Server" required {...settingsForm.getInputProps('host')} />
                  <Group grow>
                    <TextInput label="Port" required {...settingsForm.getInputProps('port')} />
                    <Select
                      label="Encryption"
                      data={[
                        { value: '', label: 'None' },
                        { value: 'tls', label: 'TLS' },
                        { value: 'ssl', label: 'SSL' },
                      ]}
                      {...settingsForm.getInputProps('encryption')}
                    />
                  </Group>
                  <TextInput label="Username" {...settingsForm.getInputProps('username')} />
                  <PasswordInput
                    label="Password"
                    placeholder={settingsQuery.data?.mail.has_password ? 'Leave blank to keep existing password' : 'Optional'}
                    {...settingsForm.getInputProps('password')}
                  />
                  <Group grow>
                    <TextInput label="Timeout (seconds)" {...settingsForm.getInputProps('timeout')} />
                    <TextInput label="EHLO Domain" {...settingsForm.getInputProps('ehlo_domain')} />
                  </Group>
                </>
              )}

              <Group grow>
                <TextInput label="From Email" required {...settingsForm.getInputProps('from_address')} />
                <TextInput label="From Name" required {...settingsForm.getInputProps('from_name')} />
              </Group>

              <Group grow>
                <TextInput
                  label="Send test email to"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.currentTarget.value)}
                />
                <Group justify="flex-end" align="flex-end">
                  <Button
                    type="button"
                    variant="default"
                    styles={getMapSectionButtonStyles('map')}
                    onClick={() => testMailMutation.mutate()}
                    loading={testMailMutation.isPending}
                    disabled={!/^\S+@\S+\.\S+$/.test(testEmail)}
                  >
                    Send Test Email
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    styles={getMapSectionButtonStyles('timeline')}
                    onClick={() => testConnectionMutation.mutate()}
                    loading={testConnectionMutation.isPending}
                  >
                    Test SMTP Connection
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    styles={getMapSectionButtonStyles('danger')}
                    onClick={() => resetMailMutation.mutate()}
                    loading={resetMailMutation.isPending}
                  >
                    Reset Mail To Env Defaults
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button type="submit" variant="default" styles={getMapSectionButtonStyles('consolidated', 'solid')} loading={saveSettingsMutation.isPending} disabled={!hasUnsavedChanges}>
              Save Admin Settings
            </Button>
          </Group>
        </Stack>
      </form>
    </Container>
  )
}
