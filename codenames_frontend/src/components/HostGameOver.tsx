import type { RoomState, ClientMessage } from "../types/game";
import Board from "./Board";

interface HostGameOverProps {
  roomState: RoomState;
  send: (msg: ClientMessage) => void;
}

export default function HostGameOver({ roomState, send }: HostGameOverProps) {
  const { winner, losing_team, board } = roomState;

  const winnerLabel = winner?.toUpperCase();
  const reason = losing_team ? "found the assassin!" : "found all their words!";

  return (
    <div className="host-game-over">
      <h2 className={`winner-banner winner-${winner}`}>
        {winnerLabel} TEAM WINS!
      </h2>
      <p className="win-reason">
        {losing_team
          ? `${losing_team.toUpperCase()} team ${reason}`
          : `${winnerLabel} team ${reason}`}
      </p>
      {board && <Board board={board} />}
      <button
        className="btn btn-primary"
        onClick={() => send({ type: "play_again" })}
      >
        Play Again
      </button>
    </div>
  );
}
