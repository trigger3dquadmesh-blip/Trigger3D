export default function DashboardLoading({ className = '', label = 'Loading…' }) {
  return (
    <div aria-busy="true" aria-live="polite" className={`dashboard-loading-state dashboard-loading-screen ${className}`.trim()} role="status">
      <span className="dashboard-loading-spinner" />
      <span>{label}</span>
    </div>
  )
}
