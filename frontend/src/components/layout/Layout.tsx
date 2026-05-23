import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  AppShell,
  Group,
  Burger,
  ActionIcon,
  Menu,
  Avatar,
  Text,
  NavLink,
  Stack,
  Tooltip,
  useMantineColorScheme,
  useComputedColorScheme,
  TextInput,
  Kbd,
  ScrollArea,
  Divider,
  Badge,
  Box,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconHome,
  IconSettings,
  IconLogout,
  IconSun,
  IconMoon,
  IconSearch,
  IconMap,
  IconPhoto,
  IconTimeline,
  IconLayoutDashboard,
  IconX,
} from '@tabler/icons-react'
import { useAuthStore } from '@/store/authStore'
import appLogo from '@/assets/MMap.svg'
import { getMapSectionNavLinkStyles, getMapSectionPalette } from '@/lib/mapSectionButtonStyles'

export default function Layout() {
  const [navOpen, { toggle: toggleNav, close: closeNav }] = useDisclosure(false)
  const [searchQuery, setSearchQuery] = useState('')
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light')
  const isDark = computedColorScheme === 'dark'
  const navigate = useNavigate()
  const location = useLocation()
  const dangerPalette = getMapSectionPalette('danger')

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const toggleColorScheme = () => {
    setColorScheme(isDark ? 'light' : 'dark')
  }

  // Extract mapId from URL for contextual map nav links
  const mapIdMatch = location.pathname.match(/^\/maps\/(\d+)/)
  const currentMapId = mapIdMatch ? mapIdMatch[1] : null

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  const brandColor = isDark ? '#22d3e0' : '#005f63'

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim() && currentMapId) {
      navigate(`/maps/${currentMapId}/gallery?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  return (
    <>
      {/* Skip link – WCAG 2.4.1 */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 240,
          breakpoint: 'lg',
          collapsed: { mobile: !navOpen },
        }}
        padding="md"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <AppShell.Header
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(8,27,36,0.98) 0%, rgba(14,35,46,0.98) 100%)'
              : '#ffffff',
            borderBottom: isDark ? '1px solid rgba(34,211,224,0.22)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            {/* Brand */}
            <Group gap="sm">
              <Link
                to="/dashboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  color: brandColor,
                  fontWeight: 700,
                  fontSize: '1.1rem',
                }}
                aria-label="Memories Map home"
              >
                <img
                  src={appLogo}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 24, height: 24, objectFit: 'contain' }}
                />
                <span>Memories Map</span>
              </Link>
            </Group>

            {/* Global search */}
            <Box
              component="form"
              onSubmit={handleSearchSubmit}
              role="search"
              visibleFrom="sm"
              style={{ flex: 1, maxWidth: 420, margin: '0 16px' }}
            >
              <TextInput
                placeholder="Search media… (in current map)"
                leftSection={<IconSearch size={16} aria-hidden />}
                rightSection={
                  searchQuery ? (
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <IconX size={14} aria-hidden />
                    </ActionIcon>
                  ) : (
                    <Kbd size="xs">⏎</Kbd>
                  )
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                aria-label="Search media in current map"
                size="sm"
                radius="md"
                style={{ width: '100%' }}
              />
            </Box>

            {/* Right actions */}
            <Group gap="xs">
              <Burger
                opened={navOpen}
                onClick={toggleNav}
                hiddenFrom="lg"
                size="sm"
                aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
                color={brandColor}
              />

              {/* Dark mode toggle */}
              <Tooltip label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} withArrow>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  onClick={toggleColorScheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  color={isDark ? 'yellow' : 'teal'}
                  radius="md"
                >
                  {isDark
                    ? <IconSun size={20} aria-hidden />
                    : <IconMoon size={20} aria-hidden />
                  }
                </ActionIcon>
              </Tooltip>

              {/* User menu */}
              {user && (
                <Menu shadow="md" width={200} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      size="lg"
                      radius="xl"
                      aria-label={`User menu for ${user.name}`}
                    >
                      <Avatar
                        name={user.name}
                        size={32}
                        radius="xl"
                        color="teal"
                        style={{ cursor: 'pointer' }}
                        aria-hidden
                      />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>
                      <Text size="sm" fw={600}>{user.name}</Text>
                      <Text size="xs" c="dimmed">{user.email}</Text>
                    </Menu.Label>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconSettings size={16} aria-hidden />}
                      onClick={() => navigate('/settings')}
                    >
                      Settings
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconLogout size={16} aria-hidden />}
                      onClick={handleLogout}
                      style={{ color: dangerPalette.solidBackground, fontWeight: 700 }}
                    >
                      Log out
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          </Group>
        </AppShell.Header>

        {/* ── Navbar ──────────────────────────────────────────────────────── */}
        <AppShell.Navbar
          p="xs"
          style={{
            background: isDark
              ? 'linear-gradient(180deg, rgba(9,26,34,0.98) 0%, rgba(13,31,41,0.98) 100%)'
              : '#f8fafb',
            borderRight: isDark ? '1px solid rgba(34,211,224,0.14)' : '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {currentMapId && (
            <AppShell.Section hiddenFrom="sm" mb="xs">
              <Box component="form" onSubmit={handleSearchSubmit} role="search">
                <TextInput
                  placeholder="Search this map"
                  leftSection={<IconSearch size={16} aria-hidden />}
                  rightSection={
                    searchQuery ? (
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                      >
                        <IconX size={14} aria-hidden />
                      </ActionIcon>
                    ) : undefined
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  aria-label="Search media in current map"
                  size="sm"
                  radius="md"
                />
              </Box>
            </AppShell.Section>
          )}

          <AppShell.Section grow component={ScrollArea}>
            <Stack gap="xs" mt="xs">
              {/* Main nav */}
              <NavLink
                component={Link}
                to="/dashboard"
                label="My Maps"
                leftSection={<IconHome size={18} aria-hidden />}
                active={isActive('/dashboard')}
                styles={getMapSectionNavLinkStyles('consolidated', isActive('/dashboard'))}
                onClick={closeNav}
                aria-current={isActive('/dashboard') ? 'page' : undefined}
              />

              {/* Map-specific nav (only shown when inside a map) */}
              {currentMapId && (
                <>
                  <Divider my="xs" label={<Badge size="xs" variant="light" color="teal">Current Map</Badge>} />
                  <NavLink
                    component={Link}
                    to={`/maps/${currentMapId}`}
                    label="Consolidated"
                    description="Map, timeline & gallery"
                    leftSection={<IconLayoutDashboard size={18} aria-hidden />}
                    active={location.pathname === `/maps/${currentMapId}`}
                    styles={getMapSectionNavLinkStyles('consolidated', location.pathname === `/maps/${currentMapId}`)}
                    onClick={closeNav}
                    aria-current={location.pathname === `/maps/${currentMapId}` ? 'page' : undefined}
                  />
                  <NavLink
                    component={Link}
                    to={`/maps/${currentMapId}/timeline`}
                    label="Timeline"
                    description="Year → Month → Day → Hour"
                    leftSection={<IconTimeline size={18} aria-hidden />}
                    active={location.pathname === `/maps/${currentMapId}/timeline`}
                    styles={getMapSectionNavLinkStyles('timeline', location.pathname === `/maps/${currentMapId}/timeline`)}
                    onClick={closeNav}
                    aria-current={location.pathname === `/maps/${currentMapId}/timeline` ? 'page' : undefined}
                  />
                  <NavLink
                    component={Link}
                    to={`/maps/${currentMapId}/map`}
                    label="Map"
                    description="Interactive map view"
                    leftSection={<IconMap size={18} aria-hidden />}
                    active={location.pathname === `/maps/${currentMapId}/map`}
                    styles={getMapSectionNavLinkStyles('map', location.pathname === `/maps/${currentMapId}/map`)}
                    onClick={closeNav}
                    aria-current={location.pathname === `/maps/${currentMapId}/map` ? 'page' : undefined}
                  />
                  <NavLink
                    component={Link}
                    to={`/maps/${currentMapId}/gallery`}
                    label="Gallery"
                    description="Browse all media"
                    leftSection={<IconPhoto size={18} aria-hidden />}
                    active={location.pathname === `/maps/${currentMapId}/gallery`}
                    styles={getMapSectionNavLinkStyles('gallery', location.pathname === `/maps/${currentMapId}/gallery`)}
                    onClick={closeNav}
                    aria-current={location.pathname === `/maps/${currentMapId}/gallery` ? 'page' : undefined}
                  />
                </>
              )}
            </Stack>
          </AppShell.Section>

          {/* Bottom: settings + logout */}
          <AppShell.Section>
            <Divider my="xs" />
            <Stack gap="xs">
              <NavLink
                component={Link}
                to="/settings"
                label="Settings"
                leftSection={<IconSettings size={18} aria-hidden />}
                active={isActive('/settings')}
                styles={getMapSectionNavLinkStyles('upload', isActive('/settings'))}
                onClick={closeNav}
                aria-current={isActive('/settings') ? 'page' : undefined}
              />
              <NavLink
                label="Log out"
                leftSection={<IconLogout size={18} aria-hidden />}
                onClick={handleLogout}
                color="red"
                rightSection={
                  <Text size="xs" c="dimmed">
                    {user?.name}
                  </Text>
                }
              />
            </Stack>
          </AppShell.Section>
        </AppShell.Navbar>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <AppShell.Main id="main-content">
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </>
  )
}
