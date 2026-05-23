import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Container,
  Title,
  Text,
  Button,
  TextInput,
  PasswordInput,
  Paper,
  Group,
  Stack,
  Box,
  Grid,
  ThemeIcon,
  SimpleGrid,
  Divider,
  Badge,
  Anchor,
  Alert,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconPhoto,
  IconTimeline,
  IconMap,
  IconLogin,
  IconAlertCircle,
  IconStar,
  IconUsers,
  IconLock,
  IconWorldUpload,
} from '@tabler/icons-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import appLogo from '@/assets/MMap.svg'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

const FEATURES = [
  {
    icon: IconMap,
    color: 'teal',
    title: 'Interactive Maps',
    description: 'Pin your memories to real locations. Explore your travels with full Leaflet map integration.',
  },
  {
    icon: IconPhoto,
    color: 'violet',
    title: 'Media Gallery',
    description: 'Upload photos & videos. Browse with smart filtering, bulk editing, and caption tools.',
  },
  {
    icon: IconTimeline,
    color: 'orange',
    title: 'Hierarchical Timeline',
    description: 'Navigate Year → Month → Day → Hour. See your story unfold across time.',
  },
  {
    icon: IconWorldUpload,
    color: 'indigo',
    title: 'Share & Collaborate',
    description: 'Invite guests to view your maps. Share memories with family and friends.',
  },
  {
    icon: IconStar,
    color: 'amber',
    title: 'Smart Statistics',
    description: 'Visualise your media with colourful year-by-year charts. Discover patterns in your memories.',
  },
  {
    icon: IconLock,
    color: 'rose',
    title: 'Private & Secure',
    description: 'Your data stays yours. Token-based auth, private by default, guest access on your terms.',
  },
]

