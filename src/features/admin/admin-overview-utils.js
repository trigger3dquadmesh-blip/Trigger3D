export function getRecentFirearmEvents(auditEvents = [], firearms = [], limit = 3) {
  const activeFirearmIds = new Set(firearms.map((firearm) => firearm.id))
  const seenFirearmIds = new Set()

  return auditEvents.filter((event) => {
    if (event.entity_type !== 'firearm') return false

    const isDeletion = String(event.event_type || '').toLowerCase().includes('delet')
    if (event.entity_id && !activeFirearmIds.has(event.entity_id) && !isDeletion) return false
    if (event.entity_id && seenFirearmIds.has(event.entity_id)) return false
    if (event.entity_id) seenFirearmIds.add(event.entity_id)
    return true
  }).slice(0, limit)
}
