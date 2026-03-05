import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { wsUrl } from "../api";
import type { RoomState, ServerMessage } from "../types/game";
import { GameContext } from "./gameContextDef";

export function GameProvider({ children }: { children: ReactNode }) {
  const [wsUrlValue, setWsUrlValue] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "state":
        setRoomState(msg.payload);
        setError(null);
        break;
      case "joined":
        setPlayerId(msg.payload.player_id);
        break;
      case "error":
        setError(msg.payload.message);
        break;
    }
  }, []);

  const { connected, send } = useWebSocket({ url: wsUrlValue, onMessage });

  const connectToRoom = useCallback((roomCode: string, isHost: boolean) => {
    setWsUrlValue(wsUrl(roomCode, isHost));
  }, []);

  const value = useMemo(
    () => ({ roomState, playerId, connected, error, send, connectToRoom }),
    [roomState, playerId, connected, error, send, connectToRoom]
  );

  return <GameContext value={value}>{children}</GameContext>;
}
