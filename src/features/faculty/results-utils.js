function csvCell(value) {
  let text = String(value ?? '')

  // Prevent spreadsheet applications from interpreting user-controlled text as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`

  return /[",\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text
}

export function groupAssessmentResults(rows) {
  const attempts = new Map()

  rows.forEach((row) => {
    if (!attempts.has(row.attempt_id)) {
      attempts.set(row.attempt_id, {
        attempt_id: row.attempt_id,
        student_name: row.student_name === row.student_email
          ? 'Name not provided'
          : row.student_name,
        student_email: row.student_email,
        firearm_name: row.firearm_name,
        firearm_caliber: row.firearm_caliber,
        correct_count: row.correct_count,
        total_questions: row.total_questions,
        percentage: row.percentage,
        submitted_at: row.submitted_at,
        questions: [],
      })
    }

    attempts.get(row.attempt_id).questions.push({
      question_id: row.question_id,
      prompt: row.prompt,
      component_name: row.component_name,
      student_answer: row.student_answer,
      is_correct: row.is_correct,
    })
  })

  return [...attempts.values()]
}

export function aggregateQuestionResults(rows) {
  const firearms = new Map()

  rows.forEach((row) => {
    const firearmKey = row.firearm_id || `${row.firearm_name}:${row.firearm_caliber}`
    if (!firearms.has(firearmKey)) {
      firearms.set(firearmKey, {
        firearm_id: row.firearm_id,
        firearm_name: row.firearm_name,
        firearm_caliber: row.firearm_caliber,
        questions: new Map(),
      })
    }

    const firearm = firearms.get(firearmKey)
    if (!firearm.questions.has(row.question_id)) {
      firearm.questions.set(row.question_id, {
        question_id: row.question_id,
        prompt: row.prompt,
        component_name: row.component_name,
        correct_count: 0,
        incorrect_count: 0,
        response_count: 0,
      })
    }

    const question = firearm.questions.get(row.question_id)
    question.response_count += 1
    if (row.is_correct) question.correct_count += 1
    else question.incorrect_count += 1
  })

  return [...firearms.values()].map((firearm) => ({
    ...firearm,
    questions: [...firearm.questions.values()]
      .map((question) => ({
        ...question,
        accuracy: question.response_count
          ? (question.correct_count / question.response_count) * 100
          : 0,
      }))
      .sort((left, right) => left.question_id.localeCompare(right.question_id, undefined, {
        numeric: true,
      })),
  }))
}

export function createAssessmentResultsCsv(rows) {
  const headers = [
    'student_name',
    'student_email',
    'firearm_name',
    'firearm_caliber',
    'correct_count',
    'total_questions',
    'percentage',
    'submitted_at',
    'question_id',
    'prompt',
    'component_name',
    'student_answer',
    'is_correct',
  ]

  const records = rows.map((row) => headers.map((header) => {
    const value = header === 'student_name' && row.student_name === row.student_email
      ? 'Name not provided'
      : row[header]
    return csvCell(value)
  }).join(','))
  return [headers.join(','), ...records].join('\r\n') + '\r\n'
}
