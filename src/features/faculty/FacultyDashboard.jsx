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
import { getSavedDashboardPage } from '../../components/dashboard-location.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'
import useResponsiveSidebar from '../../components/useResponsiveSidebar.js'
import useDashboardTransition from '../../components/useDashboardTransition.js'
import DashboardLoading from '../../components/DashboardLoading.jsx'
import { assessmentAttemptHasStarted } from '../student/assessment/assessment-lock.js'

const facultyPages = ['overview', 'classes', 'class', 'students', 'assessments', 'results']
const facultyDashboardPageKey = 'trigger3d.faculty.active-page'
const facultyLoadingLabels = { overview: 'Loading dashboard…', classes: 'Loading classes…', class: 'Loading class…', students: 'Loading students…', assessments: 'Loading assessments…', results: 'Loading results…' }
const facultyAttemptFields = 'id, class_id, student_id, firearm_id, status, percentage, started_at, submitted_at, timer_started_at, has_activity, integrity_locked_at, connection_interrupted_at, checkpoint_question_index, checkpoint_remaining_seconds, checkpoint_updated_at'

export default function FacultyDashboard() {
  return <LiveFacultyDashboard />
}

function LiveFacultyDashboard() {
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [enrollments, setEnrollments] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [className, setClassName] = useState('')
  const [classSection, setClassSection] = useState('')
  const [activeTerm, setActiveTerm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [resettingId, setResettingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [analyticsSyncing, setAnalyticsSyncing] = useState(false)
  const [activePage, setActivePage] = useState(() => (
    getSavedDashboardPage(localStorage, facultyDashboardPageKey, facultyPages, 'overview')
  ))
  const [sidebarCollapsed, setSidebarCollapsed] = useResponsiveSidebar()
  const { navigate: transitionTo, pendingPage } = useDashboardTransition(activePage, setActivePage, facultyDashboardPageKey)
  const [overviewData, setOverviewData] = useState({ attempts: [], enrollments: [], firearms: [], releases: [], resultRows: [] })

  useAutoDismissNotice(notice, () => setNotice(''))

  const loadClasses = useCallback(async ({ runMaintenance = true } = {}) => {
    if (runMaintenance) {
      await supabase.rpc('archive_expired_classes')
      await supabase.rpc('refresh_expired_academic_terms')
      await supabase.rpc('mark_stale_assessment_connections')
    }
    const activeTermResult = await supabase.from('academic_terms').select('id, academic_year, semester, start_date, end_date, status').eq('status', 'active').maybeSingle()
    setActiveTerm(activeTermResult.error ? null : activeTermResult.data)
    let { data, error: classesError } = await supabase
      .from('classes')
      .select('id, name, subject_name, section, code, term, end_date, academic_term_id, created_at, archived_at')
      .order('created_at', { ascending: false })

    if (classesError && /term|subject_name|section|academic_term_id/i.test(classesError.message || '')) {
      const legacyResult = await supabase
        .from('classes')
        .select('id, name, code, created_at, archived_at')
        .order('created_at', { ascending: false })
      data = (legacyResult.data || []).map((item) => ({ ...item, term: 'Current term', end_date: null }))
      classesError = legacyResult.error
    }

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
        ? supabase.from('assessment_attempts').select(facultyAttemptFields).in('class_id', classIds)
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

  const facultyClassIdsKey = useMemo(
    () => classes.map((item) => item.id).sort().join(','),
    [classes],
  )

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
    const classIds = facultyClassIdsKey ? facultyClassIdsKey.split(',') : []
    if (!classIds.length) return undefined
    let active = true
    let fullRefreshTimer = 0

    function scheduleFullRefresh() {
      window.clearTimeout(fullRefreshTimer)
      fullRefreshTimer = window.setTimeout(async () => {
        if (!active) return
        setAnalyticsSyncing(true)
        await loadClasses({ runMaintenance: false })
        if (active) setAnalyticsSyncing(false)
      }, 400)
    }

    async function refreshAssessmentConnections({ markStale = false } = {}) {
      if (markStale) await supabase.rpc('mark_stale_assessment_connections')
      const { data, error: attemptError } = await supabase
        .from('assessment_attempts')
        .select(facultyAttemptFields)
        .in('class_id', classIds)
      if (!active || attemptError) return
      setOverviewData((current) => ({ ...current, attempts: data ?? [] }))
    }

    const connectionPoll = window.setInterval(() => {
      void refreshAssessmentConnections({ markStale: true })
      scheduleFullRefresh()
    }, 10000)
    const attemptPoll = window.setInterval(() => {
      void refreshAssessmentConnections()
    }, 2000)
    const attemptChannel = supabase
      .channel('faculty-assessment-attempts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessment_attempts' }, (payload) => {
        const changedAttempt = payload.new
        const changedAttemptId = changedAttempt?.id || payload.old?.id
        if (!changedAttemptId) return

        setOverviewData((current) => {
          const existingAttempt = current.attempts.find((item) => item.id === changedAttemptId)
          const belongsToFacultyClass = classIds.includes(changedAttempt?.class_id || existingAttempt?.class_id)
          if (payload.eventType === 'DELETE' || !belongsToFacultyClass) {
            return {
              ...current,
              attempts: current.attempts.filter((item) => item.id !== changedAttemptId),
            }
          }

          const nextAttempt = existingAttempt
            ? { ...existingAttempt, ...changedAttempt }
            : changedAttempt
          return {
            ...current,
            attempts: existingAttempt
              ? current.attempts.map((item) => item.id === changedAttemptId ? nextAttempt : item)
              : [...current.attempts, nextAttempt],
          }
        })
        scheduleFullRefresh()
      })
      .subscribe()

    const facultyDataChannel = supabase
      .channel('faculty-analytics-source-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, scheduleFullRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, scheduleFullRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessment_releases' }, scheduleFullRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessment_responses' }, scheduleFullRefresh)
      .subscribe()

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        void refreshAssessmentConnections({ markStale: true })
        scheduleFullRefresh()
      }
    }

    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    void refreshAssessmentConnections({ markStale: true })
    return () => {
      active = false
      window.clearTimeout(fullRefreshTimer)
      window.clearInterval(connectionPoll)
      window.clearInterval(attemptPoll)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      void supabase.removeChannel(attemptChannel)
      void supabase.removeChannel(facultyDataChannel)
    }
  }, [facultyClassIdsKey, loadClasses])

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
      setError('Enter a subject or course name containing at least 2 characters.')
      return false
    }
    if (!classSection.trim()) {
      setError('Enter the class section.')
      return false
    }
    if (!activeTerm) {
      setError('No active academic term is available. Ask the administrator to create and activate the semester first.')
      return false
    }

    setCreating(true)
    const { data, error: createError } = await supabase.rpc('faculty_create_class_offering', {
      offering_subject_name: className.trim(),
      offering_section: classSection.trim(),
    })

    if (createError) {
      const databaseSetupMissing = /faculty_create_class_offering|academic_terms|schema cache/i.test(createError.message || '')
      setError(databaseSetupMissing
        ? 'Academic Terms needs its Supabase update. Apply supabase/add-academic-terms.sql in the SQL Editor, then try again.'
        : createError.message)
      setCreating(false)
      return false
    }

    setClassName('')
    setClassSection('')
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

  async function handleArchiveClass() {
    if (!selectedClass || selectedClass.archived_at) return
    setError('')
    setNotice('')
    const { error: archiveError } = await supabase.rpc('set_class_archived', {
      target_class_id: selectedClass.id,
      archive_state: true,
    })
    if (archiveError) {
      setError(archiveError.message)
      return
    }
    setNotice(`${selectedClass.name} was archived as a permanent read-only record.`)
    await loadClasses()
  }

  async function handleUpdateClassDetails(classId, name, term) {
    const targetClass = classes.find((item) => item.id === classId)
    if (targetClass?.archived_at) {
      setError('Previous classes are read-only. Create a new class offering for the new semester.')
      return false
    }
    setError('')
    setNotice('')
    const { error: updateError } = await supabase.rpc('update_class_details', {
      target_class_id: classId,
      class_name: name.trim(),
      class_term: term.trim(),
    })
    if (updateError) {
      setError(updateError.message)
      return false
    }
    setNotice('Class details updated.')
    await loadClasses()
    return true
  }

  async function handleResetAttempt(attempt) {
    setResettingId(attempt.id)
    setError('')
    setNotice('')

    const { data: currentAttempt, error: attemptError } = await supabase
      .from('assessment_attempts')
      .select('id, status, timer_started_at, has_activity, integrity_locked_at, connection_interrupted_at')
      .eq('id', attempt.id)
      .maybeSingle()
    const canReset = currentAttempt?.status === 'submitted'
      || (assessmentAttemptHasStarted(currentAttempt)
        && Boolean(currentAttempt.integrity_locked_at)
        && !currentAttempt.connection_interrupted_at)

    if (attemptError || !canReset) {
      setError(attemptError?.message || (currentAttempt?.connection_interrupted_at
        ? 'A connection-interrupted assessment must be continued from its saved checkpoint, not reset.'
        : 'This assessment cannot be reset because the student has not started it yet.'))
      setResettingId('')
      await loadClasses()
      return false
    }

    const { error: resetError } = await supabase.rpc('reset_student_assessment_attempt_with_timer', {
      target_attempt_id: attempt.id,
    })
    if (resetError) {
      setError(resetError.message)
      setResettingId('')
      return false
    } else {
      const assessmentName = overviewData.firearms.find((item) => item.id === attempt.firearm_id)?.name || 'Selected assessment'
      setNotice(`${assessmentName} was reset for this student. No other assessment was changed.`)
      await loadClasses()
    }
    setResettingId('')
    return true
  }

  async function handleResumeInterruptedAttempt(attempt) {
    setResettingId(attempt.id)
    setError('')
    setNotice('')
    const { error: resumeError } = await supabase.rpc('resume_interrupted_assessment', {
      target_attempt_id: attempt.id,
    })
    if (resumeError) {
      setError(resumeError.message)
      setResettingId('')
      return false
    }
    const assessmentName = overviewData.firearms.find((item) => item.id === attempt.firearm_id)?.name || 'Selected assessment'
    setNotice(`${assessmentName} continuation was approved. The student can resume from the saved checkpoint.`)
    await loadClasses()
    setResettingId('')
    return true
  }

  const selectedClass = classes.find((item) => item.id === selectedClassId)
  const filteredEnrollments = useMemo(
    () => filterEnrollmentsByStudentQuery(enrollments, studentSearch),
    [enrollments, studentSearch],
  )

  function navigateSection(section) {
    setError('')
    setNotice('')
    transitionTo(section)
  }

  return (
    <RoleDashboard
      title="Faculty dashboard"
      description="Create classes and manage student enrollment."
      hideUser
      hideHeader
      variant="role-dashboard-redesign admin-reference-shell faculty-reference-shell"
      sidebar={<FacultySidebar activePage={pendingPage || activePage} collapsed={sidebarCollapsed} onNavigate={navigateSection} onToggle={() => setSidebarCollapsed((value) => !value)} settings={<AdminSettings profileMenu roleName="Faculty" sidebar />} />}
    >
      {pendingPage ? <section className="faculty-reference-page"><DashboardLoading label={facultyLoadingLabels[pendingPage]} /></section> : <>
      {activePage === 'overview' && <FacultyOverviewPanel attempts={overviewData.attempts} classes={classes} enrollments={overviewData.enrollments} firearms={overviewData.firearms} loading={loading} onManageClass={(classId) => { setSelectedClassId(classId); setStudentSearch(''); navigateSection('class') }} onNavigate={navigateSection} releases={overviewData.releases} />}

      {activePage === 'classes' && <FacultyClassesPanel activeTerm={activeTerm} attempts={overviewData.attempts} className={className} classSection={classSection} classes={classes} creating={creating} enrollments={overviewData.enrollments} firearms={overviewData.firearms} loading={loading} onClassNameChange={setClassName} onClassSectionChange={setClassSection} onCreateClass={handleCreateClass} onManageClass={(classId) => { setSelectedClassId(classId); setStudentSearch(''); navigateSection('class') }} releases={overviewData.releases} />}

      {activePage === 'class' && selectedClass && <FacultyClassWorkspace attempts={overviewData.attempts} classItem={selectedClass} enrollments={enrollments} firearms={overviewData.firearms} loading={loading} onArchive={handleArchiveClass} onAssessmentChange={loadClasses} onBack={() => navigateSection('classes')} onResetAttempt={handleResetAttempt} onResumeInterruptedAttempt={handleResumeInterruptedAttempt} onStatusChange={handleStatusChange} onUpdateDetails={handleUpdateClassDetails} releases={overviewData.releases} resettingId={resettingId} resultRows={overviewData.resultRows} updatingId={updatingId} />}

      {activePage === 'students' && loading && <section className="faculty-reference-page"><DashboardLoading label="Loading students…" /></section>}

      {activePage === 'students' && !loading &&
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

      {activePage === 'assessments' && <AdminModelViewerPanel dataLoading={loading} firearms={overviewData.firearms.filter((item) => item.status === 'ready')} />}
      {activePage === 'results' && <FacultyAnalyticsPanel attempts={overviewData.attempts} classes={classes} enrollments={overviewData.enrollments} loading={loading} refreshing={analyticsSyncing} releases={overviewData.releases} resultRows={overviewData.resultRows} />}

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
