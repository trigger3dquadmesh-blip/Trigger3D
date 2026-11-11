import { assessmentAttemptIsSubmitted } from '../shared/current-assessment-attempts.js'

function csvCell(value) {
  let text = String(value ?? '')

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`

  return /[",\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text
}

function displayName(student) {
  const name = student?.full_name?.trim()
  return name || 'Name not provided'
}

function surnameForSort(name) {
  if (name === 'Name not provided') return ''
  return name.trim().split(/\s+/).at(-1) || ''
}

function compareStudents(left, right) {
  const surnameComparison = surnameForSort(left.studentName).localeCompare(
    surnameForSort(right.studentName),
    undefined,
    { sensitivity: 'base' },
  )

  return surnameComparison
    || left.studentName.localeCompare(right.studentName, undefined, { sensitivity: 'base' })
    || left.studentEmail.localeCompare(right.studentEmail, undefined, { sensitivity: 'base' })
}

function assessmentLabel(firearm) {
  if (!firearm) return 'Assessment'
  return firearm.caliber ? `${firearm.name} (${firearm.caliber})` : firearm.name
}

function scoreLabel(value) {
  if (value.score == null) return value.label

  const percentage = `${Number(value.score).toFixed(1)}%`
  const correctCount = Number(value.correctCount)
  const totalQuestions = Number(value.totalQuestions)

  if (
    Number.isFinite(correctCount)
    && correctCount >= 0
    && Number.isFinite(totalQuestions)
    && totalQuestions > 0
  ) {
    return `${correctCount}/${totalQuestions} (${percentage})`
  }

  return percentage
}

function assessmentStatus(attempt, release) {
  if (assessmentAttemptIsSubmitted(attempt)) {
    return {
      label: 'Submitted',
      score: attempt.percentage,
      correctCount: attempt.correctCount,
      totalQuestions: attempt.totalQuestions,
    }
  }
  if (!release?.is_open) return { label: 'Closed', score: null }
  if (attempt?.status === 'in_progress' && attempt.has_activity) {
    return { label: 'In progress', score: null }
  }
  return { label: 'Not submitted', score: null }
}

export function gradebookFilename(selectedClass, extension) {
  const identifier = (selectedClass?.code || selectedClass?.name || 'class_gradebook')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

  return `${identifier || 'class_gradebook'}_gradebook.${extension}`
}

export function buildGradebookData({
  attempts = [],
  enrollments = [],
  firearms = [],
  facultyName = '',
  releases = [],
  selectedClass,
}) {
  const firearmById = new Map(firearms.map((firearm) => [firearm.id, firearm]))
  const releaseByFirearmId = new Map(releases.map((release) => [release.firearm_id, release]))
  const assessmentIds = new Set([
    ...releases.map((release) => release.firearm_id),
    ...attempts.map((attempt) => attempt.firearm_id),
  ])
  const assessments = [...assessmentIds]
    .map((firearmId) => ({
      firearmId,
      label: assessmentLabel(firearmById.get(firearmId)),
      sortName: firearmById.get(firearmId)?.name || 'Assessment',
    }))
    .sort((left, right) => left.sortName.localeCompare(right.sortName, undefined, { sensitivity: 'base' }))

  const attemptByStudentAndFirearm = new Map(
    attempts.map((attempt) => [`${attempt.student_id}:${attempt.firearm_id}`, attempt]),
  )

  const students = enrollments
    .filter((enrollment) => enrollment.status === 'active')
    .map((enrollment) => {
      const studentName = displayName(enrollment.student)
      const studentEmail = enrollment.student?.email || ''

      return {
        studentEmail,
        studentName,
        values: assessments.map((assessment) => assessmentStatus(
          attemptByStudentAndFirearm.get(`${enrollment.student_id}:${assessment.firearmId}`),
          releaseByFirearmId.get(assessment.firearmId),
        )),
      }
    })
    .sort(compareStudents)

  return {
    assessments,
    classCode: selectedClass?.code || '',
    className: selectedClass?.name || 'Class gradebook',
    facultyName,
    generatedAt: new Date(),
    students,
  }
}

export function createGradebookCsv(gradebook) {
  const headers = ['Student name', 'Student email', ...gradebook.assessments.map((assessment) => assessment.label)]
  const records = gradebook.students.map((student) => [
    student.studentName,
    student.studentEmail,
    ...student.values.map(scoreLabel),
  ].map(csvCell).join(','))

  return `\uFEFF${[headers.map(csvCell).join(','), ...records].join('\r\n')}\r\n`
}

export async function createGradebookWorkbook(gradebook) {
  const excelModule = await import('exceljs')
  const ExcelJS = excelModule.default || excelModule
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Trigger3D'
  workbook.created = gradebook.generatedAt

  const worksheet = workbook.addWorksheet('Gradebook', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 10 }],
  })
  const headers = ['Student name', 'Student email', ...gradebook.assessments.map((assessment) => assessment.label)]
  const lastColumn = headers.length
  const tableHeaderRow = 10
  const tableStartRow = tableHeaderRow + 1
  const colors = {
    border: 'FFD5DEE6',
    lightTeal: 'FFEAF5F1',
    muted: 'FF64748B',
    navy: 'FF163B53',
    navyLight: 'FFEAF0F4',
    rowAlt: 'FFF6F8FA',
    teal: 'FF157A6E',
    warning: 'FFFFF4D6',
  }
  const thinBorder = {
    bottom: { color: { argb: colors.border }, style: 'thin' },
    left: { color: { argb: colors.border }, style: 'thin' },
    right: { color: { argb: colors.border }, style: 'thin' },
    top: { color: { argb: colors.border }, style: 'thin' },
  }

  worksheet.properties.defaultRowHeight = 20

  worksheet.mergeCells(1, 1, 1, lastColumn)
  const title = worksheet.getCell('A1')
  title.value = 'Trigger3D Gradebook'
  title.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Aptos Display', size: 18 }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } }
  title.alignment = { vertical: 'middle' }
  worksheet.getRow(1).height = 32

  worksheet.mergeCells(2, 1, 2, lastColumn)
  const subtitle = worksheet.getCell('A2')
  subtitle.value = 'Assessment results and progress record'
  subtitle.font = { color: { argb: colors.muted }, italic: true, size: 11 }
  subtitle.alignment = { vertical: 'middle' }

  worksheet.mergeCells(4, 1, 4, lastColumn)
  const detailsHeading = worksheet.getCell('A4')
  detailsHeading.value = 'CLASS DETAILS'
  detailsHeading.font = { bold: true, color: { argb: colors.teal }, size: 10 }

  const details = [
    ['Class / section', gradebook.classCode ? `${gradebook.className} (${gradebook.classCode})` : gradebook.className],
    ['Faculty', gradebook.facultyName || 'Not provided'],
    ['Exported', gradebook.generatedAt.toLocaleString()],
  ]

  details.forEach(([label, value], index) => {
    const rowNumber = index + 5
    worksheet.getCell(rowNumber, 1).value = label
    worksheet.getCell(rowNumber, 1).font = { bold: true, color: { argb: colors.navy } }
    worksheet.getCell(rowNumber, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navyLight } }
    worksheet.getCell(rowNumber, 1).border = thinBorder

    worksheet.mergeCells(rowNumber, 2, rowNumber, lastColumn)
    const valueCell = worksheet.getCell(rowNumber, 2)
    valueCell.value = value
    valueCell.font = { color: { argb: 'FF1E293B' } }
    valueCell.border = thinBorder
    valueCell.alignment = { vertical: 'middle' }
  })

  worksheet.mergeCells(9, 1, 9, lastColumn)
  const resultsHeading = worksheet.getCell('A9')
  resultsHeading.value = 'ASSESSMENT RESULTS'
  resultsHeading.font = { bold: true, color: { argb: colors.teal }, size: 10 }

  const headerRow = worksheet.getRow(tableHeaderRow)
  headerRow.values = headers
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } }
  headerRow.alignment = { vertical: 'middle', wrapText: true }
  headerRow.height = 34
  headerRow.eachCell((cell) => {
    cell.border = thinBorder
  })

  gradebook.students.forEach((student, studentIndex) => {
    const row = worksheet.addRow([
      student.studentName,
      student.studentEmail,
      ...student.values.map(scoreLabel),
    ])
    row.alignment = { vertical: 'middle', wrapText: true }
    row.height = 26
    row.eachCell((cell) => {
      cell.border = thinBorder
    })
    row.getCell(1).font = { bold: true, color: { argb: 'FF1E293B' } }
    row.getCell(2).font = { color: { argb: colors.muted } }
    if (studentIndex % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.rowAlt } }
    }
    student.values.forEach((value, index) => {
      const cell = row.getCell(index + 3)
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      if (value.score != null) {
        cell.font = { bold: true, color: { argb: colors.teal } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.lightTeal } }
      } else if (value.label === 'In progress') {
        cell.font = { bold: true, color: { argb: 'FF9A6700' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.warning } }
      } else {
        cell.font = { color: { argb: colors.muted }, italic: true }
      }
    })
  })

  worksheet.autoFilter = {
    from: { column: 1, row: tableHeaderRow },
    to: { column: lastColumn, row: Math.max(tableStartRow, tableStartRow + gradebook.students.length - 1) },
  }

  worksheet.columns.forEach((column, index) => {
    column.width = index === 0 ? 28 : index === 1 ? 34 : 24
  })
  worksheet.pageSetup = { fitToHeight: 0, fitToPage: true, fitToWidth: 1, orientation: 'landscape' }

  return workbook.xlsx.writeBuffer()
}
