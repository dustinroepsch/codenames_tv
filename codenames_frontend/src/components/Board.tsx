import type { Card } from "../types/game";

interface BoardProps {
  board: Card[];
  onCardClick?: (index: number) => void;
  interactive?: boolean;
}

export default function Board({ board, onCardClick, interactive = false }: BoardProps) {
  return (
    <div className="board">
      {board.map((card, i) => {
        const colorClass = card.revealed ? `card-${card.color}` : "card-hidden";
        const clickable = interactive && !card.revealed;
        return (
          <button
            key={i}
            className={`card ${colorClass} ${clickable ? "card-clickable" : ""}`}
            onClick={() => clickable && onCardClick?.(i)}
            disabled={!clickable}
          >
            <span className="card-word">{card.word}</span>
          </button>
        );
      })}
    </div>
  );
}
