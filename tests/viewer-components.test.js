import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveViewerComponents } from '../src/features/shared/viewer-components.js'

test('loads component descriptions and functions from accessible database rows', async () => {
  const rows = [{ mesh_name: 'Slide', description: 'Component description', purpose: 'Component function' }]
  assert.deepEqual(await resolveViewerComponents({ data: rows }, () => assert.fail('Unexpected fallback')), rows)
})

test('does not conceal component query failures with bundled data', async () => {
  await assert.rejects(resolveViewerComponents({ error: { message: 'Access denied' } }, () => assert.fail('Unexpected fallback')), /could not be loaded/)
})

test('offers retry instead of displaying a model with an empty component panel', async () => {
  await assert.rejects(resolveViewerComponents({ data: [] }, async () => []), /Component details are unavailable/)
  await assert.rejects(resolveViewerComponents({ data: [{ mesh_name: ' ' }] }, async () => []), /Component details are unavailable/)
})

test('uses bundled component metadata when no database rows are returned', async () => {
  const rows = [{ mesh_name: 'Slide', purpose: 'Component function' }]
  assert.deepEqual(await resolveViewerComponents({ data: [] }, async () => rows), rows)
})
