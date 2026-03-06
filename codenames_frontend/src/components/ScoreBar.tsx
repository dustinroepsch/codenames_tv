import type { Card, Team } from "../types/game";

interface ScoreBarProps {
  board: Card[];
  currentTurn: Team | null;
}

export default function ScoreBar({ board, currentTurn }: ScoreBarProps) {
  const redRemaining = board.filter(
    (c) => c.color === "red" && !c.revealed,
  ).length;
  const blueRemaining = board.filter(
    (c) => c.color === "blue" && !c.revealed,
  ).length;

  // For host view, unrevealed cards have color hidden as "neutral",
  // so count total of each color (revealed ones keep their true color).
  // We use the revealed count to infer remaining.
  const redRevealed = board.filter(
    (c) => c.color === "red" && c.revealed,
  ).length;
  const blueRevealed = board.filter(
    (c) => c.color === "blue" && c.revealed,
  ).length;

  // Determine totals from what we can see — on host view we only see revealed colors
  // If no unrevealed reds/blues visible, use revealed counts relative to standard totals
  const redTotal = redRemaining > 0 ? redRemaining + redRevealed : redRevealed;
  const blueTotal =
    blueRemaining > 0 ? blueRemaining + blueRevealed : blueRevealed;
  const redLeft = redTotal - redRevealed;
  const blueLeft = blueTotal - blueRevealed;

  return (
    <div className="score-bar">
      <div
        className={`score score-red ${currentTurn === "red" ? "active-turn" : ""}`}
      >
        <span className="score-label">RED</span>
        <span className="score-number">{redLeft}</span>
      </div>
      <div
        className={`score score-blue ${currentTurn === "blue" ? "active-turn" : ""}`}
      >
        <span className="score-number">{blueLeft}</span>
        <span className="score-label">BLUE</span>
      </div>
    </div>
  );
}
