import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useGame } from "../hooks/useGame";

export default function Play() {
  const { code } = useParams<{ code: string }>();
  const { roomState, playerId, connected, send, connectToRoom } = useGame();
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (code) connectToRoom(code, false);
  }, [code, connectToRoom]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      send({ type: "join", payload: { name: trimmed } });
      setJoined(true);
    }
  };

  if (!connected) {
    return (
      <div className="play">
        <p>Connecting to room {code}...</p>
      </div>
    );
  }

  if (!joined || !playerId) {
    return (
      <div className="play">
        <h2>Join Room {code}</h2>
        <form onSubmit={handleJoin} className="join-form">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
            className="name-input"
          />
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Join
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="play">
      <p>Room: {roomState?.code ?? code}</p>
      <p>Phase: {roomState?.phase ?? "connecting"}</p>
      <p>You: {roomState?.players.find((p) => p.id === playerId)?.name ?? name}</p>
      {/* Phase-specific views will be added in Phase 4 */}
    </div>
  );
}
