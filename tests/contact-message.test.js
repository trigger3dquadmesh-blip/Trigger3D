import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMailtoUrl, sendContactMessage } from '../src/features/contact/contact-message.js'

const message = { name: 'Ana', email: 'ana@example.com', subject: 'Hello', message: 'Question about Trigger3D', botcheck: false }

function fakeFetch(response) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    if (response instanceof Error) throw response
    return { ok: response.ok ?? true, json: async () => response.body }
  }
  return { fetchImpl, calls }
}

test('sends the message to Web3Forms with the access key', async () => {
  const { fetchImpl, calls } = fakeFetch({ body: { success: true } })
  const result = await sendContactMessage(message, { accessKey: 'key-123', fetchImpl })
  assert.deepEqual(result, { status: 'sent' })
  assert.equal(calls[0].url, 'https://api.web3forms.com/submit')
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.access_key, 'key-123')
  assert.equal(body.name, 'Ana')
  assert.equal(body.email, 'ana@example.com')
  assert.equal(body.subject, 'Hello')
  assert.equal(body.message, 'Question about Trigger3D')
})

test('reports a failure when Web3Forms rejects the message', async () => {
  const { fetchImpl } = fakeFetch({ ok: false, body: { success: false, message: 'Invalid access key' } })
  const result = await sendContactMessage(message, { accessKey: 'bad', fetchImpl })
  assert.equal(result.status, 'failed')
})

test('reports a failure when the network is down', async () => {
  const { fetchImpl } = fakeFetch(new TypeError('Failed to fetch'))
  const result = await sendContactMessage(message, { accessKey: 'key-123', fetchImpl })
  assert.equal(result.status, 'failed')
})

test('falls back to the email app when no access key is configured', async () => {
  const { fetchImpl, calls } = fakeFetch({ body: { success: true } })
  const result = await sendContactMessage(message, { accessKey: '', fetchImpl })
  assert.equal(result.status, 'no-service')
  assert.equal(calls.length, 0)
})

test('quietly drops spam-bot submissions without sending', async () => {
  const { fetchImpl, calls } = fakeFetch({ body: { success: true } })
  const result = await sendContactMessage({ ...message, botcheck: true }, { accessKey: 'key-123', fetchImpl })
  assert.equal(result.status, 'sent')
  assert.equal(calls.length, 0)
})

test('the email-app fallback keeps the sender name and reply address', () => {
  const url = buildMailtoUrl('team@example.com', message)
  assert.ok(url.startsWith('mailto:team@example.com?subject=Hello'))
  const body = decodeURIComponent(url.split('body=')[1])
  assert.match(body, /From: Ana/)
  assert.match(body, /Reply to: ana@example.com/)
})
