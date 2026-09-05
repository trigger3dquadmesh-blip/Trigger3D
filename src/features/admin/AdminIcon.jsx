const icons = {
  archive: <><path d="M4 7h16v13H4z" /><path d="M3 3h18v4H3zm6 9h6" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  cube: <><path d="m21 8-9 5-9-5 9-5 9 5Z" /><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Zm9 5v8" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6m-6 4h6" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  panelClose: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16m-4-11-3 3 3 3" /></>,
  panelOpen: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16m-7-7 3-3m-3 3 3 3" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8m0 3h.01" /></>,
  reset: <><path d="M4 4v6h6" /><path d="M5.3 16.5A8 8 0 1 0 4 10" /></>,
  restore: <><path d="M4 4v6h6" /><path d="M5.3 16.5A8 8 0 1 0 4 10" /><path d="M12 8v4l3 2" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M4 15v5h16v-5" /></>,
  userPlus: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0m3-12v6m3-3h-6" /></>,
  explode: <><path d="m12 3 4 2.3-4 2.3-4-2.3L12 3Zm-6 8 4 2.3L6 15.6l-4-2.3L6 11Zm12 0 4 2.3-4 2.3-4-2.3 4-2.3Zm-6 5 4 2.3-4 2.3-4-2.3 4-2.3Z" /></>,
}

export default function AdminIcon({ className = 'h-4 w-4', name }) {
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{icons[name]}</svg>
}