const FEATURE_CARD_BACKGROUNDS = [
  'linear-gradient(135deg, rgba(224,249,250,0.96) 0%, rgba(255,255,255,0.98) 100%)',
  'linear-gradient(135deg, rgba(243,232,255,0.96) 0%, rgba(255,255,255,0.98) 100%)',
  'linear-gradient(135deg, rgba(255,244,230,0.96) 0%, rgba(255,255,255,0.98) 100%)',
  'linear-gradient(135deg, rgba(238,242,255,0.96) 0%, rgba(255,255,255,0.98) 100%)',
  'linear-gradient(135deg, rgba(255,251,230,0.96) 0%, rgba(255,255,255,0.98) 100%)',
  'linear-gradient(135deg, rgba(255,240,243,0.96) 0%, rgba(255,255,255,0.98) 100%)',
]

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [allowRegistration, setAllowRegistration] = useState(true)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { setColorScheme } = useMantineColorScheme()
  const computedScheme = useComputedColorScheme('light')
  const isDark = computedScheme === 'dark'
  const muted = isDark ? '#c7d2de' : '#4a5568'

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length < 1 ? 'Password is required' : null),
    },
  })

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/auth/login', values)
      const { token, user } = res.data
      setAuth(token, user)
      navigate('/dashboard')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr?.response?.data?.message ?? 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void api.get('/public/settings')
      .then((res) => {
        if (typeof res.data?.allow_new_user_registration === 'boolean') {
          setAllowRegistration(res.data.allow_new_user_registration)
        }
      })
      .catch(() => {
        setAllowRegistration(true)
      })
  }, [])

  const brand = isDark ? '#22d3e0' : '#005f63'
  const bodyText = isDark ? '#d7e3ec' : '#334155'
  const heroPanelBackground = isDark
    ? 'linear-gradient(180deg, rgba(18,29,38,0.92) 0%, rgba(11,24,31,0.96) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(245,252,252,0.94) 100%)'
  const heroPanelBorder = isDark ? '1px solid rgba(34,211,224,0.18)' : '1px solid rgba(0,95,99,0.12)'
  const formPanelBackground = isDark
    ? 'linear-gradient(180deg, rgba(26,32,40,0.98) 0%, rgba(17,27,35,0.98) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,255,255,0.98) 100%)'

  return (
    <Box
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'radial-gradient(circle at top left, rgba(34,211,224,0.14) 0%, transparent 28%), radial-gradient(circle at 82% 18%, rgba(155,61,255,0.16) 0%, transparent 24%), linear-gradient(135deg, #081117 0%, #0d1f24 52%, #102a2d 100%)'
          : 'radial-gradient(circle at top left, rgba(77,216,230,0.34) 0%, transparent 30%), radial-gradient(circle at 86% 18%, rgba(204,148,255,0.26) 0%, transparent 24%), radial-gradient(circle at 72% 78%, rgba(255,201,153,0.28) 0%, transparent 20%), linear-gradient(140deg, #ecfbfb 0%, #dff6f5 52%, #eef9f3 100%)',
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

      {/* Dark mode toggle (top-right) */}
      <Box style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <Button
          variant="default"
          styles={getMapSectionButtonStyles('map')}
          size="sm"
          onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? '☀ Light' : '🌙 Dark'}
        </Button>
      </Box>

      <Container size="xl" py="xl" style={{ position: 'relative', zIndex: 1 }}>
        <Stack gap="xl">
          {/* ── Hero ────────────────────────────────────────────────────────── */}
          <Grid align="center" gap="xl" mt="xl">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper
                p={{ base: 'lg', md: 'xl' }}
                radius="xl"
                style={{
                  background: heroPanelBackground,
                  border: heroPanelBorder,
                  boxShadow: isDark ? '0 22px 54px rgba(0,0,0,0.32)' : '0 22px 54px rgba(0,95,99,0.10)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                <Stack gap="lg">
                  <Group gap="sm">
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
                    <Box>
                      <Title
                        order={1}
                        style={{ fontSize: '2.5rem', lineHeight: 1.05, color: brand }}
                      >
                        Memories Map
                      </Title>
                      <Text size="sm" fw={600} style={{ color: muted }}>
                        Your personal memory atlas
                      </Text>
                    </Box>
                  </Group>

                  <Title
                    order={2}
                    style={{
                      fontSize: '2rem',
                      lineHeight: 1.22,
                      color: isDark ? '#f0f4f8' : '#1a1f2e',
                    }}
                  >
                    Capture, map and relive{' '}
                    <Text
                      component="span"
                      style={{
                        color: brand,
                        fontSize: '2rem',
                        fontWeight: 800,
                      }}
                    >
                      your best moments
                    </Text>
                  </Title>

                  <Text
                    size="lg"
                    style={{ color: bodyText, lineHeight: 1.75, maxWidth: 640 }}
                  >
                    Upload photos and videos, pin them to real locations, explore
                    them on an interactive map, and travel through your personal
                    timeline — organised by year, month, day and hour.
                  </Text>

                  <Group gap="sm">
                    <Badge size="lg" variant="light" color="teal" radius="md">📸 Photo & Video</Badge>
                    <Badge size="lg" variant="light" color="violet" radius="md">🗺 Interactive Map</Badge>
                    <Badge size="lg" variant="light" color="orange" radius="md">⏱ Timeline</Badge>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>

            {/* ── Login Form ────────────────────────────────────────────────── */}
            <Grid.Col span={{ base: 12, md: 5 }} offset={{ md: 1 }}>
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
                  <Box>
                    <Title order={3} mb={4} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                      Sign in
                    </Title>
                    <Text size="sm" style={{ color: bodyText }}>
                      Welcome back — your memories await.
                    </Text>
                  </Box>

                  {error && (
                    <Alert
                      icon={<IconAlertCircle size={16} />}
                      color="red"
                      variant="light"
                      radius="md"
                      role="alert"
                    >
                      {error}
                    </Alert>
                  )}

                  <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
                    <Stack gap="md">
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
                        placeholder="Your password"
                        required
                        withAsterisk={false}
                        autoComplete="current-password"
                        {...form.getInputProps('password')}
                      />
                      <Button
                        type="submit"
                        variant="default"
                        styles={getMapSectionButtonStyles('consolidated', 'solid')}
                        fullWidth
                        loading={loading}
                        leftSection={<IconLogin size={18} aria-hidden />}
                        size="md"
                        radius="md"
                        aria-label="Sign in to Memories Map"
                      >
                        Sign in
                      </Button>
                    </Stack>
                  </form>

                  {allowRegistration && (
                    <>
                      <Divider label="New here?" labelPosition="center" styles={{ label: { color: muted } }} />

                      <Button
                        variant="default"
                        styles={getMapSectionButtonStyles('gallery')}
                        fullWidth
                        radius="md"
                        component={Link}
                        to="/register"
                        leftSection={<IconUsers size={18} aria-hidden />}
                      >
                        Create a free account
                      </Button>
                    </>
                  )}

                  <Text size="xs" ta="center" style={{ color: muted }}>
                    Site administrator?{' '}
                    <Anchor component={Link} to="/admin" size="xs" style={{ color: brand, fontWeight: 700 }}>
                      Open Admin Console
                    </Anchor>
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>

          {/* ── Features ──────────────────────────────────────────────────── */}
          <Box py="xl">
            <Title
              order={2}
              ta="center"
              mb="xl"
              style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}
            >
              Everything you need to preserve your memories
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {FEATURES.map((feat, index) => (
                <Paper
                  key={feat.title}
                  p="lg"
                  radius="lg"
                  style={{
                    background: isDark
                      ? 'linear-gradient(180deg, rgba(26,32,40,0.98) 0%, rgba(18,28,36,0.98) 100%)'
                      : FEATURE_CARD_BACKGROUNDS[index],
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,95,99,0.06)',
                    boxShadow: isDark ? '0 16px 34px rgba(0,0,0,0.2)' : '0 14px 30px rgba(0,95,99,0.08)',
                  }}
                >
                  <Group gap="md" mb="sm">
                    <ThemeIcon size={44} radius="md" color={feat.color} variant="light">
                      <feat.icon size={24} aria-hidden />
                    </ThemeIcon>
                    <Text fw={700} size="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                      {feat.title}
                    </Text>
                  </Group>
                  <Text size="sm" style={{ lineHeight: 1.7, color: bodyText }}>
                    {feat.description}
                  </Text>
                </Paper>
              ))}
            </SimpleGrid>
          </Box>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <Box ta="center" py="md">
            <Text size="sm" style={{ color: muted }}>
              &copy; {new Date().getFullYear()} Memories Map.{' '}
              {allowRegistration && (
                <Anchor component={Link} to="/register" size="sm" style={{ color: brand, fontWeight: 600 }}>
                  Create an account
                </Anchor>
              )}
            </Text>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
