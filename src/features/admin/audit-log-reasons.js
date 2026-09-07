export function getAuditReason(item) {
  const recordedReason = item.reason?.trim()
  if (recordedReason) return recordedReason

  const event = (item.event_type || '').trim().toLowerCase()
  const record = item.record_label?.trim() || 'This record'
  if (event.includes('archiv')) return `${record} was archived while its existing records were preserved.`
  if (event.includes('restor') || event.includes('readmit')) return `${record} was restored and access was made available again.`
  if (event.includes('creat') || event.includes('join')) return `${record} was added to Trigger3D.`
  if (event.includes('upload')) return `${record} was uploaded to Trigger3D.`
  if (event.includes('remov')) return `${record} was removed from active access while its history was preserved.`
  if (event.includes('delet')) return `${record} was permanently removed from Trigger3D.`
  if (event.includes('updat') || event.includes('edit')) return `${record} was updated in Trigger3D.`
  return `This ${item.entity_type || 'system'} activity was recorded automatically; no additional reason was supplied.`
}
