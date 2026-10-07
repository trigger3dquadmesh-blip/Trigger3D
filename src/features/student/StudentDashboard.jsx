import { useCallback, useEffect, useState } from 'react'
import { isValidFullName, normalizeFullName } from '../../auth/name.js'
import useAuth from '../../auth/useAuth.js'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import { supabase } from '../../lib/supabase.js'
import AdminSettings from '../admin/AdminSettings.jsx'
import StudentSidebar from './StudentSidebar.jsx'
import { StudentClassDetail, StudentClasses, StudentJoinDialog, StudentOverview, StudentResults } from './StudentDashboardPanels.jsx'
import { getSavedDashboardPage } from '../../components/dashboard-location.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'
import useResponsiveSidebar from '../../components/useResponsiveSidebar.js'
import useDashboardTransition from '../../components/useDashboardTransition.js'
import DashboardLoading from '../../components/DashboardLoading.jsx'

const studentPages = ['overview', 'classes', 'class', 'results']
const studentDashboardPageKey = 'trigger3d.student.active-page'
const studentLoadingLabels = { overview: 'Loading dashboard…', classes: 'Loading classes…', class: 'Loading class…', results: 'Loading results…' }

export default function StudentDashboard() {
  return <LiveStudentDashboard />
}

function LiveStudentDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [enrollments, setEnrollments] = useState([])
  const [firearms, setFirearms] = useState([])
  const [attempts, setAttempts] = useState([])
  const [releases, setReleases] = useState([])
  const [components, setComponents] = useState([])
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
  const [sidebarCollapsed, setSidebarCollapsed] = useResponsiveSidebar()
  const [selectedClassId, setSelectedClassId] = useState('')
  const [joinOpen, setJoinOpen] = useState(false)
  const { navigate: transitionTo, pendingPage } = useDashboardTransition(activePage, setActivePage, studentDashboardPageKey)

  useAutoDismissNotice(notice, () => setNotice(''))

  const loadEnrollment = useCallback(async () => {
    let { data, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        enrolled_at,
        class:classes!enrollments_class_id_fkey(id, name, code, term, created_at, archived_at, faculty:profiles!classes_faculty_id_fkey(full_name, email))
      `)
      .order('enrolled_at', { ascending: false })

    if (enrollmentError && /term/i.test(enrollmentError.message || '')) {
      const legacyResult = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          enrolled_at,
          class:classes!enrollments_class_id_fkey(id, name, code, created_at, archived_at, faculty:profiles!classes_faculty_id_fkey(full_name, email))
        `)
        .order('enrolled_at', { ascending: false })
      data = (legacyResult.data || []).map((item) => ({
        ...item,
        class: item.class ? { ...item.class, term: 'Current term' } : item.class,
      }))
      enrollmentError = legacyResult.error
    }

    if (enrollmentError) {
      setError(enrollmentError.message)
      setLoading(false)
      return
    }

    const validEnrollments = (data ?? []).filter((item) => item.class)
    const accessibleEnrollments = validEnrollments.filter((item) => item.status === 'active')
    const historyClassIds = [...new Set(validEnrollments.map((item) => item.class.id))]

    setEnrollments(validEnrollments)
    setSelectedClassId((current) => (
      accessibleEnrollments.some((item) => item.class.id === current)
        ? current
        : accessibleEnrollments[0]?.class.id || ''
    ))

    const hasActiveEnrollment = accessibleEnrollments.length > 0

    if (hasActiveEnrollment) {
      const classIds = [...new Set(accessibleEnrollments.map((item) => item.class.id))]
      const [resultQuery, releaseResult, firearmResult] = await Promise.all([
        supabase
          .from('assessment_attempts')
          .select(`
            id,
            class_id,
            firearm_id,
            status,
            correct_count,
            total_questions,
            percentage,
            timer_started_at,
            has_activity,
            submitted_at,
            firearm:firearms!assessment_attempts_firearm_id_fkey(name, caliber)
          `)
          .in('class_id', historyClassIds)
          .order('submitted_at', { ascending: false }),
        supabase.from('assessment_releases').select('class_id, firearm_id, is_open, updated_at').in('class_id', classIds),
        supabase
          .from('firearms')
          .select('id, identifier, name, caliber, description, firearm_type, tutorial_url, model_credit, status, glb_storage_path')
          .eq('status', 'ready')
          .order('created_at'),
      ])

      if (resultQuery.error || releaseResult.error || firearmResult.error) {
        setError(resultQuery.error?.message || releaseResult.error?.message || firearmResult.error?.message)
        setFirearms([])
        setAttempts([])
        setReleases([])
        setComponents([])
      } else {
        const readyFirearms = firearmResult.data ?? []
        const storedReleases = releaseResult.data ?? []
        const effectiveReleases = classIds.flatMap((classId) => readyFirearms.map((firearm) => {
          const stored = storedReleases.find((item) => item.class_id === classId && item.firearm_id === firearm.id)
          return stored ?? { class_id: classId, firearm_id: firearm.id, is_open: false, updated_at: null }
        }))
        const firearmIds = readyFirearms.map((item) => item.id)
        const componentResult = firearmIds.length
          ? await supabase.from('firearm_components').select('id, firearm_id').in('firearm_id', firearmIds)
          : { data: [], error: null }

        if (componentResult.error) {
          setError(componentResult.error.message)
          setFirearms([])
          setAttempts([])
          setReleases([])
          setComponents([])
        } else {
          setFirearms(readyFirearms)
          setAttempts(resultQuery.data ?? [])
          setReleases(effectiveReleases)
          setComponents(componentResult.data ?? [])
        }
      }
    } else {
      setFirearms([])
      setReleases([])
      setComponents([])
      const historyResult = historyClassIds.length
        ? await supabase
            .from('assessment_attempts')
            .select(`
              id,
              class_id,
              firearm_id,
              status,
              correct_count,
              total_questions,
              percentage,
              timer_started_at,
              has_activity,
              submitted_at,
              firearm:firearms!assessment_attempts_firearm_id_fkey(name, caliber)
            `)
            .in('class_id', historyClassIds)
            .order('submitted_at', { ascending: false })
        : { data: [], error: null }
      if (historyResult.error) {
        setError(historyResult.error.message)
        setAttempts([])
      } else {
        setAttempts(historyResult.data ?? [])
      }
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
      setJoinOpen(false)
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

  const selectedEnrollment = enrollments.find((item) => item.status === 'active' && item.class?.id === selectedClassId)

  function navigateSection(section) {
    transitionTo(section)
  }

  function openClass(classId) {
    setSelectedClassId(classId)
    navigateSection('class')
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
      hideHeader
      variant="role-dashboard-redesign admin-reference-shell student-reference-shell"
      sidebar={<StudentSidebar activePage={pendingPage || activePage} collapsed={sidebarCollapsed} onNavigate={navigateSection} onToggle={() => setSidebarCollapsed((value) => !value)} settings={<AdminSettings profileMenu roleName="Student" sidebar />} />}
    >
      {pendingPage ? <section className="student-reference-page"><DashboardLoading label={studentLoadingLabels[pendingPage]} /></section> : <>
      {activePage === 'overview' && <StudentOverview attempts={attempts} enrollments={enrollments} firearms={firearms} loading={loading} onJoin={() => { setError(''); setJoinOpen(true) }} onNavigate={navigateSection} onOpenClass={openClass} releases={releases} />}
      {activePage === 'classes' && <StudentClasses attempts={attempts} enrollments={enrollments} loading={loading} onOpenClass={openClass} releases={releases} />}
      {activePage === 'class' && loading && <section className="student-reference-page"><DashboardLoading label="Loading class…" /></section>}
      {activePage === 'class' && !loading && selectedEnrollment && <StudentClassDetail attempts={attempts} components={components} enrollment={selectedEnrollment} firearms={firearms} onBack={() => navigateSection('classes')} releases={releases} studentId={profile?.id} />}
      {activePage === 'results' && <StudentResults attempts={attempts} enrollments={enrollments} loading={loading} />}
      {joinOpen && <StudentJoinDialog classCode={classCode} error={error} joining={joining} onChange={setClassCode} onClose={() => { setJoinOpen(false); setError('') }} onSubmit={handleJoinClass} />}

      {(error || notice) && (
        <div
          className={`alert dashboard-message ${error ? 'alert-error' : 'alert-success'}`}
          role={error ? 'alert' : 'status'}
        >
          {error || notice}
        </div>
      )}
      </>}
    </RoleDashboard>
  )
}
