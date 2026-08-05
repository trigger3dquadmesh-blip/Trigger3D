import { useState } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { validateGunBundle } from './validation.js'

export default function FirearmImportPanel({ onImported }) {
  const [name, setName] = useState('Generic M1911 A2 Pattern')
  const [caliber, setCaliber] = useState('.45')
  const [description, setDescription] = useState('Development placeholder pending gunsmith review.')
  const [glbFile, setGlbFile] = useState(null)
  const [componentsFile, setComponentsFile] = useState(null)
  const [questionsFile, setQuestionsFile] = useState(null)
  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function clearValidation() {
    setValidation(null)
    setError('')
    setNotice('')
  }

  async function runValidation() {
    setValidating(true)
    setError('')
    setNotice('')

    const result = await validateGunBundle({
      glbFile,
      componentsFile,
      questionsFile,
    })

    setValidation(result)
    setValidating(false)
    return result
  }

  async function handleImport(event) {
    event.preventDefault()

    if (!name.trim() || !caliber.trim()) {
      setError('Enter the firearm name and caliber.')
      return
    }

    const result = validation?.data ? validation : await runValidation()
    if (!result.data) return

    setImporting(true)
    setError('')
    setNotice('')

    const storagePath = `${result.data.identifier}/${crypto.randomUUID()}.glb`
    const { error: uploadError } = await supabase.storage
      .from('firearm-models')
      .upload(storagePath, glbFile, {
        contentType: 'model/gltf-binary',
        upsert: false,
      })

    if (uploadError) {
      setError(uploadError.message)
      setImporting(false)
      return
    }

    const { data, error: databaseError } = await supabase.rpc(
      'finalize_firearm_import',
      {
        model_identifier: result.data.identifier,
        model_name: name.trim(),
        model_caliber: caliber.trim(),
        model_description: description.trim(),
        model_storage_path: storagePath,
        imported_components: result.data.components,
        imported_questions: result.data.questions,
      },
    )

    if (databaseError) {
      const { error: cleanupError } = await supabase.storage
        .from('firearm-models')
        .remove([storagePath])

      setError(
        cleanupError
          ? `${databaseError.message} Cleanup also failed: ${cleanupError.message}`
          : databaseError.message,
      )
      setImporting(false)
      return
    }

    setNotice(`${data.name} imported successfully.`)
    setImporting(false)
    onImported?.(data)
  }

  return (
    <article className="dashboard-card import-panel">
      <div className="import-heading">
        <div>
          <h2>Import firearm bundle</h2>
          <p>Select one GLB, its component CSV, and its question CSV.</p>
        </div>
        {validation?.data && <span className="status-badge active">validated</span>}
      </div>

      <form className="import-form" onSubmit={handleImport}>
        <div className="import-details">
          <label>
            Firearm name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Caliber
            <input value={caliber} onChange={(event) => setCaliber(event.target.value)} required />
          </label>
        </div>

        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows="3"
          />
        </label>

        <div className="file-grid">
          <label>
            GLB model
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(event) => {
                setGlbFile(event.target.files[0] || null)
                clearValidation()
              }}
              required
            />
          </label>
          <label>
            Component CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setComponentsFile(event.target.files[0] || null)
                clearValidation()
              }}
              required
            />
          </label>
          <label>
            Question CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setQuestionsFile(event.target.files[0] || null)
                clearValidation()
              }}
              required
            />
          </label>
        </div>

        {validation?.errors.length > 0 && (
          <div className="alert alert-error" role="alert">
            <strong>Bundle rejected:</strong>
            <ul>
              {validation.errors.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        )}

        {validation?.data && (
          <div className="validation-summary" role="status">
            <strong>{validation.data.identifier}</strong>
            <span>{validation.data.meshNames.length} GLB components</span>
            <span>{validation.data.components.length} metadata rows</span>
            <span>{validation.data.questions.length} questions</span>
          </div>
        )}

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}

        <div className="import-actions">
          <button type="button" onClick={runValidation} disabled={validating || importing}>
            {validating ? 'Validating...' : 'Validate files'}
          </button>
          <button
            className="primary-action"
            type="submit"
            disabled={!validation?.data || importing || validating}
          >
            {importing ? 'Importing...' : 'Import validated bundle'}
          </button>
        </div>
      </form>
    </article>
  )
}
