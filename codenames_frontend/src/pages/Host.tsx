import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import HostLobby from "../components/HostLobby";
import HostWordSubmission from "../components/HostWordSubmission";
import HostGameBoard from "../components/HostGameBoard";
import HostGameOver from "../components/HostGameOver";

export default function Host() {
  const { code } = useParams<{ code: string }>();
  const { roomState, connected, send, connectToRoom } = useGame();

  useEffect(() => {
    if (code) connectToRoom(code, true);
  }, [code, connectToRoom]);

  if (!connected) {
    return (
      <div className="host">
        <p>Connecting to room {code}...</p>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="host">
        <p>Loading...</p>
      </div>
    );
  }

  switch (roomState.phase) {
    case "lobby":
      return <HostLobby roomState={roomState} send={send} />;
    case "word_submission":
      return <HostWordSubmission roomState={roomState} send={send} />;
    case "playing":
      return <HostGameBoard roomState={roomState} />;
    case "game_over":
      return <HostGameOver roomState={roomState} send={send} />;
  }
}
