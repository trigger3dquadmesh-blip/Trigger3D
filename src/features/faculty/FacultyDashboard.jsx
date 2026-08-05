import { useCallback, useEffect, useState } from 'react'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import { supabase } from '../../lib/supabase.js'
import AssessmentReleasePanel from './AssessmentReleasePanel.jsx'
import FacultyResultsPanel from './FacultyResultsPanel.jsx'
import { isClassDeleteConfirmed } from './class-utils.js'

export default function FacultyDashboard() {
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [enrollments, setEnrollments] = useState([])
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [classAction, setClassAction] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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

    setClasses(data)
    setSelectedClassId((current) => (
      data.some((item) => item.id === current) ? current : data[0]?.id || ''
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

  async function handleArchiveToggle() {
    if (!selectedClass) return
    const archiveState = !selectedClass.archived_at

    if (archiveState && !window.confirm(
      `Archive ${selectedClass.name}? Students will lose access and open assessments `
      + 'will close, but enrollments and results will be kept.',
    )) return

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

  async function handleDeleteClass() {
    if (!selectedClass) return

    const confirmation = window.prompt(
      `Permanently delete ${selectedClass.name}? This removes every enrollment, `
      + `assessment attempt, answer, and score. Type ${selectedClass.code} to confirm.`,
    )
    if (!isClassDeleteConfirmed(selectedClass.code, confirmation)) return

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

  const selectedClass = classes.find((item) => item.id === selectedClassId)

  return (
    <RoleDashboard
      title="Faculty dashboard"
      description="Create classes and manage student enrollment."
    >
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
                onClick={() => setSelectedClassId(item.id)}
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

      <article className="dashboard-card dashboard-card-wide">
        <h2>{selectedClass ? `${selectedClass.name} students` : 'Students'}</h2>
        {selectedClass && <p>Enrollment code: <strong>{selectedClass.code}</strong></p>}
        {selectedClass?.archived_at && (
          <div className="alert" role="status">
            This class is archived. Records remain available, but Students cannot access it.
          </div>
        )}
        {!selectedClass ? (
          <p>Create or select a class to view enrollment.</p>
        ) : enrollments.length === 0 ? (
          <p>No students enrolled yet.</p>
        ) : (
          <div className="student-list">
            {enrollments.map((enrollment) => (
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
      </article>

      <AssessmentReleasePanel selectedClass={selectedClass} />
      <FacultyResultsPanel selectedClass={selectedClass} />

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
