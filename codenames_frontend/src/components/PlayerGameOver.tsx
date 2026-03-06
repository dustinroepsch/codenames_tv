import type { RoomState } from "../types/game";
import Board from "./Board";

interface PlayerGameOverProps {
  roomState: RoomState;
  playerId: string;
}

export default function PlayerGameOver({ roomState, playerId }: PlayerGameOverProps) {
  const { winner, losing_team, board } = roomState;
  const player = roomState.players.find((p) => p.id === playerId);
  const won = player?.team === winner;

  const winnerLabel = winner?.toUpperCase();
  const reason = losing_team ? "found the assassin!" : "found all their words!";

  return (
    <div className="player-game-over">
      <h2 className={`winner-banner winner-${winner}`}>
        {winnerLabel} TEAM WINS!
      </h2>
      <p className={`result-text ${won ? "result-win" : "result-lose"}`}>
        {won ? "You won!" : "You lost!"}
      </p>
      <p className="win-reason">
        {losing_team
          ? `${losing_team.toUpperCase()} team ${reason}`
          : `${winnerLabel} team ${reason}`}
      </p>
      {board && <Board board={board} />}
      <p className="waiting-msg">Waiting for host to start a new game...</p>
    </div>
  );
}
