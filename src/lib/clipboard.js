export async function copyText(text) {
  const value = String(text ?? '')
  if (!value) return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Some browsers expose Clipboard API but block it outside a secure context.
  }

  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  document.body.appendChild(input)
  input.select()
  input.setSelectionRange(0, value.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    input.remove()
  }
}
