import { createContext } from "react";
import type { ClientMessage, RoomState } from "../types/game";

export interface GameContextValue {
  roomState: RoomState | null;
  playerId: string | null;
  connected: boolean;
  error: string | null;
  send: (msg: ClientMessage) => void;
  connectToRoom: (roomCode: string, isHost: boolean) => void;
  /** True when a session-based reconnect is in progress. */
  isReconnecting: boolean;
  /** Persist the player's display name to the session. */
  savePlayerName: (name: string) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);
