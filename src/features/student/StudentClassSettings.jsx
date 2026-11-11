import { useEffect, useState } from 'react'
import useAuth from '../../auth/useAuth.js'
import { supabase } from '../../lib/supabase.js'
import DashboardLoading from '../../components/DashboardLoading.jsx'

export default function StudentClassSettings() {
  const { profile } = useAuth()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState(null)
  const [confirmation, setConfirmation] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!profile?.id) return undefined
    let active = true
    async function loadClasses() {
      let { data, error: loadError } = await supabase.from('enrollments').select('id, class:classes!enrollments_class_id_fkey(id, name, term, archived_at)').eq('student_id', profile.id).eq('status', 'active')
      if (loadError && /term/i.test(loadError.message || '')) {
        const legacyResult = await supabase.from('enrollments').select('id, class:classes!enrollments_class_id_fkey(id, name, archived_at)').eq('student_id', profile.id).eq('status', 'active')
        data = (legacyResult.data || []).map((item) => ({ ...item, class: item.class ? { ...item.class, term: 'Current term' } : item.class }))
        loadError = legacyResult.error
      }
      if (!active) return
      if (loadError) setError(loadError.message)
      else setClasses((data || []).filter((item) => item.class && !item.class.archived_at))
      setLoading(false)
    }
    loadClasses()
    return () => { active = false }
  }, [profile?.id])

  async function leaveClass() {
    if (!target || confirmation.trim() !== target.class.name) return
    setLeaving(true)
    setError('')
    const { error: leaveError } = await supabase.rpc('leave_class', { target_class_id: target.class.id })
    if (leaveError) setError(leaveError.message)
    else {
      setClasses((items) => items.filter((item) => item.id !== target.id))
      setNotice(`You left ${target.class.name}. Your submitted results were preserved.`)
      setTarget(null)
      setConfirmation('')
    }
    setLeaving(false)
  }

  return (
    <section className="account-settings-page student-class-settings">
      <div><h2>Class Membership</h2><p>Manage the active classes connected to your student account.</p></div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {loading ? <DashboardLoading label="Loading class settings…" /> : classes.length ? <div className="student-class-settings-list">{classes.map((item) => <article key={item.id}><div><strong>{item.class.name}</strong><small>{item.class.term || 'Current term'} · Active class</small></div><button onClick={() => { setTarget(item); setConfirmation('') }} type="button">Leave class</button></article>)}</div> : <p className="student-class-settings-empty">You are not enrolled in an active class.</p>}
      {target && <div className="confirmation-backdrop" role="presentation"><section aria-labelledby="leave-settings-title" aria-modal="true" className="confirmation-dialog student-leave-dialog" role="dialog"><p className="eyebrow">Class membership</p><h2 id="leave-settings-title">Leave {target.class.name}?</h2><p>You will lose access to its learning resources and open assessments. Submitted results will remain available.</p><label>Type <strong>{target.class.name}</strong> to confirm<input autoFocus disabled={leaving} onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /></label><div className="confirmation-actions"><button disabled={leaving} onClick={() => { setTarget(null); setConfirmation('') }} type="button">Cancel</button><button className="danger-action" disabled={leaving || confirmation.trim() !== target.class.name} onClick={leaveClass} type="button">{leaving ? 'Leaving…' : 'Leave Class'}</button></div></section></div>}
    </section>
  )
}
