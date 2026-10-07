const bundledComponentSources = {
  gun_a: {
    count: 25,
    url: '/models/gun_a_components.csv',
  },
}

const componentCache = new Map()

function getBundledFirearmKey(identifier, name = '') {
  const normalizedIdentifier = String(identifier || '').trim().toLowerCase()
  const normalizedName = String(name || '').trim().toLowerCase()
  if (bundledComponentSources[normalizedIdentifier]) return normalizedIdentifier
  if (normalizedName.includes('m1911')) return 'gun_a'
  return ''
}

function parseBundledComponents(identifier, csv) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/)
  const headers = headerLine.split(',')

  return lines.filter(Boolean).map((line, index) => {
    const values = line.split(',')
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] || '']))
    return {
      id: `bundled-${identifier}-${index + 1}`,
      mesh_name: row.component_name,
      category: row.category,
      purpose: row.purpose,
      description: row.description,
      display_order: Number(row.display_order) || index + 1,
      explode_x: Number(row.explode_x) || 0,
      explode_y: Number(row.explode_y) || 0,
      explode_z: Number(row.explode_z) || 0,
      explode_order: Number(row.explode_order) || 0,
      assembly_group: row.assembly_group || row.category || 'Components',
    }
  })
}

export function getBundledFirearmComponentCount(identifier, name = '') {
  return bundledComponentSources[getBundledFirearmKey(identifier, name)]?.count || 0
}

export async function getBundledFirearmComponents(identifier, name = '') {
  const normalizedIdentifier = getBundledFirearmKey(identifier, name)
  const source = bundledComponentSources[normalizedIdentifier]
  if (!source) return []
  if (componentCache.has(normalizedIdentifier)) return componentCache.get(normalizedIdentifier)

  const request = fetch(source.url)
    .then((response) => {
      if (!response.ok) throw new Error('The bundled component details could not be loaded.')
      return response.text()
    })
    .then((csv) => parseBundledComponents(normalizedIdentifier, csv))
    .catch((error) => {
      componentCache.delete(normalizedIdentifier)
      throw error
    })

  componentCache.set(normalizedIdentifier, request)
  return request
}
