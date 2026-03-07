import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import PlayerLobby from "../components/PlayerLobby";
import PlayerWordSubmission from "../components/PlayerWordSubmission";
import PlayerSpymaster from "../components/PlayerSpymaster";
import PlayerOperative from "../components/PlayerOperative";
import PlayerGameOver from "../components/PlayerGameOver";

function getStoredName(code: string | undefined): string {
  if (!code) return "";
  try {
    const raw = sessionStorage.getItem(`codenames_${code}`);
    if (raw) {
      const data = JSON.parse(raw);
      return data.name || "";
    }
  } catch {
    // ignore
  }
  return "";
}

export default function Play() {
  const { code } = useParams<{ code: string }>();
  const {
    roomState,
    playerId,
    connected,
    send,
    connectToRoom,
    isReconnecting,
    savePlayerName,
  } = useGame();

  const [name, setName] = useState(() => getStoredName(code));
  const [joinSubmitted, setJoinSubmitted] = useState(false);

  useEffect(() => {
    if (code) connectToRoom(code, false);
  }, [code, connectToRoom]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      send({ type: "join", payload: { name: trimmed } });
      savePlayerName(trimmed);
      setJoinSubmitted(true);
    }
  };

  if (!connected) {
    return (
      <div className="play">
        <p>Connecting to room {code}...</p>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className="play">
        <p>Reconnecting...</p>
      </div>
    );
  }

  // Show join form when we have no player identity and haven't just submitted the form.
  // Check sessionStorage to know if a stored session still exists (it's cleared on reconnect failure).
  const hasSession =
    !!code && sessionStorage.getItem(`codenames_${code}`) !== null;
  const showJoinForm = !playerId && !joinSubmitted && !hasSession;

  if (showJoinForm) {
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
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!name.trim()}
          >
            Join
          </button>
        </form>
      </div>
    );
  }

  if (!playerId || !roomState) {
    return (
      <div className="play">
        <p>Loading...</p>
      </div>
    );
  }

  const player = roomState.players.find((p) => p.id === playerId);
  const playerName = player?.name ?? name;

  switch (roomState.phase) {
    case "lobby":
      return <PlayerLobby roomState={roomState} playerName={playerName} />;
    case "word_submission":
      return <PlayerWordSubmission roomState={roomState} send={send} />;
    case "playing":
      if (player?.role === "spymaster") {
        return (
          <PlayerSpymaster
            roomState={roomState}
            send={send}
            playerId={playerId}
          />
        );
      }
      return (
        <PlayerOperative
          roomState={roomState}
          send={send}
          playerId={playerId}
        />
      );
    case "game_over":
      return <PlayerGameOver roomState={roomState} playerId={playerId} />;
  }
}
