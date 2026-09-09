import { useEffect, useRef, useState } from 'react'
import FirearmImportPanel from './import/FirearmImportPanel.jsx'
import { validateComponentLayout } from './import/validation.js'
import { isFirearmDeleteConfirmed } from './firearm-utils.js'
import { supabase } from '../../lib/supabase.js'
import AdminDesignModal, { AdminBadge, AdminButton, AdminField } from './AdminDesignModal.jsx'
import AdminIcon from './AdminIcon.jsx'
import { modelCreditHref } from './import/firearm-metadata.js'
import DashboardLoading from '../../components/DashboardLoading.jsx'

function UploadBundleModal({ onClose, onImported, open }) {
  return (
    <AdminDesignModal description="Select the GLB model, component CSV, and question CSV used by the current validated importer." onClose={onClose} open={open} title="Upload Firearm Bundle" width="max-w-[760px]">
      <div className="admin-live-import-modal"><FirearmImportPanel onImported={async () => { await onImported(); onClose() }} /></div>
    </AdminDesignModal>
  )
}

function ModelCredit({ value }) {
  if (!value) return null
  const href = modelCreditHref(value)
  return <p className="admin-model-credit"><strong>Model source / credits:</strong> {href ? <a href={href} rel="noreferrer" target="_blank">{value}</a> : <span>{value}</span>}</p>
}

function UpdateComponentsModal({ firearm, onClose, onUpdated }) {
  const [componentsFile, setComponentsFile] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  if (!firearm) return null

  async function updateComponents() {
    if (!componentsFile) {
      setError('Choose the component CSV for this firearm.')
      return
    }
    setUpdating(true)
    setError('')
    const { data: storedComponents, error: queryError } = await supabase.from('firearm_components').select('mesh_name').eq('firearm_id', firearm.id)
    if (queryError) {
      setError(queryError.message)
      setUpdating(false)
      return
    }
    const validation = await validateComponentLayout({ componentsFile, identifier: firearm.identifier, expectedNames: storedComponents.map((component) => component.mesh_name) })
    if (!validation.data) {
      setError(validation.errors.join(' '))
      setUpdating(false)
      return
    }
    const { error: updateError } = await supabase.rpc('update_firearm_component_layout', { model_identifier: firearm.identifier, imported_components: validation.data.components })
    if (updateError) setError(updateError.message)
    else {
      await onUpdated()
      onClose()
    }
    setUpdating(false)
  }

  return <AdminDesignModal description={`Replace the exploded-view positions for ${firearm.name} without uploading its 3D model again.`} footer={<><AdminButton disabled={updating} kind="ghost" onClick={onClose}>Cancel</AdminButton><AdminButton disabled={updating || !componentsFile} onClick={updateComponents}>{updating ? 'Updating…' : 'Update Components'}</AdminButton></>} onClose={onClose} open title="Update Component CSV"><div className="grid gap-4"><div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-muted-surface)] p-3 text-xs text-[var(--admin-muted)]"><strong className="block text-[var(--admin-text)]">Required filename</strong><span>{firearm.identifier}_components.csv</span></div><label className="grid gap-1.5 text-xs font-semibold text-[var(--admin-text)]"><span>Revised component file</span><span className="admin-component-file-picker"><AdminIcon name="file" /><span><strong>{componentsFile ? componentsFile.name : 'Choose component CSV'}</strong><small>{componentsFile ? 'File selected and ready for validation' : 'CSV files only'}</small></span><span className="admin-component-file-action">Browse</span><input accept=".csv,text/csv" className="sr-only" onChange={(event) => { setComponentsFile(event.target.files?.[0] || null); setError('') }} type="file" /></span></label>{error && <div className="alert alert-error" role="alert">{error}</div>}</div></AdminDesignModal>
}

function DeleteFirearmModal({ confirmation, firearm, onClose, onConfirm, onConfirmationChange, saving }) {
  if (!firearm) return null
  const confirmed = isFirearmDeleteConfirmed(firearm.identifier, confirmation)
  return <AdminDesignModal description="This permanently deletes the firearm, its model, components, questions, and related records. This action cannot be undone." footer={<><AdminButton disabled={saving} kind="ghost" onClick={onClose}>Cancel</AdminButton><AdminButton disabled={saving || !confirmed} kind="danger" onClick={onConfirm}>{saving ? 'Deleting…' : 'Delete Firearm'}</AdminButton></>} onClose={onClose} open title={`Delete ${firearm.name}?`}><div className="grid gap-4"><div className="admin-confirmation-note danger"><strong>Permanent action</strong><span>Download or preserve any required source files before continuing.</span></div><AdminField label={<span>Type “<strong>{firearm.identifier}</strong>” to confirm.</span>}><input autoComplete="off" autoFocus className="h-10 rounded-[7px] border border-[var(--admin-border)] bg-[var(--admin-input)] px-3 text-sm text-[var(--admin-input-text)] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" onChange={(event) => onConfirmationChange(event.target.value)} spellCheck="false" value={confirmation} /></AdminField></div></AdminDesignModal>
}

