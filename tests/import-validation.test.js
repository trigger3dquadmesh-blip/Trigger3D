import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  parseCsv,
  validateComponentLayout,
  validateGunBundle,
} from '../src/features/admin/import/validation.js'

const gunFolder = fileURLToPath(new URL('../content/gun_a/', import.meta.url))

function textFile(name, content) {
  return {
    name,
    text: async () => content,
  }
}

function binaryFile(name, buffer) {
  return {
    name,
    arrayBuffer: async () => buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
  }
}

test('validates the real gun_a three-file bundle', async () => {
  const [glb, components, questions] = await Promise.all([
    readFile(`${gunFolder}gun_a.glb`),
    readFile(`${gunFolder}gun_a_components.csv`, 'utf8'),
    readFile(`${gunFolder}gun_a_questions.csv`, 'utf8'),
  ])

  const result = await validateGunBundle({
    glbFile: binaryFile('gun_a.glb', glb),
    componentsFile: textFile('gun_a_components.csv', components),
    questionsFile: textFile('gun_a_questions.csv', questions),
  })

  assert.deepEqual(result.errors, [])
  assert.equal(result.data.identifier, 'gun_a')
  assert.equal(result.data.meshNames.length, 25)
  assert.equal(result.data.components.length, 25)
  assert.equal(result.data.questions.length, 25)
  assert.deepEqual(
    result.data.components.find((component) => component.component_name === 'Frame'),
    {
      component_name: 'Frame',
      category: 'external',
      purpose: 'Supports the main firearm assemblies',
      description: 'The primary structural body to which major components are attached. This description is provisional and requires gunsmith verification.',
      display_order: 11,
      explode_x: 0,
      explode_y: 0,
      explode_z: 0,
      explode_order: 0,
      assembly_group: 'frame',
    },
  )
})

test('validates a component-only layout update for an existing firearm', async () => {
  const components = await readFile(`${gunFolder}gun_a_components.csv`, 'utf8')
  const expectedNames = parseCsv(components).records.map((component) => component.component_name)
  const result = await validateComponentLayout({
    componentsFile: textFile('gun_a_components.csv', components),
    identifier: 'gun_a',
    expectedNames,
  })

  assert.deepEqual(result.errors, [])
  assert.equal(result.data.components.length, 25)
  assert.equal(result.data.components[0].explode_y, 1.6)
  assert.equal(result.data.components[0].assembly_group, 'upper_assembly')
})

test('rejects a blank explosion offset', async () => {
  const components = await readFile(`${gunFolder}gun_a_components.csv`, 'utf8')
  const invalidComponents = components.replace(',0,1.6,0,1,upper_assembly', ',,1.6,0,1,upper_assembly')
  const expectedNames = parseCsv(components).records.map((component) => component.component_name)
  const result = await validateComponentLayout({
    componentsFile: textFile('gun_a_components.csv', invalidComponents),
    identifier: 'gun_a',
    expectedNames,
  })

  assert.ok(result.errors.some((message) => message.includes('invalid explosion offset')))
})

test('rejects mismatched bundle filenames', async () => {
  const result = await validateGunBundle({
    glbFile: { name: 'gun_a.glb', arrayBuffer: async () => new ArrayBuffer(0) },
    componentsFile: textFile('gun_b_components.csv', 'component_name'),
    questionsFile: textFile('gun_a_questions.csv', 'question_id'),
  })

  assert.ok(result.errors.some((message) => message.includes('gun_a_components.csv')))
})
