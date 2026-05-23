import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Container,
  Title,
  Text,
  Button,
  TextInput,
  PasswordInput,
  Paper,
  Stack,
  Box,
  Alert,
  Divider,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconUserPlus,
  IconAlertCircle,
  IconLogin,
} from '@tabler/icons-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import appLogo from '@/assets/MMap.svg'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { setColorScheme } = useMantineColorScheme()
  const computedScheme = useComputedColorScheme('light')
  const isDark = computedScheme === 'dark'
  const muted = isDark ? '#c7d2de' : '#4a5568'

  const form = useForm({
    initialValues: { name: '', email: '', password: '', password_confirmation: '' },
    validate: {
      name: (v) => (v.trim().length < 2 ? 'Name must be at least 2 characters' : null),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length < 8 ? 'Password must be at least 8 characters' : null),
      password_confirmation: (v, vals) => (v !== vals.password ? 'Passwords do not match' : null),
    },
  })

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/auth/register', values)
      const { token, user } = res.data
      setAuth(token, user)
      navigate('/dashboard')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr?.response?.data?.message ?? 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const brand = isDark ? '#22d3e0' : '#003d40'
  const bodyText = isDark ? '#d7e3ec' : '#334155'
  const formPanelBackground = isDark
    ? 'linear-gradient(180deg, rgba(26,32,40,0.98) 0%, rgba(17,27,35,0.98) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,255,255,0.98) 100%)'

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'radial-gradient(circle at top left, rgba(34,211,224,0.14) 0%, transparent 28%), radial-gradient(circle at 82% 18%, rgba(155,61,255,0.16) 0%, transparent 24%), linear-gradient(135deg, #081117 0%, #0d1f24 52%, #102a2d 100%)'
          : 'radial-gradient(circle at top left, rgba(128,228,238,0.34) 0%, transparent 30%), radial-gradient(circle at 86% 18%, rgba(204,148,255,0.24) 0%, transparent 22%), radial-gradient(circle at 72% 78%, rgba(255,201,153,0.24) 0%, transparent 18%), linear-gradient(140deg, #ecfbfb 0%, #dff6f5 52%, #eef9f3 100%)',
        padding: '24px',
      }}
    >
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: isDark
            ? 'linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%)',
        }}
      />

      <Box style={{ position: 'absolute', top: 16, right: 16 }}>
        <Button variant="default" styles={getMapSectionButtonStyles('map')} size="sm"
          onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? '☀ Light' : '🌙 Dark'}
        </Button>
      </Box>

      <Container size={480} w="100%" style={{ position: 'relative', zIndex: 1 }}>
        <Paper
          shadow="xl"
          p="xl"
          radius="lg"
          style={{
            background: formPanelBackground,
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: isDark ? '0 24px 56px rgba(0,0,0,0.34)' : '0 24px 56px rgba(0,95,99,0.12)',
          }}
        >
          <Stack gap="lg">
            {/* Header */}
            <Stack gap="xs" align="center">
              <Box
                aria-hidden
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(34,211,224,0.22) 0%, rgba(128,227,255,0.16) 100%)'
                    : 'linear-gradient(135deg, rgba(128,228,238,0.92) 0%, rgba(224,249,250,0.92) 100%)',
                  border: isDark ? '1px solid rgba(34,211,224,0.26)' : '1px solid rgba(0,95,99,0.10)',
                }}
              >
                <img src={appLogo} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              </Box>
              <Title order={1} style={{ fontSize: '1.75rem', color: brand }}>
                Create Account
              </Title>
              <Text size="sm" ta="center" style={{ color: bodyText, maxWidth: 320, lineHeight: 1.6 }}>
                Join Memories Map and start preserving your story.
              </Text>
            </Stack>

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" role="alert">
                {error}
              </Alert>
            )}

            <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
              <Stack gap="md">
                <TextInput
                  label="Full name (required)"
                  placeholder="Jane Smith"
                  required
                  withAsterisk={false}
                  {...form.getInputProps('name')}
                />
                <TextInput
                  label="Email address (required)"
                  type="email"
                  placeholder="you@example.com"
                  required
                  withAsterisk={false}
                  autoComplete="email"
                  {...form.getInputProps('email')}
                />
                <PasswordInput
                  label="Password (required)"
                  description="At least 8 characters"
                  styles={{ description: { color: muted } }}
                  placeholder="Create a strong password"
                  required
                  withAsterisk={false}
                  autoComplete="new-password"
                  {...form.getInputProps('password')}
                />
                <PasswordInput
                  label="Confirm password (required)"
                  placeholder="Repeat your password"
                  required
                  withAsterisk={false}
                  autoComplete="new-password"
                  {...form.getInputProps('password_confirmation')}
                />
                <Button
                  type="submit"
                  variant="default"
                  styles={getMapSectionButtonStyles('consolidated', 'solid')}
                  fullWidth
                  loading={loading}
                  leftSection={<IconUserPlus size={18} aria-hidden />}
                  size="md"
                  radius="md"
                >
                  Create account
                </Button>
              </Stack>
            </form>

            <Divider label="Already have an account?" labelPosition="center" styles={{ label: { color: muted } }} />
            <Button
              variant="default"
              styles={getMapSectionButtonStyles('gallery')}
              fullWidth
              radius="md"
              component={Link}
              to="/login"
              leftSection={<IconLogin size={18} aria-hidden />}
            >
              Sign in
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
