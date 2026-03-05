import { createContext } from "react";
import type { ClientMessage, RoomState } from "../types/game";

export interface GameContextValue {
  roomState: RoomState | null;
  playerId: string | null;
  connected: boolean;
  error: string | null;
  send: (msg: ClientMessage) => void;
  connectToRoom: (roomCode: string, isHost: boolean) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);
