// Latest firearm activity for the admin overview (audit events are newest
// first). Shows one entry per firearm (its most recent event) and hides
// activity for firearms that no longer exist, except the deletion itself.
export function getRecentFirearmEvents(auditEvents = [], firearms = [], limit = 3) {
  const existingIds = new Set(firearms.map((firearm) => firearm.id))
  const shownFirearms = new Set()
  const recent = []
  for (const event of auditEvents) {
    if (event.entity_type !== 'firearm') continue
    const firearmKey = event.entity_id ?? event.id
    if (shownFirearms.has(firearmKey)) continue
    const isDeletion = /deleted/i.test(event.event_type || '')
    if (!isDeletion && event.entity_id && !existingIds.has(event.entity_id)) continue
    shownFirearms.add(firearmKey)
    recent.push(event)
    if (recent.length >= limit) break
  }
  return recent
}
