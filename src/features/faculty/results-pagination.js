export const RESULTS_PAGE_SIZE = 10

export function getResultsPage(items, requestedPage, pageSize = RESULTS_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(requestedPage, 0), pageCount - 1)
  const start = page * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageCount,
  }
}
