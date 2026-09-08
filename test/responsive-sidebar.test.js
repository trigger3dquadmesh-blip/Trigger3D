import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldCollapseSidebar } from '../src/components/useResponsiveSidebar.js'

function matchAt(width) {
  return (query) => ({
    matches: query === '(max-width: 760px), (min-width: 1025px)'
      && (width <= 760 || width >= 1025),
  })
}

test('starts the mobile sidebar closed', () => {
  assert.equal(shouldCollapseSidebar(matchAt(390)), true)
})

test('starts the tablet sidebar open', () => {
  assert.equal(shouldCollapseSidebar(matchAt(768)), false)
  assert.equal(shouldCollapseSidebar(matchAt(1024)), false)
})

test('starts the desktop sidebar as the hoverable icon rail', () => {
  assert.equal(shouldCollapseSidebar(matchAt(1025)), true)
  assert.equal(shouldCollapseSidebar(matchAt(1920)), true)
})
