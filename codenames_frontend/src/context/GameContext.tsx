import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { wsUrl } from "../api";
import type { ClientMessage, RoomState, ServerMessage } from "../types/game";
import { GameContext } from "./gameContextDef";

const SESSION_KEY_PREFIX = "codenames_";

interface StoredSession {
  sessionId: string;
  playerId: string;
  name: string;
}

function getStoredSession(roomCode: string): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + roomCode);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function saveSession(roomCode: string, data: StoredSession) {
  sessionStorage.setItem(SESSION_KEY_PREFIX + roomCode, JSON.stringify(data));
}

function clearSession(roomCode: string) {
  sessionStorage.removeItem(SESSION_KEY_PREFIX + roomCode);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [wsUrlValue, setWsUrlValue] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "state":
          setRoomState(msg.payload);
          setError(null);
          break;
        case "joined":
          setPlayerId(msg.payload.player_id);
          setIsReconnecting(false);
          // Persist session to sessionStorage
          if (roomCode && sessionId) {
            const existing = getStoredSession(roomCode);
            saveSession(roomCode, {
              sessionId,
              playerId: msg.payload.player_id,
              name: existing?.name ?? "",
            });
          }
          break;
        case "error":
          setError(msg.payload.message);
          break;
        case "reconnect_failed":
          setPlayerId(null);
          setIsReconnecting(false);
          if (roomCode) {
            clearSession(roomCode);
          }
          break;
      }
    },
    [roomCode, sessionId],
  );

  // Called from ws.onopen (external event callback) — setState here is safe.
  // Re-created when playerId changes so the callback always has the latest value.
  const onConnect = useCallback(
    (sendFn: (msg: ClientMessage) => void) => {
      if (playerId) {
        setIsReconnecting(true);
        sendFn({ type: "reconnect" });
      }
    },
    [playerId],
  );

  const { connected, send } = useWebSocket({
    url: wsUrlValue,
    onMessage,
    onConnect,
  });

  const connectToRoom = useCallback(
    (code: string, isHost: boolean) => {
      setRoomCode(code);

      let sid: string | null = null;
      if (!isHost) {
        const stored = getStoredSession(code);
        if (stored) {
          sid = stored.sessionId;
          setPlayerId(stored.playerId);
        } else {
          sid = crypto.randomUUID();
        }
        setSessionId(sid);
      }
      setWsUrlValue(wsUrl(code, isHost, sid));
    },
    [],
  );

  /** Save the player name to the session after joining. */
  const savePlayerName = useCallback(
    (name: string) => {
      if (roomCode && sessionId) {
        const existing = getStoredSession(roomCode);
        saveSession(roomCode, {
          sessionId,
          playerId: existing?.playerId ?? "",
          name,
        });
      }
    },
    [roomCode, sessionId],
  );

  const value = useMemo(
    () => ({
      roomState,
      playerId,
      connected,
      error,
      send,
      connectToRoom,
      isReconnecting,
      savePlayerName,
    }),
    [
      roomState,
      playerId,
      connected,
      error,
      send,
      connectToRoom,
      isReconnecting,
      savePlayerName,
    ],
  );

  return <GameContext value={value}>{children}</GameContext>;
}
