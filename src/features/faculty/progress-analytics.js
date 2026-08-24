const SCORE_BANDS = [
  { label: '0–24%', minimum: 0, maximum: 24 },
  { label: '25–49%', minimum: 25, maximum: 49 },
  { label: '50–74%', minimum: 50, maximum: 74 },
  { label: '75–100%', minimum: 75, maximum: 100 },
]

export function buildProgressAnalytics(attempts, questionAnalytics) {
  const answerTotals = questionAnalytics
    .flatMap((firearm) => firearm.questions)
    .reduce((totals, question) => ({
      correct: totals.correct + question.correct_count,
      incorrect: totals.incorrect + question.incorrect_count,
    }), { correct: 0, incorrect: 0 })

  const totalAnswers = answerTotals.correct + answerTotals.incorrect
  const averageScore = attempts.length
    ? attempts.reduce((total, attempt) => total + Number(attempt.percentage || 0), 0) / attempts.length
    : 0

  return {
    averageScore,
    answerSummary: [
      { color: '#36c98b', label: 'Correct answers', value: answerTotals.correct },
      { color: '#d75a62', label: 'Incorrect answers', value: answerTotals.incorrect },
    ],
    scoreDistribution: SCORE_BANDS.map((band, index) => ({
      color: ['#5cc8ff', '#8274e8', '#f0ad4e', '#36c98b'][index],
      label: band.label,
      value: attempts.filter((attempt) => {
        const score = Number(attempt.percentage || 0)
        return score >= band.minimum && score <= band.maximum
      }).length,
    })),
    totalAnswers,
    totalAttempts: attempts.length,
  }
}
