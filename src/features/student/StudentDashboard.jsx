import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isValidFullName, normalizeFullName } from '../../auth/name.js'
import useAuth from '../../auth/useAuth.js'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import { supabase } from '../../lib/supabase.js'
import { isDemoMode } from '../../lib/supabase.js'
import AdminSettings from '../admin/AdminSettings.jsx'
import DemoStudentDashboard from './DemoStudentDashboard.jsx'
import { getStudentFirearmDestination } from './assessment/assessment-lock.js'
import { getStudentGreeting } from './student-greeting.js'
import StudentSidebar from './StudentSidebar.jsx'
import { getSavedDashboardPage, saveDashboardPage } from '../../components/dashboard-location.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'

const studentPages = ['overview', 'enrollment', 'models', 'results']
const studentDashboardPageKey = 'trigger3d.student.active-page'

export default function StudentDashboard() {
  if (isDemoMode) return <DemoStudentDashboard />

  return <LiveStudentDashboard />
}

function LiveStudentDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [enrollments, setEnrollments] = useState([])
  const [firearms, setFirearms] = useState([])
  const [results, setResults] = useState([])
  const [attempts, setAttempts] = useState([])
  const [classCode, setClassCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activePage, setActivePage] = useState(() => (
    getSavedDashboardPage(localStorage, studentDashboardPageKey, studentPages, 'overview')
  ))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [greeting] = useState(() => getStudentGreeting(profile, localStorage))

  useAutoDismissNotice(notice, () => setNotice(''))

  const loadEnrollment = useCallback(async () => {
    const { data, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        enrolled_at,
        class:classes!enrollments_class_id_fkey(id, name, code)
      `)
      .order('enrolled_at', { ascending: false })

    if (enrollmentError) {
      setError(enrollmentError.message)
      setLoading(false)
      return
    }

    setEnrollments(data)

    const hasActiveEnrollment = data.some((item) => item.status === 'active')

    if (hasActiveEnrollment) {
      const [firearmResult, resultQuery] = await Promise.all([
        supabase
          .from('firearms')
          .select('id, identifier, name, caliber, description, status')
          .eq('status', 'ready')
          .order('created_at'),
        supabase
          .from('assessment_attempts')
          .select(`
            id,
            firearm_id,
            status,
            correct_count,
            total_questions,
            percentage,
            submitted_at,
            firearm:firearms!assessment_attempts_firearm_id_fkey(name, caliber)
          `)
          .order('submitted_at', { ascending: false }),
      ])

      if (firearmResult.error || resultQuery.error) {
        setError(firearmResult.error?.message || resultQuery.error.message)
      } else {
        setFirearms(firearmResult.data)
        setAttempts(resultQuery.data)
        setResults(resultQuery.data.filter((attempt) => attempt.status === 'submitted'))
      }
    } else {
      setFirearms([])
      setResults([])
      setAttempts([])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    // The loader begins with an awaited Supabase request; state changes occur after it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEnrollment()
  }, [loadEnrollment])

  async function handleJoinClass(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!classCode.trim()) {
      setError('Enter the class code supplied by your instructor.')
      return
    }

    setJoining(true)
    const { error: joinError } = await supabase.rpc('join_class', {
      class_code: classCode.trim(),
    })

    if (joinError) {
      setError(joinError.message)
    } else {
      setClassCode('')
      setNotice('You are now enrolled in the class.')
      await loadEnrollment()
    }

    setJoining(false)
  }

  async function handleNameSetup(event) {
    event.preventDefault()
    setError('')

    if (!isValidFullName(fullName)) {
      setError('Enter your full name using between 2 and 100 characters.')
      return
    }

    setSavingName(true)
    const { error: nameError } = await supabase.rpc('set_own_full_name', {
      new_full_name: normalizeFullName(fullName),
    })

    if (nameError) setError(nameError.message)
    else await refreshProfile()

    setSavingName(false)
  }

  const activeEnrollment = enrollments.find((item) => item.status === 'active')
  const latestRemovedEnrollment = enrollments.find((item) => item.status === 'removed')

  function navigateSection(section) {
    setActivePage(section)
    saveDashboardPage(localStorage, studentDashboardPageKey, section)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!profile?.full_name) {
    return (
      <RoleDashboard
        title="Complete your profile"
        description="Add your name before accessing Trigger3D learning materials."
      >
        <article className="dashboard-card dashboard-card-wide">
          <h2>Student name</h2>
          <p>Your instructor will use this name to identify your enrollment and results.</p>
          <form className="inline-form" onSubmit={handleNameSetup}>
            <label htmlFor="student-full-name">Full name</label>
            <div className="inline-form-row">
              <input
                id="student-full-name"
                type="text"
                autoComplete="name"
                minLength="2"
                maxLength="100"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={savingName}
                required
              />
              <button type="submit" disabled={savingName}>
                {savingName ? 'Saving...' : 'Save name'}
              </button>
            </div>
          </form>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
        </article>
      </RoleDashboard>
    )
  }

  return (
    <RoleDashboard
      title="Student dashboard"
      description="Join your class before accessing Trigger3D learning materials."
      hideUser
      sidebar={<StudentSidebar activePage={activePage} collapsed={sidebarCollapsed} onNavigate={navigateSection} onToggle={() => setSidebarCollapsed((value) => !value)} settings={<AdminSettings roleName="Student" sidebar />} />}
    >
      {activePage === 'overview' && <section className="admin-dashboard-section">
        <article className="dashboard-card dashboard-card-wide admin-welcome">
          <p className="eyebrow">Student workspace</p>
          <h2>{greeting}</h2>
          <p>Join your class, explore available 3D models, and keep track of your assessment results here.</p>
        </article>
      </section>}

      {activePage === 'enrollment' && <article className="dashboard-card dashboard-card-wide">
        <h2>Class enrollment</h2>
        {loading ? (
          <p>Loading enrollment...</p>
        ) : activeEnrollment ? (
          <div className="enrollment-summary">
            <span className="status-badge active">active</span>
            <h3>{activeEnrollment.class.name}</h3>
            <p>Class code: <strong>{activeEnrollment.class.code}</strong></p>
          </div>
        ) : (
          <>
            <p>Enter the class code provided by your instructor.</p>
            {latestRemovedEnrollment && (
              <p className="removed-note">
                You were removed from {latestRemovedEnrollment.class?.name || 'a class'}.
                That class requires Faculty re-admission.
              </p>
            )}
            <form className="inline-form" onSubmit={handleJoinClass}>
              <label htmlFor="class-code">Class code</label>
              <div className="inline-form-row">
                <input
                  id="class-code"
                  value={classCode}
                  onChange={(event) => setClassCode(event.target.value.toUpperCase())}
                  placeholder="Enter code"
                  maxLength="16"
                  disabled={joining}
                  required
                />
                <button type="submit" disabled={joining}>
                  {joining ? 'Joining...' : 'Join class'}
                </button>
              </div>
            </form>
          </>
        )}
      </article>}

      {activePage === 'models' && <article className="dashboard-card">
        <h2>3D models</h2>
        {!activeEnrollment ? (
          <p>Enroll in an active class to unlock firearm models.</p>
        ) : firearms.length === 0 ? (
          <p>No firearm models are currently available.</p>
        ) : (
          <div className="available-models">
            {firearms.map((firearm) => (
              <Link
                className={attempts.some(
                  (attempt) => attempt.firearm_id === firearm.id && attempt.status === 'in_progress',
                ) ? 'model-locked' : ''}
                to={getStudentFirearmDestination(
                  firearm.id,
                  attempts.some(
                    (attempt) => attempt.firearm_id === firearm.id && attempt.status === 'in_progress',
                  ),
                )}
                key={firearm.id}
              >
                <strong>{firearm.name}</strong>
                <span>{attempts.some(
                  (attempt) => attempt.firearm_id === firearm.id && attempt.status === 'in_progress',
                ) ? 'Resume assessment · model locked' : firearm.caliber}</span>
              </Link>
            ))}
          </div>
        )}
      </article>}

      {activePage === 'results' && <article className="dashboard-card">
        <h2>Your results</h2>
        {results.length === 0 ? (
          <p>No assessment results yet.</p>
        ) : (
          <div className="result-list">
            {results.map((result) => (
              <Link
                to={`/student/models/${result.firearm_id}/assessment`}
                key={result.id}
              >
                <div>
                  <strong>{result.firearm.name}</strong>
                  <span>{result.correct_count}/{result.total_questions} correct</span>
                </div>
                <strong>{Number(result.percentage).toFixed(2)}%</strong>
              </Link>
            ))}
          </div>
        )}
      </article>}

      {(error || notice) && (
        <div
          className={`alert dashboard-message ${error ? 'alert-error' : 'alert-success'}`}
          role={error ? 'alert' : 'status'}
        >
          {error || notice}
        </div>
      )}
    </RoleDashboard>
  )
}
