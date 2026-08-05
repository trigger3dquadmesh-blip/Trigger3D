const scoreBands = [
  { label: '0–24%', minimum: 0, maximum: 24.999 },
  { label: '25–49%', minimum: 25, maximum: 49.999 },
  { label: '50–74%', minimum: 50, maximum: 74.999 },
  { label: '75–100%', minimum: 75, maximum: 100 },
]

export function summarizePerformance(percentages) {
  const validScores = percentages
    .filter((score) => score !== null && score !== undefined && score !== '')
    .map(Number)
    .filter((score) => Number.isFinite(score) && score >= 0 && score <= 100)

  const average = validScores.length
    ? validScores.reduce((total, score) => total + score, 0) / validScores.length
    : null

  return {
    average,
    bands: scoreBands.map((band) => ({
      label: band.label,
      count: validScores.filter(
        (score) => score >= band.minimum && score <= band.maximum,
      ).length,
    })),
    total: validScores.length,
  }
}
