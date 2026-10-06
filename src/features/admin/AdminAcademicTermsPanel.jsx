import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardLoading from '../../components/DashboardLoading.jsx'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'
import { supabase } from '../../lib/supabase.js'
import AdminDesignModal, { AdminButton } from './AdminDesignModal.jsx'
import AdminIcon from './AdminIcon.jsx'

function termLabel(term) {
  return `${term.semester}, AY ${term.academic_year}`
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) : 'Not set'
}

export default function AdminAcademicTermsPanel() {
  const [terms, setTerms] = useState([])
  const [offerings, setOfferings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedTermId, setSelectedTermId] = useState('')
  const [termTab, setTermTab] = useState('current')
  const [termQuery, setTermQuery] = useState('')
  const [termForm, setTermForm] = useState({ academicYear: '', semester: '1st Semester', startDate: '', endDate: '', makeActive: true })
  const [editForm, setEditForm] = useState(null)
  const [createConfirmationOpen, setCreateConfirmationOpen] = useState(false)
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)
  useAutoDismissNotice(notice, () => setNotice(''), 5000)
  useAutoDismissNotice(error, () => setError(''), 6500)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    await supabase.rpc('refresh_expired_academic_terms')
    const [termResult, classResult] = await Promise.all([
      supabase.from('academic_terms').select('id, academic_year, semester, start_date, end_date, status, created_at').order('start_date', { ascending: false }),
      supabase.from('classes').select('id, name, subject_name, section, code, academic_term_id, archived_at, faculty:profiles!classes_faculty_id_fkey(id, full_name, email)').order('created_at', { ascending: false }),
    ])
    const requestError = termResult.error || classResult.error
    if (requestError) {
      const setupMissing = /academic_terms|academic_term_id|subject_name|section|schema cache/i.test(requestError.message || '')
      setError(setupMissing ? 'Academic Terms needs its Supabase update. Run supabase/add-academic-terms.sql in the SQL Editor, then refresh this page.' : requestError.message)
    } else {
      setTerms(termResult.data ?? [])
      setOfferings(classResult.data ?? [])
      setSelectedTermId((current) => current && termResult.data?.some((term) => term.id === current) ? current : '')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // The loader begins with awaited Supabase requests; state changes occur after they resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const selectedTerm = terms.find((term) => term.id === selectedTermId)
  const selectedOfferings = useMemo(() => offerings.filter((item) => item.academic_term_id === selectedTermId), [offerings, selectedTermId])
  const currentTermCount = terms.filter((term) => term.status !== 'closed').length
  const historicalTermCount = terms.filter((term) => term.status === 'closed').length
  const visibleTerms = useMemo(() => {
    const normalizedQuery = termQuery.trim().toLowerCase()
    return terms.filter((term) => {
      const matchesTab = termTab === 'history' ? term.status === 'closed' : term.status !== 'closed'
      const matchesQuery = !normalizedQuery || `${term.academic_year} ${term.semester} ${term.status}`.toLowerCase().includes(normalizedQuery)
      return matchesTab && matchesQuery
    })
  }, [termQuery, termTab, terms])

  async function createTerm() {
    setSaving(true); setError(''); setNotice('')
    const { error: requestError } = await supabase.rpc('admin_create_academic_term', {
      term_academic_year: termForm.academicYear,
      term_semester: termForm.semester,
      term_start_date: termForm.startDate,
      term_end_date: termForm.endDate,
      make_active: termForm.makeActive,
    })
    if (requestError) setError(requestError.message)
    else {
      setNotice('Academic term created. Faculty can now create classes under this term.')
      setTermForm({ academicYear: '', semester: '1st Semester', startDate: '', endDate: '', makeActive: false })
      await loadData()
    }
    setCreateConfirmationOpen(false)
    setSaving(false)
  }

  async function setTermStatus(status) {
    if (!selectedTerm) return
    setSaving(true); setError(''); setNotice('')
    const { error: requestError } = await supabase.rpc('admin_set_academic_term_status', { target_term_id: selectedTerm.id, new_status: status })
    if (requestError) setError(requestError.message)
    else {
      setNotice(status === 'closed' ? 'Term closed. Its class offerings are now historical and read-only.' : 'This is now the active academic term.')
      if (status === 'closed') setCloseConfirmationOpen(false)
      await loadData()
    }
    setSaving(false)
  }

  function beginEditTerm() {
    if (!selectedTerm) return
    setEditForm({
      academicYear: selectedTerm.academic_year,
      semester: selectedTerm.semester,
      startDate: selectedTerm.start_date,
      endDate: selectedTerm.end_date,
      confirmLinkedClasses: false,
    })
    setError('')
    setNotice('')
  }

  async function updateTerm(event) {
    event.preventDefault()
    if (!selectedTerm || !editForm) return
    const identityChanged = editForm.academicYear.trim() !== selectedTerm.academic_year || editForm.semester !== selectedTerm.semester
    if (identityChanged && selectedOfferings.length > 0 && !editForm.confirmLinkedClasses) {
      setError('Confirm that the academic year or semester correction should also apply to every class connected to this term.')
      return
    }
    setSaving(true); setError(''); setNotice('')
    const { error: requestError } = await supabase.rpc('admin_update_academic_term', {
      target_term_id: selectedTerm.id,
      term_academic_year: editForm.academicYear,
      term_semester: editForm.semester,
      term_start_date: editForm.startDate,
      term_end_date: editForm.endDate,
    })
    if (requestError) {
      const setupMissing = /admin_update_academic_term|schema cache|function/i.test(requestError.message || '')
      setError(setupMissing ? 'Edit Term needs its Supabase update. Run supabase/add-edit-academic-terms.sql in the SQL Editor, then try again.' : requestError.message)
    } else {
      setNotice('Academic term updated. Connected classes now use the corrected term information.')
      setEditForm(null)
      await loadData()
    }
    setSaving(false)
  }

  if (loading) return <section className="admin-reference-page"><DashboardLoading label="Loading academic terms…" /></section>

  return <section className="admin-terms-page admin-reference-page">
    <nav><span>Admin</span><span>›</span><span>Academic Terms</span></nav>
    <div className="admin-terms-heading"><div><h1>Academic Terms & Class Offerings</h1><p>Create each semester once, then let faculty create their subjects and sections with a fresh student batch.</p></div></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="admin-terms-layout">
      <aside className="admin-terms-list">
        <header><div><h2>Terms</h2><small>Select a term to view or manage it</small></div></header>
        <div className="admin-term-tabs" role="tablist">
          <button aria-selected={termTab === 'current'} className={termTab === 'current' ? 'active' : ''} onClick={() => { setTermTab('current'); setSelectedTermId(''); setEditForm(null) }} role="tab" type="button">Current &amp; Upcoming <span>{currentTermCount}</span></button>
          <button aria-selected={termTab === 'history'} className={termTab === 'history' ? 'active' : ''} onClick={() => { setTermTab('history'); setSelectedTermId(''); setEditForm(null) }} role="tab" type="button">History <span>{historicalTermCount}</span></button>
        </div>
        <label className="admin-term-search"><AdminIcon name="search" /><span className="sr-only">Search academic terms</span><input onChange={(event) => { setTermQuery(event.target.value); setSelectedTermId(''); setEditForm(null) }} placeholder="Search year or semester…" type="search" value={termQuery} /></label>
        <div className="admin-term-card-list">
          {visibleTerms.map((term) => {
            const isSelected = selectedTermId === term.id
            return <button aria-expanded={isSelected} className={isSelected ? 'active' : ''} key={term.id} onClick={() => { setSelectedTermId(isSelected ? '' : term.id); setEditForm(null) }} type="button"><strong>{termLabel(term)}</strong><small>{formatDate(term.start_date)} – {formatDate(term.end_date)}</small><span className={`admin-term-status ${term.status}`}>{term.status}</span></button>
          })}
          {terms.length === 0 && <p>No academic terms yet.</p>}
          {terms.length > 0 && visibleTerms.length === 0 && <div className="admin-term-empty"><strong>No matching terms</strong><span>{termQuery ? `No term matches “${termQuery}”.` : termTab === 'history' ? 'No historical terms yet.' : 'No current or upcoming terms.'}</span>{termQuery && <button onClick={() => setTermQuery('')} type="button">Clear search</button>}</div>}
        </div>
      </aside>
      <div className="admin-terms-content">
        <section className="admin-term-card"><header><div><h2>Create academic term</h2><p>The administrator controls which semester is current.</p></div></header><form className="admin-term-form" onSubmit={(event) => { event.preventDefault(); setCreateConfirmationOpen(true) }}><label>Academic Year<input disabled={saving} onChange={(event) => setTermForm((current) => ({ ...current, academicYear: event.target.value }))} pattern="\d{4}-\d{4}" placeholder="2026-2027" required value={termForm.academicYear} /></label><label>Semester<select disabled={saving} onChange={(event) => setTermForm((current) => ({ ...current, semester: event.target.value }))} value={termForm.semester}><option>1st Semester</option><option>2nd Semester</option></select></label><label>Start Date<input disabled={saving} onChange={(event) => setTermForm((current) => ({ ...current, startDate: event.target.value }))} required type="date" value={termForm.startDate} /></label><label>End Date<input disabled={saving} onChange={(event) => setTermForm((current) => ({ ...current, endDate: event.target.value }))} required type="date" value={termForm.endDate} /></label><label className="admin-term-checkbox"><input checked={termForm.makeActive} disabled={saving} onChange={(event) => setTermForm((current) => ({ ...current, makeActive: event.target.checked }))} type="checkbox" />Make this the active term</label><button disabled={saving} type="submit">{saving ? 'Saving…' : 'Create Term'}</button></form></section>
        {selectedTerm && <section className="admin-term-card"><header className="admin-selected-term"><div><h2>{termLabel(selectedTerm)}</h2><p>{selectedTerm.status === 'closed' ? 'Historical term · class records remain read-only' : `${formatDate(selectedTerm.start_date)} – ${formatDate(selectedTerm.end_date)}`}</p></div><div><button disabled={saving} onClick={beginEditTerm} type="button">Edit Term</button>{selectedTerm.status !== 'active' && selectedTerm.status !== 'closed' && <button disabled={saving} onClick={() => void setTermStatus('active')} type="button">Set Active</button>}{selectedTerm.status === 'active' && <button className="danger" disabled={saving} onClick={() => setCloseConfirmationOpen(true)} type="button">Close Term</button>}</div></header>
          {editForm && <form className="admin-term-form admin-term-edit-form" onSubmit={updateTerm}>
            <label>Academic Year<input disabled={saving} onChange={(event) => setEditForm((current) => ({ ...current, academicYear: event.target.value, confirmLinkedClasses: false }))} pattern="\d{4}-\d{4}" required value={editForm.academicYear} /></label>
            <label>Semester<select disabled={saving} onChange={(event) => setEditForm((current) => ({ ...current, semester: event.target.value, confirmLinkedClasses: false }))} value={editForm.semester}><option>1st Semester</option><option>2nd Semester</option></select></label>
            <label>Start Date<input disabled={saving} onChange={(event) => setEditForm((current) => ({ ...current, startDate: event.target.value }))} required type="date" value={editForm.startDate} /></label>
            <label>End Date<input disabled={saving} onChange={(event) => setEditForm((current) => ({ ...current, endDate: event.target.value }))} required type="date" value={editForm.endDate} /></label>
            {selectedOfferings.length > 0 && (editForm.academicYear.trim() !== selectedTerm.academic_year || editForm.semester !== selectedTerm.semester) && <label className="admin-term-checkbox admin-term-edit-confirm"><input checked={editForm.confirmLinkedClasses} disabled={saving} onChange={(event) => setEditForm((current) => ({ ...current, confirmLinkedClasses: event.target.checked }))} type="checkbox" />Apply this correction to all {selectedOfferings.length} connected class{selectedOfferings.length === 1 ? '' : 'es'}.</label>}
            <p className="admin-term-edit-note">Corrections are recorded in the audit log. Editing a closed term does not reopen its classes.</p>
            <div className="admin-term-edit-actions"><button className="secondary" disabled={saving} onClick={() => setEditForm(null)} type="button">Cancel</button><button disabled={saving} type="submit">{saving ? 'Saving…' : 'Save Changes'}</button></div>
          </form>}
          {selectedTerm.status === 'active' && <p className="admin-term-faculty-note">Faculty members can now create their own subjects and sections under this active term. Every new class starts with a blank roster, attempts, and scores.</p>}<div className="admin-offerings-list"><h3>Faculty-created classes <span>{selectedOfferings.length}</span></h3>{selectedOfferings.map((item) => <article key={item.id}><div><strong>{item.subject_name || item.name}</strong><span>{item.section || 'Legacy class'}</span></div><div><strong>{item.faculty?.full_name || item.faculty?.email || 'Unassigned'}</strong><span>{item.code}</span></div></article>)}{selectedOfferings.length === 0 && <p>No faculty has created a class in this term yet.</p>}</div></section>}
      </div>
    </div>
    <AdminDesignModal
      description="Review the academic term details before adding it to the system."
      footer={<><AdminButton disabled={saving} kind="ghost" onClick={() => setCreateConfirmationOpen(false)}>Cancel</AdminButton><AdminButton disabled={saving} onClick={() => void createTerm()}>{saving ? 'Creating…' : 'Confirm & Create'}</AdminButton></>}
      onClose={() => { if (!saving) setCreateConfirmationOpen(false) }}
      open={createConfirmationOpen}
      title={`Create ${termForm.semester}, AY ${termForm.academicYear}?`}
    >
      <div className="grid gap-4">
        <div className="admin-confirmation-note success">
          <strong>{termForm.makeActive ? 'This will become the active term' : 'This will be added as an upcoming term'}</strong>
          <span>{termForm.makeActive ? 'Faculty members will be able to create new classes under this term after confirmation.' : 'The term will be available for review but will not replace the currently active term.'}</span>
        </div>
        <dl className="grid gap-2 text-xs leading-5 text-[var(--admin-muted)]">
          <div className="flex justify-between gap-4"><dt>Academic term</dt><dd className="text-right font-semibold text-[var(--admin-text)]">{termForm.semester}, AY {termForm.academicYear}</dd></div>
          <div className="flex justify-between gap-4"><dt>Start date</dt><dd className="text-right font-semibold text-[var(--admin-text)]">{formatDate(termForm.startDate)}</dd></div>
          <div className="flex justify-between gap-4"><dt>End date</dt><dd className="text-right font-semibold text-[var(--admin-text)]">{formatDate(termForm.endDate)}</dd></div>
        </dl>
      </div>
    </AdminDesignModal>
    <AdminDesignModal
      description="Review the effect of closing this academic term before continuing."
      footer={<><AdminButton disabled={saving} kind="ghost" onClick={() => setCloseConfirmationOpen(false)}>Cancel</AdminButton><AdminButton disabled={saving} kind="danger" onClick={() => void setTermStatus('closed')}>{saving ? 'Closing…' : 'Close Term'}</AdminButton></>}
      onClose={() => { if (!saving) setCloseConfirmationOpen(false) }}
      open={closeConfirmationOpen && Boolean(selectedTerm)}
      title={selectedTerm ? `Close ${termLabel(selectedTerm)}?` : 'Close academic term?'}
    >
      <div className="grid gap-4">
        <div className="admin-confirmation-note danger">
          <strong>This term will become historical</strong>
          <span>Faculty and students can still view its records, but its connected classes, assessments, attempts, and scores will become read-only.</span>
        </div>
        <div className="grid gap-2 text-xs leading-5 text-[var(--admin-muted)]">
          <p><strong className="text-[var(--admin-text)]">{selectedOfferings.length}</strong> connected class{selectedOfferings.length === 1 ? '' : 'es'} will be archived under this term.</p>
          <p>New enrollment and assessment activity will stop. Closing the term will also be recorded in the audit log.</p>
        </div>
      </div>
    </AdminDesignModal>
  </section>
}
