import { useState } from 'react'
import { supabase } from '../../../lib/supabase.js'
import AdminIcon from '../AdminIcon.jsx'
import { validateGunBundle } from './validation.js'
import { normalizeModelCredit, normalizeTutorialUrl, validateFirearmMetadata } from './firearm-metadata.js'

function FilePicker({ accept, file, hint, icon, label, onChange }) {
  return (
    <label className="group grid min-h-[104px] cursor-pointer place-content-center justify-items-center rounded-[9px] border-2 border-dashed border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-4 text-center hover:border-[#109d1a]">
      <AdminIcon className="mb-2 h-5 w-5 text-[var(--admin-muted)] group-hover:text-[#109d1a]" name={icon} />
      <strong className="text-xs font-semibold text-[var(--admin-text)]">{label}</strong>
      <span className="mt-1 max-w-full truncate text-[11px] text-[var(--admin-muted)]">{file?.name || hint}</span>
      <input accept={accept} className="sr-only" onChange={(event) => onChange(event.target.files?.[0] || null)} type="file" />
    </label>
  )
}

export default function FirearmImportPanel({ onImported }) {
  const [name, setName] = useState('')
  const [caliber, setCaliber] = useState('')
  const [description, setDescription] = useState('')
  const [firearmType, setFirearmType] = useState('')
  const [tutorialUrl, setTutorialUrl] = useState('')
  const [modelCredit, setModelCredit] = useState('')
  const [glbFile, setGlbFile] = useState(null)
  const [componentsFile, setComponentsFile] = useState(null)
  const [questionsFile, setQuestionsFile] = useState(null)
  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  function clearValidation() {
    setValidation(null)
    setError('')
  }

  async function runValidation() {
    setValidating(true)
    setError('')
    const result = await validateGunBundle({ glbFile, componentsFile, questionsFile })
    setValidation(result)
    setValidating(false)
    return result
  }

  async function importBundle() {
    if (!name.trim() || !caliber.trim()) {
      setError('Enter the firearm name and caliber.')
      return
    }
    const metadataError = validateFirearmMetadata({ firearmType, modelCredit, tutorialUrl })
    if (metadataError) {
      setError(metadataError)
      return
    }
    const result = validation?.data ? validation : await runValidation()
    if (!result.data) return
    setImporting(true)
    setError('')
    const storagePath = result.data.identifier + '/' + crypto.randomUUID() + '.glb'
    const { error: uploadError } = await supabase.storage.from('firearm-models').upload(storagePath, glbFile, { contentType: 'model/gltf-binary', upsert: false })
    if (uploadError) {
      setError(uploadError.message)
      setImporting(false)
      return
    }
    const { data, error: databaseError } = await supabase.rpc('finalize_firearm_import', {
      model_identifier: result.data.identifier,
      model_name: name.trim(),
      model_caliber: caliber.trim(),
      model_description: description.trim(),
      model_storage_path: storagePath,
      imported_components: result.data.components,
      imported_questions: result.data.questions,
    })
    if (databaseError) {
      const { error: cleanupError } = await supabase.storage.from('firearm-models').remove([storagePath])
      setError(cleanupError ? databaseError.message + ' Cleanup also failed: ' + cleanupError.message : databaseError.message)
      setImporting(false)
      return
    }
    const { error: metadataSaveError } = await supabase.rpc('set_firearm_learning_metadata', { target_identifier: result.data.identifier, new_firearm_type: firearmType, new_tutorial_url: normalizeTutorialUrl(tutorialUrl) || null, new_model_credit: normalizeModelCredit(modelCredit) || null })
    if (metadataSaveError) {
      setError(`The bundle was imported, but its classification, tutorial link, and model credits could not be saved: ${metadataSaveError.message}`)
      setImporting(false)
      await onImported?.(data)
      return
    }
    setImporting(false)
    await onImported?.(data)
  }

  const fieldClass = 'h-10 w-full rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-input)] px-3 text-sm text-[var(--admin-input-text)] outline-none placeholder:text-[#7c8780] focus:border-[#109d1a] focus:ring-2 focus:ring-[#109d1a]/20'

  return (
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void importBundle() }}>
      <section className="grid gap-4 rounded-[9px] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4">
        <div><h3 className="m-0 text-sm font-semibold text-[var(--admin-text)]">Firearm information</h3><p className="mb-0 mt-1 text-xs text-[var(--admin-muted)]">These values identify the model throughout Trigger3D.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--admin-text)]">Firearm name<input className={fieldClass} onChange={(event) => setName(event.target.value)} placeholder="e.g. Glock 17" required value={name} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--admin-text)]">Caliber<input className={fieldClass} onChange={(event) => setCaliber(event.target.value)} placeholder="e.g. 9mm Parabellum" required value={caliber} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--admin-text)]">Firearm classification<select className={fieldClass} onChange={(event) => setFirearmType(event.target.value)} required value={firearmType}><option value="">Select a classification</option><option value="short_arm">Short arm</option><option value="long_arm">Long arm</option></select></label>
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--admin-text)]"><span>YouTube tutorial link <span className="font-normal text-[var(--admin-muted)]">(optional)</span></span><input className={fieldClass} inputMode="url" onChange={(event) => setTutorialUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" type="url" value={tutorialUrl} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--admin-text)] sm:col-span-2"><span>Model source / credits <span className="font-normal text-[var(--admin-muted)]">(optional)</span></span><input className={fieldClass} maxLength="300" onChange={(event) => setModelCredit(event.target.value)} placeholder="e.g. Creator name, organization, or source website" value={modelCredit} /></label>
        </div>
        <label className="grid gap-1.5 text-xs font-semibold text-[var(--admin-text)]">Description<textarea className="min-h-[76px] w-full resize-y rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-input)] px-3 py-2 text-sm text-[var(--admin-input-text)] outline-none focus:border-[#109d1a] focus:ring-2 focus:ring-[#109d1a]/20" onChange={(event) => setDescription(event.target.value)} placeholder="Brief model description" value={description} /></label>
      </section>

      <section><div className="mb-3"><h3 className="m-0 text-sm font-semibold text-[var(--admin-text)]">Bundle files</h3><p className="mb-0 mt-1 text-xs text-[var(--admin-muted)]">Choose the matching GLB and CSV files. File names are validated before upload.</p></div><div className="grid gap-3 sm:grid-cols-3"><FilePicker accept=".glb,model/gltf-binary" file={glbFile} hint=".glb model" icon="cube" label="3D Model" onChange={(file) => { setGlbFile(file); clearValidation() }} /><FilePicker accept=".csv,text/csv" file={componentsFile} hint="components.csv" icon="file" label="Component Data" onChange={(file) => { setComponentsFile(file); clearValidation() }} /><FilePicker accept=".csv,text/csv" file={questionsFile} hint="questions.csv" icon="question" label="Assessment Questions" onChange={(file) => { setQuestionsFile(file); clearValidation() }} /></div></section>

      {validation?.errors.length > 0 && <div className="rounded-[8px] border border-red-400 bg-red-50 p-3 text-xs text-red-700" role="alert"><strong>Bundle rejected</strong><ul className="mb-0 mt-2 pl-5">{validation.errors.map((message) => <li key={message}>{message}</li>)}</ul></div>}
      {validation?.data && <div className="grid grid-cols-2 gap-2 rounded-[8px] border border-green-400 bg-green-50 p-3 text-xs text-green-800 sm:grid-cols-4" role="status"><strong>{validation.data.identifier}</strong><span>{validation.data.meshNames.length} meshes</span><span>{validation.data.components.length} components</span><span>{validation.data.questions.length} questions</span></div>}
      {error && <div className="rounded-[8px] border border-red-400 bg-red-50 p-3 text-xs text-red-700" role="alert">{error}</div>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] pt-4"><button className="h-9 rounded-lg border border-[var(--admin-border)] bg-transparent px-4 text-xs font-semibold text-[var(--admin-text)] hover:border-[#109d1a] disabled:opacity-50" disabled={validating || importing} onClick={() => void runValidation()} type="button">{validating ? 'Validating…' : validation?.data ? 'Validate again' : 'Validate files'}</button><button className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#109d1a] px-4 text-xs font-semibold text-white hover:bg-[#0c7d15] disabled:cursor-not-allowed disabled:opacity-50" disabled={!validation?.data || importing || validating} type="submit"><AdminIcon name="upload" />{importing ? 'Importing…' : 'Import validated bundle'}</button></div>
    </form>
  )
}
