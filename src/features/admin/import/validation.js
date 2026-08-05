const COMPONENT_HEADERS = [
  'component_name',
  'category',
  'purpose',
  'description',
  'display_order',
  'explode_x',
  'explode_y',
  'explode_z',
  'explode_order',
  'assembly_group',
]

const QUESTION_HEADERS = [
  'question_id',
  'question_type',
  'prompt',
  'component_name',
  'image_file',
  'accepted_answers',
]

function sameHeaders(actual, expected) {
  return actual.length === expected.length
    && actual.every((header, index) => header === expected[index])
}

export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"' && quoted && nextCharacter === '"') {
      field += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      row.push(field)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field.')

  row.push(field)
  if (row.some((value) => value.trim() !== '')) rows.push(row)

  if (rows.length === 0) throw new Error('CSV is empty.')

  const headers = rows[0].map((value) => value.trim().replace(/^\uFEFF/, ''))
  const records = rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${rowIndex + 2} has ${values.length} columns; expected ${headers.length}.`,
      )
    }

    return Object.fromEntries(
      headers.map((header, columnIndex) => [header, values[columnIndex].trim()]),
    )
  })

  return { headers, records }
}

export function extractGlbComponentNames(arrayBuffer) {
  const view = new DataView(arrayBuffer)

  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) {
    throw new Error('The selected model is not a valid GLB file.')
  }

  if (view.getUint32(4, true) !== 2) {
    throw new Error('Only GLB version 2 files are supported.')
  }

  if (view.getUint32(8, true) !== view.byteLength) {
    throw new Error('The GLB declared size does not match the uploaded file.')
  }

  let offset = 12
  let gltfJson = null

  while (offset + 8 <= view.byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + chunkLength

    if (chunkEnd > view.byteLength) throw new Error('The GLB contains an invalid chunk.')

    if (chunkType === 0x4e4f534a) {
      const bytes = new Uint8Array(arrayBuffer, chunkStart, chunkLength)
      gltfJson = JSON.parse(new TextDecoder().decode(bytes).trim())
      break
    }

    offset = chunkEnd
  }

  if (!gltfJson) throw new Error('The GLB does not contain a JSON scene description.')

  return (gltfJson.nodes || [])
    .filter((node) => node.mesh !== undefined)
    .map((node) => (node.name || '').trim())
}

function findDuplicates(values) {
  const seen = new Set()
  const duplicates = new Set()

  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  })

  return [...duplicates]
}

function fileIdentifier(fileName, suffix) {
  return fileName.toLowerCase().endsWith(suffix)
    ? fileName.slice(0, -suffix.length)
    : null
}

function validateComponents(componentCsv, expectedNames = []) {
  const errors = []

  if (!sameHeaders(componentCsv.headers, COMPONENT_HEADERS)) {
    errors.push(`Component CSV headers must be: ${COMPONENT_HEADERS.join(',')}.`)
  }

  const components = componentCsv.records
  const componentNames = components.map((row) => row.component_name)

  if (components.length === 0) errors.push('The component CSV contains no component rows.')

  const duplicateComponents = findDuplicates(componentNames)
  if (duplicateComponents.length) {
    errors.push(`Duplicate component names: ${duplicateComponents.join(', ')}.`)
  }

  components.forEach((component, index) => {
    const rowNumber = index + 2
    const displayOrder = Number(component.display_order)
    const explodeOrder = Number(component.explode_order)
    const offsets = [component.explode_x, component.explode_y, component.explode_z]

    if (!component.component_name || !component.purpose || !component.description
      || !component.assembly_group) {
      errors.push(`Component CSV row ${rowNumber} has a blank required field.`)
    }
    if (!['external', 'internal'].includes(component.category)) {
      errors.push(`Component CSV row ${rowNumber} has an invalid category.`)
    }
    if (!Number.isInteger(displayOrder) || displayOrder < 1) {
      errors.push(`Component CSV row ${rowNumber} has an invalid display_order.`)
    }
    if (offsets.some((value) => value === '' || !Number.isFinite(Number(value)))) {
      errors.push(`Component CSV row ${rowNumber} has an invalid explosion offset.`)
    }
    if (!Number.isInteger(explodeOrder) || explodeOrder < 0) {
      errors.push(`Component CSV row ${rowNumber} has an invalid explode_order.`)
    }
    if (component.assembly_group && !/^[a-z0-9_]+$/.test(component.assembly_group)) {
      errors.push(`Component CSV row ${rowNumber} has an invalid assembly_group.`)
    }
  })

  const duplicateOrders = findDuplicates(components.map((row) => row.display_order))
  if (duplicateOrders.length) errors.push('Component display_order values must be unique.')

  if (expectedNames.length > 0) {
    const componentNameSet = new Set(componentNames)
    const expectedNameSet = new Set(expectedNames)
    const missingMetadata = expectedNames.filter((name) => !componentNameSet.has(name))
    const unknownComponents = componentNames.filter((name) => !expectedNameSet.has(name))

    if (missingMetadata.length) {
      errors.push(`Components missing metadata: ${missingMetadata.join(', ')}.`)
    }
    if (unknownComponents.length) {
      errors.push(`Metadata contains unknown components: ${unknownComponents.join(', ')}.`)
    }
  }

  return {
    errors,
    components: components.map((component) => ({
      ...component,
      display_order: Number(component.display_order),
      explode_x: Number(component.explode_x),
      explode_y: Number(component.explode_y),
      explode_z: Number(component.explode_z),
      explode_order: Number(component.explode_order),
    })),
  }
}

export async function validateComponentLayout({ componentsFile, identifier, expectedNames }) {
  if (!componentsFile) return { errors: ['Select a component CSV file.'], data: null }

  const errors = []
  if (componentsFile.name !== `${identifier}_components.csv`) {
    errors.push(`The component file must be named ${identifier}_components.csv.`)
  }

  let componentCsv
  try {
    componentCsv = parseCsv(await componentsFile.text())
  } catch (error) {
    return { errors: [...errors, `Component CSV: ${error.message}`], data: null }
  }

  const validation = validateComponents(componentCsv, expectedNames)
  errors.push(...validation.errors)

  return errors.length > 0
    ? { errors, data: null }
    : { errors: [], data: { identifier, components: validation.components } }
}

export async function validateGunBundle({ glbFile, componentsFile, questionsFile }) {
  const errors = []

  if (!glbFile || !componentsFile || !questionsFile) {
    return { errors: ['Select one GLB and both CSV files.'], data: null }
  }

  const identifier = fileIdentifier(glbFile.name, '.glb')

  if (!identifier || !/^gun_[a-z0-9]+$/.test(identifier)) {
    errors.push('The GLB filename must use the gun_a.glb naming format.')
  }

  if (identifier && componentsFile.name !== `${identifier}_components.csv`) {
    errors.push(`The component file must be named ${identifier}_components.csv.`)
  }

  if (identifier && questionsFile.name !== `${identifier}_questions.csv`) {
    errors.push(`The question file must be named ${identifier}_questions.csv.`)
  }

  let componentCsv
  let questionCsv
  let meshNames = []

  try {
    componentCsv = parseCsv(await componentsFile.text())
  } catch (error) {
    errors.push(`Component CSV: ${error.message}`)
  }

  try {
    questionCsv = parseCsv(await questionsFile.text())
  } catch (error) {
    errors.push(`Question CSV: ${error.message}`)
  }

  try {
    meshNames = extractGlbComponentNames(await glbFile.arrayBuffer())
  } catch (error) {
    errors.push(`GLB: ${error.message}`)
  }

  if (questionCsv && !sameHeaders(questionCsv.headers, QUESTION_HEADERS)) {
    errors.push(`Question CSV headers must be: ${QUESTION_HEADERS.join(',')}.`)
  }

  const componentValidation = componentCsv
    ? validateComponents(componentCsv, meshNames)
    : { errors: [], components: [] }
  errors.push(...componentValidation.errors)

  const components = componentValidation.components
  const questions = questionCsv?.records || []
  const componentNames = components.map((row) => row.component_name)
  const componentNameSet = new Set(componentNames)

  if (meshNames.length === 0) errors.push('The GLB does not contain any named mesh nodes.')
  if (questions.length === 0) errors.push('The question CSV contains no question rows.')

  if (meshNames.some((name) => !name)) errors.push('Every GLB mesh node must have a name.')

  const duplicateMeshes = findDuplicates(meshNames)
  if (duplicateMeshes.length) {
    errors.push(`Duplicate GLB mesh names: ${duplicateMeshes.join(', ')}.`)
  }

  const questionIds = questions.map((row) => row.question_id)
  const duplicateQuestionIds = findDuplicates(questionIds)
  if (duplicateQuestionIds.length) {
    errors.push(`Duplicate question IDs: ${duplicateQuestionIds.join(', ')}.`)
  }

  questions.forEach((question, index) => {
    const rowNumber = index + 2
    const acceptedAnswers = question.accepted_answers
      .split('|')
      .map((answer) => answer.trim())
      .filter(Boolean)

    if (!question.question_id || !question.prompt || !question.component_name) {
      errors.push(`Question CSV row ${rowNumber} has a blank required field.`)
    }
    if (!['text_identification', 'image_identification'].includes(question.question_type)) {
      errors.push(`Question CSV row ${rowNumber} has an unsupported question_type.`)
    }
    if (question.question_type === 'text_identification' && question.image_file) {
      errors.push(`Question CSV row ${rowNumber} must leave image_file blank.`)
    }
    if (question.question_type === 'image_identification' && !question.image_file) {
      errors.push(`Question CSV row ${rowNumber} requires an image_file.`)
    }
    if (!componentNameSet.has(question.component_name)) {
      errors.push(`Question CSV row ${rowNumber} references an unknown component.`)
    }
    if (acceptedAnswers.length === 0) {
      errors.push(`Question CSV row ${rowNumber} requires an accepted answer.`)
    }
  })

  if (errors.length > 0) return { errors, data: null }

  return {
    errors: [],
    data: {
      identifier,
      meshNames,
      components,
      questions: questions.map((question) => ({
        ...question,
        image_file: question.image_file || null,
        accepted_answers: question.accepted_answers
          .split('|')
          .map((answer) => answer.trim())
          .filter(Boolean),
      })),
    },
  }
}
