export type ScoreItem = {
  type: 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
  score: number;
  rank?: number;
};

export function rankScores(scores: ScoreItem[]): ScoreItem[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  let currentRank = 0;
  let lastScore: number | null = null;

  return sorted.map((item, index) => {
    if (item.score !== lastScore) {
      currentRank = index + 1;
      lastScore = item.score;
    }

    return {
      ...item,
      rank: currentRank,
    };
  });
}
