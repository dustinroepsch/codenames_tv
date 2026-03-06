import type { RoomState } from "../types/game";
import Board from "./Board";
import ScoreBar from "./ScoreBar";
import PlayerList from "./PlayerList";

interface HostGameBoardProps {
  roomState: RoomState;
}

export default function HostGameBoard({ roomState }: HostGameBoardProps) {
  const { board, current_turn, current_clue, guesses_remaining } = roomState;

  if (!board) return null;

  return (
    <div className="host-game">
      <ScoreBar board={board} currentTurn={current_turn} />
      <div className="turn-info">
        <span className={`turn-team turn-${current_turn}`}>
          {current_turn?.toUpperCase()} TEAM
        </span>
        {current_clue ? (
          <span className="clue-display">
            {current_clue.word.toUpperCase()} — {current_clue.number ?? "\u221E"}
            {guesses_remaining != null ? (
              <span className="guesses-left"> ({guesses_remaining} guesses left)</span>
            ) : (
              <span className="guesses-left"> (unlimited guesses)</span>
            )}
          </span>
        ) : (
          <span className="clue-display waiting">Waiting for clue...</span>
        )}
      </div>
      <Board board={board} />
      <PlayerList players={roomState.players} showTeams />
    </div>
  );
}
