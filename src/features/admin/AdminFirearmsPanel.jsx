import { useState } from 'react'
import FirearmImportPanel from './import/FirearmImportPanel.jsx'
import AdminDesignModal, { AdminBadge, AdminButton } from './AdminDesignModal.jsx'
import AdminIcon from './AdminIcon.jsx'

function Crosshair() {
  return <svg aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg>
}

function UploadBundleModal({ onClose, onImported, open }) {
  return (
    <AdminDesignModal description="Select the GLB model, component CSV, and question CSV used by the current validated importer." onClose={onClose} open={open} title="Upload Firearm Bundle" width="max-w-[760px]">
      <div className="admin-live-import-modal"><FirearmImportPanel onImported={async () => { await onImported(); onClose() }} /></div>
    </AdminDesignModal>
  )
}

export default function AdminFirearmsPanel({ dataError, firearms, loading, onChanged, onPreview }) {
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <section className="admin-firearms-page w-full p-6 text-[#172019]">
      <div className="mb-6 flex items-end justify-between gap-4"><div><nav className="mb-2 flex gap-1 text-xs text-[#5f6b63]"><span>Admin</span><span>›</span><span>Firearms</span></nav><h1 className="m-0 text-xl font-semibold">Firearm Management</h1></div><AdminButton onClick={() => setUploadOpen(true)}><AdminIcon name="upload" /> Upload Bundle</AdminButton></div>
      {dataError && <div className="mb-4 rounded-[7px] border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{dataError}</div>}
      <div className="mb-4 flex border-b border-[#b8c1bb]"><button className="border-b-2 border-[#109d1a] px-4 py-2.5 text-sm font-medium text-[#109d1a]" type="button">Active Library <span className="ml-1 rounded-full bg-[#edf0ee] px-1.5 py-0.5 text-[11px]">{firearms.length}</span></button></div>
      {loading && <p className="text-xs text-[#5f6b63]">Loading firearm library...</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {firearms.map((firearm) => (
          <article className="flex min-h-[330px] flex-col gap-4 overflow-hidden rounded-[10px] border border-[#b8c1bb] bg-white p-5" key={firearm.id}>
            <div className="-mx-5 -mt-5 grid h-28 place-items-center border-b border-[#b8c1bb] bg-gradient-to-br from-stone-900 to-stone-800 text-[#657069]"><Crosshair /></div>
            <div className="flex items-start justify-between gap-2"><div><strong className="block text-sm">{firearm.name}</strong><span className="text-xs text-[#5f6b63]">{firearm.identifier}</span></div><AdminBadge status={firearm.status === 'ready' ? 'active' : 'neutral'}>{firearm.status}</AdminBadge></div>
            <dl className="grid grid-cols-2 gap-2 text-xs">{[['Caliber', firearm.caliber], ['Components', firearm.component_count], ['Submitted Results', firearm.assessment_count], ['Imported', firearm.created_at ? new Date(firearm.created_at).toLocaleDateString() : '—']].map(([label, value]) => <div key={label}><dt className="mb-0.5 text-[10px] uppercase tracking-wide text-[#5f6b63]">{label}</dt><dd className="m-0 text-[11px]">{value}</dd></div>)}</dl>
            <div className="mt-auto flex gap-2 border-t border-[#b8c1bb] pt-3"><AdminButton className="flex-1 border-[#b8c1bb]" kind="ghost" onClick={() => onPreview(firearm.id)}><AdminIcon name="eye" /> Preview</AdminButton><button aria-label="Archive firearm unavailable" className="grid h-8 w-9 cursor-not-allowed place-items-center rounded-lg text-[#9ca69f]" disabled title="Archive support requires a database migration." type="button"><AdminIcon name="archive" /></button></div>
          </article>
        ))}
      </div>
      {!loading && firearms.length === 0 && <p className="rounded-[10px] border border-[#b8c1bb] bg-white p-12 text-center text-sm text-[#5f6b63]">No firearm models have been uploaded.</p>}
      <UploadBundleModal onClose={() => setUploadOpen(false)} onImported={onChanged} open={uploadOpen} />
    </section>
  )
}
