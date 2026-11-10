export function getRecentFirearmEvents(auditEvents = [], limit = 3) {
  return auditEvents
    .filter((event) => event.entity_type === 'firearm')
    .slice(0, limit)
}
