import { useCallback, useEffect, useMemo, useState } from 'react'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import { supabase } from '../../lib/supabase.js'
import AdminSettings from '../admin/AdminSettings.jsx'
import AdminModelViewerPanel from '../admin/AdminModelViewerPanel.jsx'
import FacultyAnalyticsPanel from './FacultyAnalyticsPanel.jsx'
import FacultyClassWorkspace from './FacultyClassWorkspace.jsx'
import FacultyClassesPanel from './FacultyClassesPanel.jsx'
import FacultyOverviewPanel from './FacultyOverviewPanel.jsx'
import FacultySidebar from './FacultySidebar.jsx'
import { sortClassesByName } from './class-utils.js'
import { filterEnrollmentsByStudentQuery } from './enrollment-search.js'
import { getSavedDashboardPage, saveDashboardPage } from '../../components/dashboard-location.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'

const facultyPages = ['overview', 'classes', 'class', 'students', 'assessments', 'results']
const facultyDashboardPageKey = 'trigger3d.faculty.active-page'

export default function FacultyDashboard() {
  return <LiveFacultyDashboard />
}

function LiveFacultyDashboard() {
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [enrollments, setEnrollments] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [resettingId, setResettingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activePage, setActivePage] = useState(() => (
    getSavedDashboardPage(localStorage, facultyDashboardPageKey, facultyPages, 'overview')
  ))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(min-width: 1025px)').matches)
  const [overviewData, setOverviewData] = useState({ attempts: [], enrollments: [], firearms: [], releases: [], resultRows: [] })

  useAutoDismissNotice(notice, () => setNotice(''))

  useEffect(() => {
    const desktopLayout = window.matchMedia('(min-width: 1025px)')
    const updateSidebar = (event) => setSidebarCollapsed(event.matches)
    desktopLayout.addEventListener('change', updateSidebar)
    return () => desktopLayout.removeEventListener('change', updateSidebar)
  }, [])

  const loadClasses = useCallback(async () => {
    const { data, error: classesError } = await supabase
      .from('classes')
      .select('id, name, code, created_at, archived_at')
      .order('created_at', { ascending: false })

    if (classesError) {
      setError(classesError.message)
      setLoading(false)
      return
    }

    const sortedClasses = sortClassesByName(data)
    setClasses(sortedClasses)
    setSelectedClassId((current) => (
      sortedClasses.some((item) => item.id === current) ? current : sortedClasses[0]?.id || ''
    ))

    const classIds = sortedClasses.map((item) => item.id)
    const [studentResult, firearmResult, releaseResult, attemptResult, ...classResultResponses] = await Promise.all([
      classIds.length
        ? supabase.from('enrollments').select('id, class_id, student_id, status, enrolled_at, student:profiles!enrollments_student_id_fkey(id, email, full_name)').in('class_id', classIds)
        : Promise.resolve({ data: [] }),
      supabase.from('firearms').select('id, identifier, name, caliber, description, firearm_type, tutorial_url, model_credit, status, created_at, glb_storage_path').order('created_at'),
      classIds.length
        ? supabase.from('assessment_releases').select('class_id, firearm_id, is_open, updated_at').in('class_id', classIds)
        : Promise.resolve({ data: [] }),
      classIds.length
        ? supabase.from('assessment_attempts').select('id, class_id, student_id, firearm_id, status, percentage, started_at, submitted_at, has_activity').in('class_id', classIds)
        : Promise.resolve({ data: [] }),
      ...classIds.map((classId) => supabase.rpc('get_class_assessment_results', { target_class_id: classId })),
    ])
    const overviewError = studentResult.error || firearmResult.error || releaseResult.error || attemptResult.error || classResultResponses.find((result) => result.error)?.error
    if (overviewError) setError(overviewError.message)
    setOverviewData({
      attempts: attemptResult.data ?? [],
      enrollments: studentResult.data ?? [],
      firearms: firearmResult.data ?? [],
      releases: releaseResult.data ?? [],
      resultRows: classResultResponses.flatMap((result, index) => (result.data ?? []).map((row) => ({ ...row, class_id: classIds[index] }))),
    })
    setLoading(false)
  }, [])

  const loadEnrollments = useCallback(async (classId) => {
    const { data, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        enrolled_at,
        student:profiles!enrollments_student_id_fkey(id, email, full_name)
      `)
      .eq('class_id', classId)
      .order('enrolled_at', { ascending: true })

    if (enrollmentError) {
      setError(enrollmentError.message)
      return
    }

    setEnrollments(data)
  }, [])

  useEffect(() => {
    // The loader begins with an awaited Supabase request; state changes occur after it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClasses()
  }, [loadClasses])

  useEffect(() => {
    if (selectedClassId) {
      // The loader begins with an awaited Supabase request; state changes occur after it resolves.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadEnrollments(selectedClassId)
    }
  }, [loadEnrollments, selectedClassId])

  async function handleCreateClass(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (className.trim().length < 2) {
      setError('Enter a class name containing at least 2 characters.')
      return false
    }

    setCreating(true)
    const { data, error: createError } = await supabase
      .rpc('create_class', { class_name: className.trim() })

    if (createError) {
      setError(createError.message)
      setCreating(false)
      return false
    }

    setClassName('')
    setNotice(`Class created. Enrollment code: ${data.code}`)
    setCreating(false)
    await loadClasses()
    setSelectedClassId(data.id)
    return true
  }

  async function handleStatusChange(enrollment) {
    const nextStatus = enrollment.status === 'active' ? 'removed' : 'active'
    const studentName = enrollment.student.full_name || enrollment.student.email
    setUpdatingId(enrollment.id)
    setError('')
    setNotice('')

    const { error: updateError } = await supabase.rpc('set_enrollment_status', {
      target_enrollment_id: enrollment.id,
      new_status: nextStatus,
    })

    if (updateError) {
      setError(updateError.message)
      setUpdatingId('')
      return false
    } else {
      setNotice(
        nextStatus === 'active'
          ? `${studentName} was re-admitted.`
          : `${studentName} was removed.`,
      )
      await Promise.all([
        loadEnrollments(selectedClassId),
        loadClasses(),
      ])
    }

    setUpdatingId('')
    return true
  }

  async function handleArchiveClass(archiveState) {
    if (!selectedClass) return
    setError('')
    setNotice('')
    const { error: archiveError } = await supabase.rpc('set_class_archived', {
      target_class_id: selectedClass.id,
      archive_state: archiveState,
    })
    if (archiveError) {
      setError(archiveError.message)
      return
    }
    setNotice(archiveState ? `${selectedClass.name} was archived.` : `${selectedClass.name} was restored.`)
    await loadClasses()
  }

  async function handleResetAttempt(attempt) {
    setResettingId(attempt.id)
    setError('')
    setNotice('')
    const { error: resetError } = await supabase.rpc('reset_student_assessment_attempt', {
      target_attempt_id: attempt.id,
    })
    if (resetError) setError(resetError.message)
    else {
      setNotice('The latest assessment attempt was reset for a retake.')
      await loadClasses()
    }
    setResettingId('')
  }

  const selectedClass = classes.find((item) => item.id === selectedClassId)
  const filteredEnrollments = useMemo(
    () => filterEnrollmentsByStudentQuery(enrollments, studentSearch),
    [enrollments, studentSearch],
  )

  function navigateSection(section) {
    setError('')
    setNotice('')
    setActivePage(section)
    saveDashboardPage(localStorage, facultyDashboardPageKey, section)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <RoleDashboard
      title="Faculty dashboard"
      description="Create classes and manage student enrollment."
      hideUser
      hideHeader
      variant="role-dashboard-redesign admin-reference-shell faculty-reference-shell"
      sidebar={<FacultySidebar activePage={activePage} collapsed={sidebarCollapsed} onNavigate={navigateSection} onToggle={() => setSidebarCollapsed((value) => !value)} settings={<AdminSettings profileMenu roleName="Faculty" sidebar />} />}
    >
      {activePage === 'overview' && <FacultyOverviewPanel attempts={overviewData.attempts} classes={classes} enrollments={overviewData.enrollments} firearms={overviewData.firearms} loading={loading} onManageClass={(classId) => { setSelectedClassId(classId); setStudentSearch(''); navigateSection('class') }} onNavigate={navigateSection} releases={overviewData.releases} />}

      {activePage === 'classes' && <FacultyClassesPanel attempts={overviewData.attempts} className={className} classes={classes} creating={creating} enrollments={overviewData.enrollments} firearms={overviewData.firearms} loading={loading} onClassNameChange={setClassName} onCreateClass={handleCreateClass} onManageClass={(classId) => { setSelectedClassId(classId); setStudentSearch(''); navigateSection('class') }} releases={overviewData.releases} />}

      {activePage === 'class' && selectedClass && <FacultyClassWorkspace attempts={overviewData.attempts} classItem={selectedClass} enrollments={enrollments} firearms={overviewData.firearms} loading={loading} onArchive={handleArchiveClass} onAssessmentChange={loadClasses} onBack={() => navigateSection('classes')} onResetAttempt={handleResetAttempt} onStatusChange={handleStatusChange} releases={overviewData.releases} resettingId={resettingId} resultRows={overviewData.resultRows} updatingId={updatingId} />}

      {activePage === 'students' &&
      <article className="dashboard-card dashboard-card-wide">
        <div className="account-panel-heading">
          <div>
            <h2>{selectedClass ? `${selectedClass.name} students` : 'Students'}</h2>
            {selectedClass && <p>Enrollment code: <strong>{selectedClass.code}</strong></p>}
          </div>
          {selectedClass && enrollments.length > 0 && (
            <input
              aria-label="Search enrolled students"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Search student name or email"
            />
          )}
        </div>
        {selectedClass?.archived_at && (
          <div className="alert" role="status">
            This class is archived. Records remain available, but Students cannot access it.
          </div>
        )}
        {!selectedClass ? (
          <p>Create or select a class to view enrollment.</p>
        ) : enrollments.length === 0 ? (
          <p>No students are enrolled in {selectedClass.name} yet.</p>
        ) : filteredEnrollments.length === 0 ? (
          <p>No enrolled student named &quot;{studentSearch.trim()}&quot; was found.</p>
        ) : (
          <div className="student-list">
            {filteredEnrollments.map((enrollment) => (
              <div className="student-row" key={enrollment.id}>
                <div>
                  <strong>{enrollment.student.full_name || 'Name not provided'}</strong>
                  <span>{enrollment.student.email}</span>
                </div>
                <span className={`status-badge ${enrollment.status}`}>{enrollment.status}</span>
                <button
                  type="button"
                  onClick={() => handleStatusChange(enrollment)}
                  disabled={updatingId === enrollment.id || Boolean(selectedClass.archived_at)}
                >
                  {updatingId === enrollment.id
                    ? 'Saving...'
                    : enrollment.status === 'active'
                      ? 'Remove'
                      : 'Re-admit'}
                </button>
              </div>
            ))}
          </div>
        )}
      </article>}

      {activePage === 'assessments' && <AdminModelViewerPanel firearms={overviewData.firearms.filter((item) => item.status === 'ready')} />}
      {activePage === 'results' && <FacultyAnalyticsPanel attempts={overviewData.attempts} classes={classes} enrollments={overviewData.enrollments} loading={loading} releases={overviewData.releases} resultRows={overviewData.resultRows} />}

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