export default function AdminFirearmsPanel({ dataError, firearms, loading, onChanged, onPreview }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [menuFirearmId, setMenuFirearmId] = useState('')
  const [componentTarget, setComponentTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuFirearmId) return undefined
    function closeMenu(event) {
      if (!menuRef.current?.contains(event.target)) setMenuFirearmId('')
    }
    function closeMenuWithKeyboard(event) {
      if (event.key === 'Escape') setMenuFirearmId('')
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeMenuWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeMenuWithKeyboard)
    }
  }, [menuFirearmId])

  async function deleteFirearm() {
    if (!deleteTarget || !isFirearmDeleteConfirmed(deleteTarget.identifier, deleteConfirmation)) return
    setDeleting(true)
    setActionError('')
    const { data, error } = await supabase.functions.invoke('admin-firearms', { body: { action: 'delete_firearm', firearm_id: deleteTarget.id } })
    if (error) setActionError(error.message)
    else {
      const warnings = [data.storage_warning, data.audit_warning].filter(Boolean).join(' ')
      setNotice(`${deleteTarget.name} was permanently deleted.`)
      if (warnings) setActionError(`Deletion completed, but follow-up cleanup needs attention. ${warnings}`)
      setDeleteTarget(null)
      setDeleteConfirmation('')
      await onChanged()
    }
    setDeleting(false)
  }

  if (loading) return <section className="admin-firearms-page w-full p-6"><DashboardLoading label="Loading firearms…" /></section>

  return (
    <section className="admin-firearms-page w-full p-6 text-[#172019]">
      <div className="mb-6 flex items-end justify-between gap-4"><div><nav className="mb-2 flex gap-1 text-xs text-[#5f6b63]"><span>Admin</span><span>›</span><span>Firearms</span></nav><h1 className="m-0 text-xl font-semibold">Firearm Management</h1></div><AdminButton onClick={() => setUploadOpen(true)}><AdminIcon name="upload" /> Upload Bundle</AdminButton></div>
      {dataError && <div className="mb-4 rounded-[7px] border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{dataError}</div>}
      {actionError && <div className="mb-4 rounded-[7px] border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{actionError}</div>}
      {notice && <div className="mb-4 rounded-[7px] border border-green-300 bg-green-50 px-4 py-3 text-xs text-green-700" role="status">{notice}</div>}
      <div className="mb-4 flex border-b border-[#b8c1bb]"><button className="border-b-2 border-[#109d1a] px-4 py-2.5 text-sm font-medium text-[#109d1a]" type="button">Active Library <span className="ml-1 rounded-full bg-[#edf0ee] px-1.5 py-0.5 text-[11px]">{firearms.length}</span></button></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {firearms.map((firearm) => (
          <article className="admin-firearm-live-card flex min-h-[250px] flex-col gap-[14px] overflow-hidden rounded-[10px] border border-[#b8c1bb] bg-white p-5" key={firearm.id}>
            <div className="admin-firearm-heading flex items-start justify-between gap-2"><div><strong className="block text-sm">{firearm.name}</strong><span className="text-xs text-[#5f6b63]">{firearm.identifier}</span></div><AdminBadge status={firearm.status === 'ready' ? 'active' : 'neutral'}>{firearm.status}</AdminBadge></div>
            <div className="admin-firearm-learning-info"><p>{firearm.description || 'No firearm description provided.'}</p><ModelCredit value={firearm.model_credit} />{firearm.tutorial_url && <a href={firearm.tutorial_url} rel="noreferrer" target="_blank"><AdminIcon name="play" /> Watch YouTube tutorial</a>}</div>
            <dl className="admin-firearm-metadata grid grid-cols-2 gap-2 text-xs">{[['Caliber', firearm.caliber], ['Components', firearm.component_count], ['Submitted Results', firearm.assessment_count], ['Imported', firearm.created_at ? new Date(firearm.created_at).toLocaleDateString() : 'Not available']].map(([label, value]) => <div key={label}><dt className="mb-0.5 text-[10px] uppercase tracking-wide text-[#5f6b63]">{label}</dt><dd className="m-0 text-[11px]">{value}</dd></div>)}</dl>
            <div className="admin-firearm-footer mt-auto flex gap-2 border-t border-[#b8c1bb] pt-3"><AdminButton className="flex-1 border-[#b8c1bb]" kind="ghost" onClick={() => onPreview(firearm.id)}><AdminIcon name="eye" /> Preview</AdminButton><div className="admin-firearm-card-menu" ref={menuFirearmId === firearm.id ? menuRef : null}><button aria-expanded={menuFirearmId === firearm.id} aria-haspopup="menu" aria-label={`Open actions for ${firearm.name}`} className="admin-firearm-more" onClick={() => setMenuFirearmId((current) => current === firearm.id ? '' : firearm.id)} title="Firearm actions" type="button"><AdminIcon name="more" /></button>{menuFirearmId === firearm.id && <div className="admin-firearm-action-menu" role="menu"><button onClick={() => { setMenuFirearmId(''); setComponentTarget(firearm) }} role="menuitem" type="button"><AdminIcon name="file" />Update component CSV</button><button className="danger" onClick={() => { setMenuFirearmId(''); setDeleteConfirmation(''); setDeleteTarget(firearm) }} role="menuitem" type="button"><AdminIcon name="trash" />Delete firearm</button></div>}</div></div>
          </article>
        ))}
      </div>
      {!loading && firearms.length === 0 && <p className="rounded-[10px] border border-[#b8c1bb] bg-white p-12 text-center text-sm text-[#5f6b63]">No firearm models have been uploaded.</p>}
      <UploadBundleModal onClose={() => setUploadOpen(false)} onImported={onChanged} open={uploadOpen} />
      <UpdateComponentsModal firearm={componentTarget} onClose={() => setComponentTarget(null)} onUpdated={async () => { setNotice(`${componentTarget?.name || 'Firearm'} components were updated.`); await onChanged() }} />
      <DeleteFirearmModal confirmation={deleteConfirmation} firearm={deleteTarget} onClose={() => { setDeleteTarget(null); setDeleteConfirmation('') }} onConfirm={deleteFirearm} onConfirmationChange={setDeleteConfirmation} saving={deleting} />
    </section>
  )
}
