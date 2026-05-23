import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useComputedColorScheme,
} from '@mantine/core'
import { IconAlertCircle, IconLogin } from '@tabler/icons-react'
import api from '@/lib/api'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

export default function GuestAccessPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const navigate = useNavigate()
  const isDark = useComputedColorScheme('light') === 'dark'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data } = await api.post('/auth/guest-login', {
        email,
        password,
        map_id: Number(mapId),
      })

      sessionStorage.setItem('guest_token', data.access_token)
      sessionStorage.setItem('guest_map_id', String(mapId))
      navigate(`/maps/${mapId}/consolidated`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Access denied. Check your email and password.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: isDark
          ? 'linear-gradient(160deg, #0f1318 0%, #12252f 60%, #0b1a22 100%)'
          : 'linear-gradient(160deg, #eaf7f6 0%, #d9f0ef 50%, #cce8e6 100%)',
      }}
    >
      <Container size={520} w="100%" py="lg">
        <Paper p="xl" radius="lg" shadow="xl" style={{ backgroundColor: isDark ? '#1a2028' : '#ffffff' }}>
          <Stack gap="md">
            <Title order={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Access Shared Map</Title>
            <Text c="dimmed">
              Enter the invitation email and password to open this shared memories map.
            </Text>

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" role="alert">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate aria-label="Guest access form">
              <Stack gap="sm">
                <TextInput
                  id="g-email"
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  autoComplete="email"
                  required
                />
                <PasswordInput
                  id="g-password"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  autoComplete="current-password"
                  required
                />
                <Button type="submit" variant="default" styles={getMapSectionButtonStyles('consolidated', 'solid')} fullWidth loading={loading} leftSection={<IconLogin size={16} aria-hidden />}>
                  Access map
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
