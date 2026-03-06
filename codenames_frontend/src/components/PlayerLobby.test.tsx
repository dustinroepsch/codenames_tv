import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerLobby from "./PlayerLobby";
import type { RoomState } from "../types/game";

function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABCD",
    phase: "lobby",
    players: [
      { id: "p1", name: "Alice", team: null, role: null, connected: true },
      { id: "p2", name: "Bob", team: null, role: null, connected: true },
    ],
    board: null,
    current_turn: null,
    current_clue: null,
    guesses_remaining: null,
    winner: null,
    losing_team: null,
    word_count: 0,
    host_id: "h1",
    ...overrides,
  };
}

describe("PlayerLobby", () => {
  it("shows welcome message with player name", () => {
    render(<PlayerLobby roomState={makeRoomState()} playerName="Alice" />);
    expect(screen.getByText("You're in!")).toBeInTheDocument();
    expect(screen.getByText(/Welcome,/)).toBeInTheDocument();
    expect(screen.getAllByText("Alice").length).toBeGreaterThanOrEqual(1);
  });

  it("shows room code", () => {
    render(<PlayerLobby roomState={makeRoomState()} playerName="Alice" />);
    expect(screen.getByText("ABCD")).toBeInTheDocument();
  });

  it("shows player list", () => {
    render(<PlayerLobby roomState={makeRoomState()} playerName="Alice" />);
    expect(screen.getAllByText("Alice").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows player count", () => {
    render(<PlayerLobby roomState={makeRoomState()} playerName="Alice" />);
    expect(screen.getByText("2 players connected")).toBeInTheDocument();
  });

  it("shows waiting message", () => {
    render(<PlayerLobby roomState={makeRoomState()} playerName="Alice" />);
    expect(screen.getByText("Waiting for host to start...")).toBeInTheDocument();
  });
});
