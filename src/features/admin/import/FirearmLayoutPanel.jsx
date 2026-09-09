import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { validateComponentLayout } from './validation.js'
import useAutoDismissNotice from '../../../components/useAutoDismissNotice.js'

export default function FirearmLayoutPanel({ firearms }) {
  const [firearmId, setFirearmId] = useState('')
  const [componentsFile, setComponentsFile] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useAutoDismissNotice(notice, () => setNotice(''))

  const selectedFirearm = useMemo(
    () => firearms.find((firearm) => firearm.id === firearmId) ?? null,
    [firearmId, firearms],
  )

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!selectedFirearm || !componentsFile) {
      setError('Select an imported firearm and its component CSV.')
      return
    }

    setUpdating(true)

    const { data: storedComponents, error: queryError } = await supabase
      .from('firearm_components')
      .select('mesh_name')
      .eq('firearm_id', selectedFirearm.id)

    if (queryError) {
      setError(queryError.message)
      setUpdating(false)
      return
    }

    const validation = await validateComponentLayout({
      componentsFile,
      identifier: selectedFirearm.identifier,
      expectedNames: storedComponents.map((component) => component.mesh_name),
    })

    if (!validation.data) {
      setError(validation.errors.join(' '))
      setUpdating(false)
      return
    }

    const { data: updatedCount, error: updateError } = await supabase.rpc(
      'update_firearm_component_layout',
      {
        model_identifier: selectedFirearm.identifier,
        imported_components: validation.data.components,
      },
    )

    if (updateError) {
      setError(updateError.message)
    } else {
      setNotice(`Updated ${updatedCount} component layouts for ${selectedFirearm.name}.`)
    }

    setUpdating(false)
  }

  return (
    <article className="dashboard-card import-panel">
      <div className="import-heading">
        <div>
          <h2>Update exploded-view layout</h2>
          <p>Apply a revised component CSV without uploading the GLB again.</p>
        </div>
      </div>

      <aside className="import-checklist" aria-label="Layout update checklist">
        <div>
          <strong>Check the file before updating</strong>
          <p>Select the firearm first, then choose the component CSV made for it. Saving the update replaces that firearm’s current exploded-view positions.</p>
        </div>
      </aside>

      <form className="import-form" onSubmit={handleSubmit}>
        <div className="file-grid">
          <label>
            Imported firearm
            <select
              value={firearmId}
              onChange={(event) => {
                setFirearmId(event.target.value)
                setError('')
                setNotice('')
              }}
              required
            >
              <option value="">Select firearm</option>
              {firearms.map((firearm) => (
                <option value={firearm.id} key={firearm.id}>
                  {firearm.identifier} · {firearm.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Component CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setComponentsFile(event.target.files[0] || null)
                setError('')
                setNotice('')
              }}
              required
            />
          </label>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}

        <div className="import-actions">
          <button
            className="primary-action"
            type="submit"
            disabled={updating || firearms.length === 0}
          >
            {updating ? 'Updating layout...' : 'Update layout'}
          </button>
        </div>
      </form>
    </article>
  )
}
