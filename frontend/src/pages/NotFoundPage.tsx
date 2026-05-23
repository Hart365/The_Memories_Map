import { Link } from 'react-router-dom'
import { Box, Button, Container, Stack, Text, Title, useComputedColorScheme } from '@mantine/core'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

export default function NotFoundPage() {
  const isDark = useComputedColorScheme('light') === 'dark'

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
      <Container size="sm">
        <Stack gap="sm" align="center">
          <Title order={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>404 - Page not found</Title>
          <Text c="dimmed">The page you are looking for does not exist.</Text>
          <Button component={Link} to="/dashboard" variant="default" styles={getMapSectionButtonStyles('consolidated', 'solid')}>
            Back to dashboard
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
