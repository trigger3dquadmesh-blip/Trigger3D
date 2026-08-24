import { useCallback, useEffect, useMemo, useState } from 'react'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import { supabase } from '../../lib/supabase.js'
import { isDemoMode } from '../../lib/supabase.js'
import AdminSettings from '../admin/AdminSettings.jsx'
import AssessmentReleasePanel from './AssessmentReleasePanel.jsx'
import DemoFacultyDashboard from './DemoFacultyDashboard.jsx'
import FacultyResultsPanel from './FacultyResultsPanel.jsx'
import FacultySidebar from './FacultySidebar.jsx'
import { isClassDeleteConfirmed, sortClassesByName } from './class-utils.js'
import { filterEnrollmentsByStudentQuery } from './enrollment-search.js'
import { getSavedDashboardPage, saveDashboardPage } from '../../components/dashboard-location.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'

const facultyPages = ['overview', 'classes', 'students', 'assessments', 'results']
const facultyDashboardPageKey = 'trigger3d.faculty.active-page'

export default function FacultyDashboard() {
  if (isDemoMode) return <DemoFacultyDashboard />

  return <LiveFacultyDashboard />
}

function LiveFacultyDashboard() {
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [enrollments, setEnrollments] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [confirmationAction, setConfirmationAction] = useState('')
  const [classDeleteConfirmation, setClassDeleteConfirmation] = useState('')
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [classAction, setClassAction] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activePage, setActivePage] = useState(() => (
    getSavedDashboardPage(localStorage, facultyDashboardPageKey, facultyPages, 'overview')
  ))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useAutoDismissNotice(notice, () => setNotice(''))

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
      return
    }

    setCreating(true)
    const { data, error: createError } = await supabase
      .rpc('create_class', { class_name: className.trim() })

    if (createError) {
      setError(createError.message)
      setCreating(false)
      return
    }

    setClassName('')
    setNotice(`Class created. Enrollment code: ${data.code}`)
    setCreating(false)
    await loadClasses()
    setSelectedClassId(data.id)
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
    } else {
      setNotice(
        nextStatus === 'active'
          ? `${studentName} was re-admitted.`
          : `${studentName} was removed.`,
      )
      await loadEnrollments(selectedClassId)
    }

    setUpdatingId('')
  }

  async function saveArchiveState(archiveState) {
    if (!selectedClass) return

    setClassAction('archive')
    setError('')
    setNotice('')

    const { error: archiveError } = await supabase.rpc('set_class_archived', {
      target_class_id: selectedClass.id,
      archive_state: archiveState,
    })

    if (archiveError) {
      setError(archiveError.message)
    } else {
      setNotice(
        archiveState
          ? `${selectedClass.name} was archived. Its records and results were kept.`
          : `${selectedClass.name} was restored. Students can now be re-admitted.`,
      )
      await loadClasses()
      await loadEnrollments(selectedClass.id)
    }

    setClassAction('')
  }

  function handleArchiveToggle() {
    if (!selectedClass) return

    if (!selectedClass.archived_at) {
      setConfirmationAction('archive')
      return
    }

    void saveArchiveState(false)
  }

  async function deleteClass() {
    if (!selectedClass) return

    setClassAction('delete')
    setError('')
    setNotice('')

    const { data, error: deleteError } = await supabase.rpc('delete_class_permanently', {
      target_class_id: selectedClass.id,
    })

    if (deleteError) {
      setError(deleteError.message)
    } else {
      setNotice(
        `${data.class_name} was permanently deleted with `
        + `${data.deleted_enrollments} enrollment records and `
        + `${data.deleted_attempts} assessment attempts.`,
      )
      setEnrollments([])
      await loadClasses()
    }

    setClassAction('')
  }

  function handleDeleteClass() {
    if (!selectedClass) return
    setClassDeleteConfirmation('')
    setConfirmationAction('delete')
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
      sidebar={<FacultySidebar activePage={activePage} collapsed={sidebarCollapsed} onNavigate={navigateSection} onToggle={() => setSidebarCollapsed((value) => !value)} settings={<AdminSettings roleName="Faculty" sidebar />} />}
    >
      {activePage === 'overview' && <article className="dashboard-card dashboard-card-wide admin-welcome"><p className="eyebrow">Faculty workspace</p><h2>Your teaching space, organized.</h2><p>Create classes, guide student access, and review assessment activity from the sidebar.</p></article>}

      {activePage === 'classes' && <>
      <article className="dashboard-card dashboard-card-wide">
        <h2>Create a class</h2>
        <form className="inline-form" onSubmit={handleCreateClass}>
          <label htmlFor="class-name">Class name</label>
          <div className="inline-form-row">
            <input
              id="class-name"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="Example: CRIM 101 - Section A"
              maxLength="100"
              disabled={creating}
              required
            />
            <button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create class'}
            </button>
          </div>
        </form>
      </article>

      <article className="dashboard-card">
        <h2>Your classes</h2>
        {loading ? (
          <p>Loading classes...</p>
        ) : classes.length === 0 ? (
          <p>No classes created yet.</p>
        ) : (
          <div className="class-list">
            {classes.map((item) => (
              <button
                type="button"
                className={item.id === selectedClassId ? 'class-item active' : 'class-item'}
                key={item.id}
                onClick={() => {
                  setSelectedClassId(item.id)
                  setStudentSearch('')
                }}
              >
                <strong>{item.name}</strong>
                <span>{item.code}{item.archived_at ? ' · archived' : ''}</span>
              </button>
            ))}
          </div>
        )}

        {selectedClass && (
          <div className="class-lifecycle-actions">
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={Boolean(classAction)}
            >
              {classAction === 'archive'
                ? 'Saving...'
                : selectedClass.archived_at ? 'Restore class' : 'Archive class'}
            </button>
            <button
              className="danger-action"
              type="button"
              onClick={handleDeleteClass}
              disabled={Boolean(classAction)}
            >
              {classAction === 'delete' ? 'Deleting...' : 'Delete permanently'}
            </button>
          </div>
        )}
      </article>
      </>}

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

      {activePage === 'assessments' && <AssessmentReleasePanel selectedClass={selectedClass} />}
      {activePage === 'results' && <FacultyResultsPanel selectedClass={selectedClass} />}

      {confirmationAction === 'archive' && selectedClass && (
        <div className="confirmation-backdrop" role="presentation">
          <section aria-labelledby="archive-class-title" aria-modal="true" className="confirmation-dialog" role="dialog">
            <p className="eyebrow">Confirm action</p>
            <h2 id="archive-class-title">Archive this class?</h2>
            <p>Students will lose access and open assessments will close. Enrollments and results will be kept.</p>
            <div className="confirmation-actions">
              <button onClick={() => setConfirmationAction('')} type="button">Cancel</button>
              <button className="danger-action" onClick={() => { setConfirmationAction(''); void saveArchiveState(true) }} type="button">Archive class</button>
            </div>
          </section>
        </div>
      )}

      {confirmationAction === 'delete' && selectedClass && (
        <div className="confirmation-backdrop" role="presentation">
          <section aria-labelledby="delete-class-title" aria-modal="true" className="confirmation-dialog" role="dialog">
            <p className="eyebrow">Permanent deletion</p>
            <h2 id="delete-class-title">Delete {selectedClass.name}?</h2>
            <p>This removes every enrollment, assessment attempt, answer, and score. Type <strong>{selectedClass.code}</strong> to confirm.</p>
            <label htmlFor="delete-class-confirmation">Class code
              <input autoComplete="off" id="delete-class-confirmation" onChange={(event) => setClassDeleteConfirmation(event.target.value)} placeholder={selectedClass.code} value={classDeleteConfirmation} />
            </label>
            <div className="confirmation-actions">
              <button onClick={() => setConfirmationAction('')} type="button">Cancel</button>
              <button className="danger-action" disabled={!isClassDeleteConfirmed(selectedClass.code, classDeleteConfirmation) || classAction === 'delete'} onClick={() => { setConfirmationAction(''); void deleteClass() }} type="button">{classAction === 'delete' ? 'Deleting...' : 'Delete permanently'}</button>
            </div>
          </section>
        </div>
      )}

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
