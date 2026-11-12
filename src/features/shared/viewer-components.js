export async function resolveViewerComponents(result, loadFallback) {
  // Query failures must remain visible instead of becoming an empty sidebar.
  if (result.error) {
    throw new Error('The component details could not be loaded. Check your connection and try again.')
  }
  const rows = result.data?.length ? result.data : await loadFallback()
  const components = Array.isArray(rows)
    ? rows.filter((component) => typeof component?.mesh_name === 'string' && component.mesh_name.trim())
    : []
  if (!components.length) {
    throw new Error('Component details are unavailable for this firearm. Retry loading. If this continues after an assessment reset, ask the administrator to check component access and the firearm component records.')
  }
  return components
}
