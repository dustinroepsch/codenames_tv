import type { Card } from "../types/game";

interface BoardProps {
  board: Card[];
  onCardClick?: (index: number) => void;
  interactive?: boolean;
  showColors?: boolean;
}

function wordSizeClass(word: string): string {
  const len = word.length;
  if (len <= 5) return "";
  if (len <= 7) return "card-word-md";
  if (len <= 9) return "card-word-sm";
  return "card-word-xs";
}

export default function Board({
  board,
  onCardClick,
  interactive = false,
  showColors = false,
}: BoardProps) {
  return (
    <div className="board">
      {board.map((card, i) => {
        const colorClass =
          card.revealed || showColors ? `card-${card.color}` : "card-hidden";
        const clickable = interactive && !card.revealed;
        return (
          <button
            key={i}
            className={`card ${colorClass} ${clickable ? "card-clickable" : ""}`}
            onClick={() => clickable && onCardClick?.(i)}
            disabled={!clickable}
          >
            <span className={`card-word ${wordSizeClass(card.word)}`}>
              {card.word}
            </span>
          </button>
        );
      })}
    </div>
  );
}
