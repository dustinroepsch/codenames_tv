import type { RoomState } from "../types/game";
import PlayerList from "./PlayerList";

interface PlayerLobbyProps {
  roomState: RoomState;
  playerName: string;
}

export default function PlayerLobby({ roomState, playerName }: PlayerLobbyProps) {
  return (
    <div className="player-lobby">
      <h2>You're in!</h2>
      <p className="player-welcome">Welcome, <strong>{playerName}</strong></p>
      <div className="room-code-display">
        <p className="room-code-label">ROOM</p>
        <p className="room-code room-code-small">{roomState.code}</p>
      </div>
      <PlayerList players={roomState.players} />
      <p className="player-count">
        {roomState.players.length} player{roomState.players.length !== 1 ? "s" : ""} connected
      </p>
      <p className="waiting-msg">Waiting for host to start...</p>
    </div>
  );
}
