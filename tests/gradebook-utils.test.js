import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGradebookData,
  createGradebookCsv,
  createGradebookWorkbook,
  gradebookFilename,
} from '../src/features/faculty/gradebook-utils.js'

const gradebook = buildGradebookData({
  attempts: [
    {
      student_id: 'student-1',
      firearm_id: 'firearm-1',
      status: 'submitted',
      percentage: 86.5,
      correctCount: 39,
      totalQuestions: 45,
    },
    {
      student_id: 'student-2', firearm_id: 'firearm-1', status: 'in_progress', has_activity: true,
    },
  ],
  enrollments: [
    { student_id: 'student-1', status: 'active', student: { full_name: 'Zoe Santos', email: 'zoe@parsu.edu.ph' } },
    { student_id: 'student-2', status: 'active', student: { full_name: 'Arian Agdoro', email: 'arian@parsu.edu.ph' } },
    { student_id: 'student-3', status: 'removed', student: { full_name: 'Removed Student', email: 'removed@parsu.edu.ph' } },
  ],
  firearms: [{ id: 'firearm-1', name: 'Generic M1911 A2 Pattern', caliber: '.45' }],
  releases: [{ firearm_id: 'firearm-1', is_open: true }],
  selectedClass: { code: 'BSCRIM-4A', name: 'BSCRIM - 4A' },
})

test('builds one normalized, surname-sorted gradebook for active enrolled students', () => {
  assert.equal(gradebook.assessments.length, 1)
  assert.deepEqual(gradebook.students.map((student) => student.studentName), ['Arian Agdoro', 'Zoe Santos'])
  assert.equal(gradebook.students[0].values[0].label, 'In progress')
  assert.equal(gradebook.students[1].values[0].score, 86.5)
  assert.equal(gradebook.students[1].values[0].correctCount, 39)
  assert.equal(gradebook.students[1].values[0].totalQuestions, 45)
})

test('creates UTF-8 CSV with clear missing-grade states and safe cells', () => {
  const csv = createGradebookCsv({
    ...gradebook,
    students: [{ ...gradebook.students[0], studentName: '=formula' }, ...gradebook.students.slice(1)],
  })

  assert.ok(csv.startsWith('\uFEFFStudent name,Student email'))
  assert.match(csv, /'=formula/)
  assert.match(csv, /In progress/)
  assert.match(csv, /39\/45 \(86\.5%\)/)
})

test('uses a safe, meaningful class filename', () => {
  assert.equal(gradebookFilename({ code: 'BSCRIM - 4A' }, 'xlsx'), 'bscrim_4a_gradebook.xlsx')
})

test('creates an Excel workbook from the same normalized gradebook data', async () => {
  const workbook = await createGradebookWorkbook({ ...gradebook, facultyName: 'Kristine Fuentebella' })
  const bytes = new Uint8Array(workbook)

  assert.ok(bytes.byteLength > 100)
  assert.deepEqual([...bytes.slice(0, 2)], [80, 75])

  const excelModule = await import('exceljs')
  const ExcelJS = excelModule.default || excelModule
  const parsedWorkbook = new ExcelJS.Workbook()
  await parsedWorkbook.xlsx.load(workbook)
  const sheet = parsedWorkbook.getWorksheet('Gradebook')

  assert.equal(sheet.getCell('A1').value, 'Trigger3D Gradebook')
  assert.equal(sheet.getCell('A2').value, 'Assessment results and progress record')
  assert.equal(sheet.getCell('A5').value, 'Class / section')
  assert.equal(sheet.getCell('B5').value, 'BSCRIM - 4A (BSCRIM-4A)')
  assert.equal(sheet.getCell('A10').value, 'Student name')
  assert.equal(sheet.getCell('C10').value, 'Generic M1911 A2 Pattern (.45)')
  assert.equal(sheet.getCell('C12').value, '39/45 (86.5%)')
  assert.match(String(sheet.autoFilter), /A10/)
})
