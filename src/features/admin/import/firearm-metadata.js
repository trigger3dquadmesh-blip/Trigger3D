const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'])

export function normalizeTutorialUrl(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' && youtubeHosts.has(url.hostname.toLowerCase()) ? url.toString() : ''
  } catch {
    return ''
  }
}

export function normalizeModelCredit(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function modelCreditHref(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

export function validateFirearmMetadata({ firearmType, modelCredit = '', tutorialUrl }) {
  if (!['short_arm', 'long_arm'].includes(firearmType)) return 'Choose whether the firearm is a short arm or long arm.'
  if (tutorialUrl.trim() && !normalizeTutorialUrl(tutorialUrl)) return 'Enter a valid HTTPS YouTube video link.'
  if (normalizeModelCredit(modelCredit).length > 300) return 'Keep the model source or credits within 300 characters.'
  return ''
}
