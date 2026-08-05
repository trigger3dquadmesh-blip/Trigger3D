import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="page">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <Link className="text-link" to="/">Return home</Link>
    </main>
  )
}
