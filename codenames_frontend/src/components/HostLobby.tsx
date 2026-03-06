import type { RoomState } from "../types/game";
import type { ClientMessage } from "../types/game";
import PlayerList from "./PlayerList";

interface HostLobbyProps {
  roomState: RoomState;
  send: (msg: ClientMessage) => void;
}

export default function HostLobby({ roomState, send }: HostLobbyProps) {
  const canStart = roomState.players.length >= 4;

  return (
    <div className="host-lobby">
      <h1>CODENAMES</h1>
      <div className="room-code-display">
        <p className="room-code-label">JOIN WITH CODE</p>
        <p className="room-code">{roomState.code}</p>
      </div>
      <PlayerList players={roomState.players} />
      <p className="player-count">
        {roomState.players.length} player
        {roomState.players.length !== 1 ? "s" : ""} connected
      </p>
      {!canStart && (
        <p className="waiting-msg">Waiting for at least 4 players...</p>
      )}
      <button
        className="btn btn-primary"
        disabled={!canStart}
        onClick={() => send({ type: "start_word_submission" })}
      >
        Start Game
      </button>
    </div>
  );
}
