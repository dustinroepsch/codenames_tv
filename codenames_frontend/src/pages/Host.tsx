import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGame } from "../hooks/useGame";

export default function Host() {
  const { code } = useParams<{ code: string }>();
  const { roomState, connected, connectToRoom } = useGame();

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

  return (
    <div className="host">
      <p>Room: {roomState?.code ?? code}</p>
      <p>Phase: {roomState?.phase ?? "connecting"}</p>
      <p>Players: {roomState?.players.length ?? 0}</p>
      {/* Phase-specific views will be added in Phase 3 */}
    </div>
  );
}
