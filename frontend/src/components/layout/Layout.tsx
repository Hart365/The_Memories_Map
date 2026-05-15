import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import '@/styles/components.css'
import styles from './Layout.module.css'

export default function Layout() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  const handleLogout = async () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <>
      {/* Skip link – WCAG 2.4.1 */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className={styles.header} role="banner">
        <div className={styles.headerInner}>
          <Link to="/dashboard" className={styles.brand} aria-label="Memories Map – home">
            <svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
            </svg>
            Memories Map
          </Link>

          <nav aria-label="Main navigation">
            <ul className={styles.navList} role="list">
              <li><Link to="/dashboard">My Maps</Link></li>
              <li><Link to="/settings">Settings</Link></li>
              {user && (
                <li>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleLogout}
                    aria-label={`Log out ${user.name}`}
                  >
                    Log out
                  </button>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>

      <footer className={styles.footer} role="contentinfo">
        <p>&copy; {new Date().getFullYear()} Memories Map. All rights reserved.</p>
      </footer>
    </>
  )
}
