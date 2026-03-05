export type GamePhase = "lobby" | "word_submission" | "playing" | "game_over";
export type Team = "red" | "blue";
export type Role = "spymaster" | "operative";
export type CardColor = "red" | "blue" | "neutral" | "assassin";

export interface Card {
  word: string;
  color: CardColor;
  revealed: boolean;
}

export interface Player {
  id: string;
  name: string;
  team: Team | null;
  role: Role | null;
  connected: boolean;
}

export interface Clue {
  word: string;
  number: number;
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  players: Player[];
  board: Card[] | null;
  current_turn: Team | null;
  current_clue: Clue | null;
  guesses_remaining: number | null;
  winner: Team | null;
  losing_team: Team | null;
  word_count: number;
  host_id: string;
}

// Server → Client messages
export type ServerMessage =
  | { type: "state"; payload: RoomState }
  | { type: "error"; payload: { message: string } }
  | { type: "joined"; payload: { player_id: string } };

// Client → Server messages
export type ClientMessage =
  | { type: "join"; payload: { name: string } }
  | { type: "start_word_submission" }
  | { type: "submit_word"; payload: { word: string } }
  | { type: "end_word_submission" }
  | { type: "give_clue"; payload: { word: string; number: number } }
  | { type: "guess"; payload: { card_index: number } }
  | { type: "end_turn" }
  | { type: "play_again" };
