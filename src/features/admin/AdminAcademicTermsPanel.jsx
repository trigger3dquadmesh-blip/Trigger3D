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

function todayValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function isExpiredPlannedTerm(term) {
  return term.status === 'planned' && term.end_date < todayValue()
}

function displayStatus(term) {
  if (isExpiredPlannedTerm(term)) return 'Expired'
  return term.status === 'planned' ? 'Upcoming' : term.status === 'active' ? 'Active' : 'Closed'
}

function validateTermDetails({ academicYear, startDate, endDate }) {
  const match = academicYear.trim().match(/^(\d{4})-(\d{4})$/)
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return 'Academic year must contain consecutive years, such as 2027-2028.'
  if (!startDate || !endDate || endDate < startDate) return 'Enter a valid term date range.'
  const allowedYears = new Set([match[1], match[2]])
  if (!allowedYears.has(startDate.slice(0, 4)) || !allowedYears.has(endDate.slice(0, 4))) {
    return `The term dates must fall within academic year ${academicYear.trim()}.`
  }
  return ''
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
  const [createFormOpen, setCreateFormOpen] = useState(false)
  const [createConfirmationOpen, setCreateConfirmationOpen] = useState(false)
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)
  const [activationConfirmationOpen, setActivationConfirmationOpen] = useState(false)
  useAutoDismissNotice(notice, () => setNotice(''), 5000)
  useAutoDismissNotice(error, () => setError(''), 6500)

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
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
      const loadedTerms = termResult.data ?? []
      setTerms(loadedTerms)
      setOfferings(classResult.data ?? [])
      setSelectedTermId((current) => {
        if (current && loadedTerms.some((term) => term.id === current)) return current
        return loadedTerms.find((term) => term.status === 'active')?.id
          || loadedTerms.find((term) => term.status !== 'closed')?.id
          || loadedTerms[0]?.id
          || ''
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // The loader begins with awaited Supabase requests; state changes occur after they resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  useEffect(() => {
    const channel = supabase
      .channel('admin-academic-terms-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_terms' }, () => { void loadData({ silent: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => { void loadData({ silent: true }) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData])

  const selectedTerm = terms.find((term) => term.id === selectedTermId)
  const selectedOfferings = useMemo(() => offerings.filter((item) => item.academic_term_id === selectedTermId), [offerings, selectedTermId])
  const activeTerm = terms.find((term) => term.status === 'active')
  const activeTermOfferings = offerings.filter((item) => item.academic_term_id === activeTerm?.id)
  const currentTermCount = terms.filter((term) => term.status !== 'closed' && !isExpiredPlannedTerm(term)).length
  const historicalTermCount = terms.filter((term) => term.status === 'closed' || isExpiredPlannedTerm(term)).length
  const visibleTerms = useMemo(() => {
    const normalizedQuery = termQuery.trim().toLowerCase()
    return terms.filter((term) => {
      const isHistorical = term.status === 'closed' || isExpiredPlannedTerm(term)
      const matchesTab = termTab === 'history' ? isHistorical : !isHistorical
      const matchesQuery = !normalizedQuery || `${term.academic_year} ${term.semester} ${term.status} ${displayStatus(term)}`.toLowerCase().includes(normalizedQuery)
      return matchesTab && matchesQuery
    })
  }, [termQuery, termTab, terms])

  useEffect(() => {
    const nextSelection = visibleTerms[0]?.id || ''
    if (visibleTerms.some((term) => term.id === selectedTermId)) return
    // Keep the detail panel aligned with the currently visible tab and search results.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTermId(nextSelection)
    setEditForm(null)
  }, [selectedTermId, visibleTerms])

  async function createTerm() {
    setSaving(true); setError(''); setNotice('')
    const { error: requestError } = await supabase.rpc('admin_create_academic_term', {
      term_academic_year: termForm.academicYear,
      term_semester: termForm.semester,
      term_start_date: termForm.startDate,
      term_end_date: termForm.endDate,
      make_active: termForm.makeActive,
    })
    if (requestError) {
      setError(requestError.message)
      setCreateFormOpen(true)
    }
    else {
      setNotice('Academic term created. Faculty can now create classes under this term.')
      setTermForm({ academicYear: '', semester: '1st Semester', startDate: '', endDate: '', makeActive: false })
      setCreateFormOpen(false)
      await loadData()
    }
    setCreateConfirmationOpen(false)
    setSaving(false)
  }

  function reviewCreateTerm(event) {
    event.preventDefault()
    const validationError = validateTermDetails(termForm)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setCreateFormOpen(false)
    setCreateConfirmationOpen(true)
  }

  async function setTermStatus(status) {
    if (!selectedTerm) return false
    setSaving(true); setError(''); setNotice('')
    const { error: requestError } = await supabase.rpc('admin_set_academic_term_status', { target_term_id: selectedTerm.id, new_status: status })
    if (requestError) setError(requestError.message)
    else {
      setNotice(status === 'closed' ? 'Term closed. Its class offerings are now historical and read-only.' : 'This is now the active academic term.')
      if (status === 'closed') setCloseConfirmationOpen(false)
      await loadData()
    }
    setSaving(false)
    return !requestError
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
    const validationError = validateTermDetails(editForm)
    if (validationError) {
      setError(validationError)
      return
    }
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
    <div className="admin-terms-heading"><div><h1>Academic Terms & Class Offerings</h1><p>Create each semester once, then let faculty create their subjects and sections with a fresh student batch.</p></div><button className="admin-create-term-button" onClick={() => { setError(''); setCreateFormOpen(true) }} type="button"><span aria-hidden="true">＋</span>Create Term</button></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="admin-terms-layout">
      <aside className="admin-terms-list">
        <header><div><h2>Terms</h2><small>Select a term to view or manage it</small></div></header>
        <div className="admin-term-tabs" role="tablist">
          <button aria-selected={termTab === 'current'} className={termTab === 'current' ? 'active' : ''} onClick={() => { setTermTab('current'); setEditForm(null) }} role="tab" type="button">Current &amp; Upcoming <span>{currentTermCount}</span></button>
          <button aria-selected={termTab === 'history'} className={termTab === 'history' ? 'active' : ''} onClick={() => { setTermTab('history'); setEditForm(null) }} role="tab" type="button">History <span>{historicalTermCount}</span></button>
        </div>
        <label className="admin-term-search"><AdminIcon name="search" /><span className="sr-only">Search academic terms</span><input onChange={(event) => { setTermQuery(event.target.value); setEditForm(null) }} placeholder="Search year or semester…" type="search" value={termQuery} /></label>
        <div className="admin-term-card-list">
          {visibleTerms.map((term) => {
            const isSelected = selectedTermId === term.id
            return <button aria-expanded={isSelected} className={isSelected ? 'active' : ''} key={term.id} onClick={() => { setSelectedTermId(term.id); setEditForm(null) }} type="button"><strong>{termLabel(term)}</strong><small>{formatDate(term.start_date)} – {formatDate(term.end_date)}</small><span className={`admin-term-status ${isExpiredPlannedTerm(term) ? 'closed' : term.status}`}>{displayStatus(term)}</span></button>
          })}
          {terms.length === 0 && <p>No academic terms yet.</p>}
          {terms.length > 0 && visibleTerms.length === 0 && <div className="admin-term-empty"><strong>No matching terms</strong><span>{termQuery ? `No term matches “${termQuery}”.` : termTab === 'history' ? 'No historical terms yet.' : 'No current or upcoming terms.'}</span>{termQuery && <button onClick={() => setTermQuery('')} type="button">Clear search</button>}</div>}
        </div>
      </aside>
      <div className="admin-terms-content">
        {selectedTerm && <section className="admin-term-card"><header className="admin-selected-term"><div><h2>{termLabel(selectedTerm)}</h2><p>{selectedTerm.status === 'closed' ? 'Historical term · class records remain read-only' : isExpiredPlannedTerm(selectedTerm) ? 'Expired upcoming term · edit its dates before activation' : `${formatDate(selectedTerm.start_date)} – ${formatDate(selectedTerm.end_date)}`}</p></div><div><button disabled={saving} onClick={beginEditTerm} type="button">Edit Term</button>{selectedTerm.status === 'planned' && !isExpiredPlannedTerm(selectedTerm) && <button disabled={saving} onClick={() => setActivationConfirmationOpen(true)} type="button">Set Active</button>}{selectedTerm.status === 'active' && <button className="danger" disabled={saving} onClick={() => setCloseConfirmationOpen(true)} type="button">Close Term</button>}</div></header>
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
        {!selectedTerm && <section className="admin-term-selection-empty"><AdminIcon name="calendar" /><div><strong>{terms.length ? 'No term available in this view' : 'No academic terms yet'}</strong><p>{terms.length ? 'Adjust the search or switch tabs to review another academic term.' : 'Create the first academic term to let faculty organize their classes for the semester.'}</p>{!terms.length && <button onClick={() => setCreateFormOpen(true)} type="button">Create First Term</button>}</div></section>}
      </div>
    </div>
    <AdminDesignModal
      description="Enter the semester details. You can review everything before the term is created."
      footer={<><AdminButton disabled={saving} kind="ghost" onClick={() => setCreateFormOpen(false)}>Cancel</AdminButton><AdminButton disabled={saving} form="admin-create-term-form" type="submit">Review Term</AdminButton></>}
      onClose={() => { if (!saving) setCreateFormOpen(false) }}
      open={createFormOpen}
      title="Create Academic Term"
      width="max-w-[560px]"
    >
      <form className="admin-term-form admin-term-create-form" id="admin-create-term-form" onSubmit={reviewCreateTerm}>
        <label>Academic Year<input autoFocus disabled={saving} onChange={(event) => setTermForm((current) => ({ ...current, academicYear: event.target.value }))} pattern="\d{4}-\d{4}" placeholder="2026-2027" required value={termForm.academicYear} /></label>
        <label>Semester<select disabled={saving} onChange={(event) => setTermForm((current) => ({ ...current, semester: event.target.value }))} value={termForm.semester}><option>1st Semester</option><option>2nd Semester</option></select></label>
        <label>Start Date<input disabled={saving} onChange={(event) => setTermForm((current) => ({ ...current, startDate: event.target.value }))} required type="date" value={termForm.startDate} /></label>
        <label>End Date<input disabled={saving} min={termForm.startDate || undefined} onChange={(event) => setTermForm((current) => ({ ...current, endDate: event.target.value }))} required type="date" value={termForm.endDate} /></label>
        <label className="admin-term-checkbox"><input checked={termForm.makeActive} disabled={saving} onChange={(event) => setTermForm((current) => ({ ...current, makeActive: event.target.checked }))} type="checkbox" />Make this the active term</label>
      </form>
    </AdminDesignModal>
    <AdminDesignModal
      description="Review the academic term details before adding it to the system."
      footer={<><AdminButton disabled={saving} kind="ghost" onClick={() => { setCreateConfirmationOpen(false); setCreateFormOpen(true) }}>Back</AdminButton><AdminButton disabled={saving} onClick={() => void createTerm()}>{saving ? 'Creating…' : 'Confirm & Create'}</AdminButton></>}
      onClose={() => { if (!saving) setCreateConfirmationOpen(false) }}
      open={createConfirmationOpen}
      title={`Create ${termForm.semester}, AY ${termForm.academicYear}?`}
    >
      <div className="grid gap-4">
        <div className="admin-confirmation-note success">
          <strong>{termForm.makeActive ? 'This will become the active term' : 'This will be added as an upcoming term'}</strong>
          <span>{termForm.makeActive ? 'Faculty members will be able to create new classes under this term after confirmation.' : 'The term will be available for review but will not replace the currently active term.'}</span>
        </div>
        {termForm.makeActive && activeTerm && <div className="admin-confirmation-note danger"><strong>{termLabel(activeTerm)} will be closed</strong><span>Its {activeTermOfferings.length} connected class{activeTermOfferings.length === 1 ? '' : 'es'} will become historical and read-only when the new term is activated.</span></div>}
        {termForm.makeActive && termForm.startDate > todayValue() && <div className="admin-confirmation-note warning"><strong>This term starts in the future</strong><span>Activating it now gives faculty immediate access to create classes before {formatDate(termForm.startDate)}.</span></div>}
        <dl className="grid gap-2 text-xs leading-5 text-[var(--admin-muted)]">
          <div className="flex justify-between gap-4"><dt>Academic term</dt><dd className="text-right font-semibold text-[var(--admin-text)]">{termForm.semester}, AY {termForm.academicYear}</dd></div>
          <div className="flex justify-between gap-4"><dt>Start date</dt><dd className="text-right font-semibold text-[var(--admin-text)]">{formatDate(termForm.startDate)}</dd></div>
          <div className="flex justify-between gap-4"><dt>End date</dt><dd className="text-right font-semibold text-[var(--admin-text)]">{formatDate(termForm.endDate)}</dd></div>
        </dl>
      </div>
    </AdminDesignModal>
    <AdminDesignModal
      description="Review what will change before activating this academic term."
      footer={<><AdminButton disabled={saving} kind="ghost" onClick={() => setActivationConfirmationOpen(false)}>Cancel</AdminButton><AdminButton disabled={saving} onClick={async () => { if (await setTermStatus('active')) setActivationConfirmationOpen(false) }}>{saving ? 'Activating…' : 'Activate Term'}</AdminButton></>}
      onClose={() => { if (!saving) setActivationConfirmationOpen(false) }}
      open={activationConfirmationOpen && Boolean(selectedTerm)}
      title={selectedTerm ? `Activate ${termLabel(selectedTerm)}?` : 'Activate academic term?'}
    >
      <div className="grid gap-4">
        <div className="admin-confirmation-note success"><strong>Faculty access will move to this term</strong><span>Faculty members will be able to create new subjects and sections under {selectedTerm ? termLabel(selectedTerm) : 'the selected term'}.</span></div>
        {activeTerm && activeTerm.id !== selectedTerm?.id && <div className="admin-confirmation-note danger"><strong>{termLabel(activeTerm)} will be closed</strong><span>Its {activeTermOfferings.length} connected class{activeTermOfferings.length === 1 ? '' : 'es'} will become historical and read-only.</span></div>}
        {selectedTerm?.start_date > todayValue() && <div className="admin-confirmation-note warning"><strong>This term starts in the future</strong><span>Activating it now gives faculty immediate access before {formatDate(selectedTerm.start_date)}.</span></div>}
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
