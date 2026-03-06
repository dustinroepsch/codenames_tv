import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerGameOver from "./PlayerGameOver";
import type { RoomState } from "../types/game";

function makeBoard() {
  return Array.from({ length: 25 }, (_, i) => ({
    word: `Word${i}`,
    color: (i < 9 ? "red" : i < 17 ? "blue" : i < 24 ? "neutral" : "assassin") as "red" | "blue" | "neutral" | "assassin",
    revealed: true,
  }));
}

function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABCD",
    phase: "game_over",
    players: [
      { id: "p1", name: "Alice", team: "red", role: "operative", connected: true },
      { id: "p2", name: "Bob", team: "blue", role: "operative", connected: true },
    ],
    board: makeBoard(),
    current_turn: null,
    current_clue: null,
    guesses_remaining: null,
    winner: "red",
    losing_team: null,
    word_count: 0,
    host_id: "h1",
    ...overrides,
  };
}

describe("PlayerGameOver", () => {
  it("shows winner banner", () => {
    render(<PlayerGameOver roomState={makeRoomState()} playerId="p1" />);
    expect(screen.getByText("RED TEAM WINS!")).toBeInTheDocument();
  });

  it("shows 'You won!' for winning team player", () => {
    render(<PlayerGameOver roomState={makeRoomState()} playerId="p1" />);
    expect(screen.getByText("You won!")).toBeInTheDocument();
  });

  it("shows 'You lost!' for losing team player", () => {
    render(<PlayerGameOver roomState={makeRoomState()} playerId="p2" />);
    expect(screen.getByText("You lost!")).toBeInTheDocument();
  });

  it("shows assassin reason when losing_team is set", () => {
    const state = makeRoomState({ winner: "red", losing_team: "blue" });
    render(<PlayerGameOver roomState={state} playerId="p1" />);
    expect(screen.getByText("BLUE team found the assassin!")).toBeInTheDocument();
  });

  it("shows normal win reason when no losing_team", () => {
    render(<PlayerGameOver roomState={makeRoomState()} playerId="p1" />);
    expect(screen.getByText("RED team found all their words!")).toBeInTheDocument();
  });

  it("shows revealed board", () => {
    render(<PlayerGameOver roomState={makeRoomState()} playerId="p1" />);
    expect(screen.getByText("Word0")).toBeInTheDocument();
    expect(screen.getByText("Word24")).toBeInTheDocument();
  });

  it("shows waiting for host message", () => {
    render(<PlayerGameOver roomState={makeRoomState()} playerId="p1" />);
    expect(screen.getByText("Waiting for host to start a new game...")).toBeInTheDocument();
  });
});
