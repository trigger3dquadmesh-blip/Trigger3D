const paths = {
  dashboard: <><rect height="7" rx="1" width="7" x="3" y="3" /><rect height="7" rx="1" width="7" x="14" y="3" /><rect height="7" rx="1" width="7" x="3" y="14" /><rect height="7" rx="1" width="7" x="14" y="14" /></>,
  classroom: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.2a4.8 4.8 0 0 1 4.8-4.8h1.4a4.8 4.8 0 0 1 4.8 4.8V20" /><path d="M17 5.5a3 3 0 0 1 0 5.7" /><path d="M18 14.2a3.8 3.8 0 0 1 2.5 3.6V20" /></>,
  classes: <><rect height="12" rx="1" width="18" x="3" y="4" /><path d="M8 20h8M12 16v4M7 8h10M7 12h6" /></>,
  cube: <><path d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4L12 3Z" /><path d="m4 7.4 8 4.5 8-4.5M12 12v9" /></>,
  layers: <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" /></>,
  assessment: <><path d="M7 3h7l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h1Z" /><path d="M13 3v5h5M8 13h6M8 17h6" /></>,
  checklist: <><path d="M7 3h7l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h1Z" /><path d="M13 3v5h5M8 13l1.5 1.5L17 9M8 17h6" /></>,
  results: <><path d="M5 20V10m7 10V4m7 16v-7" /><path d="M3 21h18" /></>,
  upload: <><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>,
  audit: <><path d="M4 13h3l2-7 4 13 2-6h5" /><path d="M3 21h18" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18M7 14h3m4 0h3M7 18h3" /></>,
}

export default function SidebarIcon({ name }) {
  return <svg aria-hidden="true" className="sidebar-icon" fill="none" viewBox="0 0 24 24">{paths[name] ?? paths.dashboard}</svg>
}
