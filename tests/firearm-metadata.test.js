import test from 'node:test'
import assert from 'node:assert/strict'
import { modelCreditHref, normalizeModelCredit, normalizeTutorialUrl, validateFirearmMetadata } from '../src/features/admin/import/firearm-metadata.js'

test('accepts HTTPS YouTube and youtu.be tutorial links', () => {
  assert.equal(validateFirearmMetadata({ firearmType: 'short_arm', tutorialUrl: 'https://youtu.be/example' }), '')
  assert.match(normalizeTutorialUrl('https://www.youtube.com/watch?v=example'), /^https:\/\/www\.youtube\.com\//)
})

test('requires a supported firearm classification', () => {
  assert.equal(validateFirearmMetadata({ firearmType: '', tutorialUrl: '' }), 'Choose whether the firearm is a short arm or long arm.')
})

test('rejects non-YouTube and insecure tutorial links', () => {
  assert.equal(validateFirearmMetadata({ firearmType: 'long_arm', tutorialUrl: 'http://youtube.com/watch?v=example' }), 'Enter a valid HTTPS YouTube video link.')
  assert.equal(validateFirearmMetadata({ firearmType: 'long_arm', tutorialUrl: 'https://example.com/video' }), 'Enter a valid HTTPS YouTube video link.')
})

test('normalizes optional model credits and limits their length', () => {
  assert.equal(normalizeModelCredit('  Jane   Doe / Example Studio  '), 'Jane Doe / Example Studio')
  assert.equal(modelCreditHref('https://example.com/model'), 'https://example.com/model')
  assert.equal(modelCreditHref('Example Studio'), '')
  assert.equal(validateFirearmMetadata({ firearmType: 'short_arm', modelCredit: 'a'.repeat(301), tutorialUrl: '' }), 'Keep the model source or credits within 300 characters.')
})
