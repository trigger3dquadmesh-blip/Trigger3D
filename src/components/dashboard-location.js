export function getSavedDashboardPage(storage, key, allowedPages, fallbackPage) {
  try {
    const savedPage = storage.getItem(key)
    return allowedPages.includes(savedPage) ? savedPage : fallbackPage
  } catch {
    return fallbackPage
  }
}

export function saveDashboardPage(storage, key, page) {
  try {
    storage.setItem(key, page)
  } catch {
    // Storage can be unavailable in a private browser session. The dashboard still works normally.
  }
}
