import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  return (
    <main className={styles.page}>
      <h1>404 – Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>
    </main>
  )
}
