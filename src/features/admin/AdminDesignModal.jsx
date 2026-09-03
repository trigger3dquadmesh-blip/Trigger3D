import { useEffect } from 'react'

export default function AdminDesignModal({ children, description, footer, onClose, open, title, width = 'max-w-[446px]' }) {
  useEffect(() => {
    if (!open) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/45 p-5 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
      <section aria-labelledby="admin-modal-title" aria-modal="true" className={'admin-design-modal flex max-h-[calc(100dvh-2.5rem)] w-full flex-col ' + width + ' overflow-hidden rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-card)] text-[var(--admin-text)] shadow-[0_24px_70px_rgb(0_0_0/0.38)]'} role="dialog">
        <header className="relative px-5 pb-0 pt-5">
          <h2 className="text-[15px] font-semibold" id="admin-modal-title">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-[var(--admin-muted)]">{description}</p>}
          <button aria-label="Close modal" className="absolute right-5 top-5 border-0 bg-transparent text-xl leading-none text-[#5f6b63]" onClick={onClose} type="button">×</button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-bg)] px-5 py-3.5">{footer}</footer>}
      </section>
    </div>
  )
}

export function AdminButton({ children, className = '', kind = 'primary', ...props }) {
  const colors = kind === 'primary'
    ? 'border-[#109d1a] bg-[#109d1a] text-white hover:bg-[#0d8516]'
    : kind === 'danger'
      ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
      : 'border-[var(--admin-border)] bg-[var(--admin-card)] text-[var(--admin-text)] hover:bg-[var(--admin-muted-surface)]'
  return <button className={'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors disabled:opacity-50 ' + colors + ' ' + className} type="button" {...props}>{children}</button>
}

export function AdminField({ label, error, children }) {
  return <label className="grid gap-1.5 text-xs font-medium text-[var(--admin-text)]">{label}{children}{error && <span className="text-[11px] text-red-600">{error}</span>}</label>
}

export function AdminBadge({ children, status = 'neutral' }) {
  const color = status === 'active' ? 'admin-badge-active' : 'admin-badge-neutral'
  return <span className={'admin-badge inline-flex w-fit rounded-full border px-2 py-0.5 text-xs leading-4 ' + color}>{children}</span>
}
