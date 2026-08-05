import { Link } from 'react-router-dom'
import useAuth from '../auth/useAuth.js'

export default function HomePage() {
  const { loading, user } = useAuth()

  return (
    <main className="page hero">
      <p className="eyebrow">Interactive firearm education</p>
      <h1>Trigger3D</h1>
      <p className="lede">
        Explore firearm components in 3D, review their functions, and complete guided assessments.
      </p>
      {!loading && (
        <Link className="button" to={user ? '/account' : '/login'}>
          {user ? 'Open account' : 'Sign in'}
        </Link>
      )}
    </main>
  )
}
