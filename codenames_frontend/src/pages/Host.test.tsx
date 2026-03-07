import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Host from "./Host";
import type { GameContextValue } from "../hooks/useGame";
import type { RoomState } from "../types/game";

const mockContextValue: GameContextValue = {
  roomState: null,
  playerId: null,
  connected: false,
  error: null,
  send: vi.fn(),
  connectToRoom: vi.fn(),
  isReconnecting: false,
  savePlayerName: vi.fn(),
};

vi.mock("../hooks/useGame", () => ({
  useGame: () => mockContextValue,
}));

function renderHost(code = "ABCD") {
  return render(
    <MemoryRouter initialEntries={[`/host/${code}`]}>
      <Routes>
        <Route path="/host/:code" element={<Host />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeLobbyState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABCD",
    phase: "lobby",
    players: [
      { id: "p1", name: "Alice", team: null, role: null, connected: true },
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

beforeEach(() => {
  vi.clearAllMocks();
  mockContextValue.connected = false;
  mockContextValue.roomState = null;
});

describe("Host page", () => {
  it("calls connectToRoom with code and isHost=true", () => {
    renderHost("WXYZ");
    expect(mockContextValue.connectToRoom).toHaveBeenCalledWith("WXYZ", true);
  });

  it("shows connecting state when not connected", () => {
    renderHost("ABCD");
    expect(screen.getByText("Connecting to room ABCD...")).toBeInTheDocument();
  });

  it("shows loading when connected but no room state yet", () => {
    mockContextValue.connected = true;
    renderHost();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  // --- Lobby phase ---
  it("shows room code prominently in lobby", () => {
    mockContextValue.connected = true;
    mockContextValue.roomState = makeLobbyState();
    renderHost();
    expect(screen.getByText("ABCD")).toBeInTheDocument();
    expect(screen.getByText("JOIN WITH CODE")).toBeInTheDocument();
  });

  it("shows player names in lobby", () => {
    mockContextValue.connected = true;
    mockContextValue.roomState = makeLobbyState();
    renderHost();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("1 player connected")).toBeInTheDocument();
  });

  it("disables Start Game with fewer than 4 players", () => {
    mockContextValue.connected = true;
    mockContextValue.roomState = makeLobbyState();
    renderHost();
    expect(screen.getByText("Start Game")).toBeDisabled();
    expect(
      screen.getByText("Waiting for at least 4 players..."),
    ).toBeInTheDocument();
  });

  it("enables Start Game with 4+ players", () => {
    mockContextValue.connected = true;
    mockContextValue.roomState = makeLobbyState({
      players: [
        { id: "p1", name: "Alice", team: null, role: null, connected: true },
        { id: "p2", name: "Bob", team: null, role: null, connected: true },
        { id: "p3", name: "Carol", team: null, role: null, connected: true },
        { id: "p4", name: "Dave", team: null, role: null, connected: true },
      ],
    });
    renderHost();
    expect(screen.getByText("Start Game")).toBeEnabled();
  });

  // --- Word submission phase ---
  it("shows word submission screen with timer and word count", () => {
    mockContextValue.connected = true;
    mockContextValue.roomState = makeLobbyState({
      phase: "word_submission",
      word_count: 7,
    });
    renderHost();
    expect(screen.getByText("Submit Your Words!")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("words submitted")).toBeInTheDocument();
    expect(screen.getByText("End Early")).toBeInTheDocument();
  });

  // --- Playing phase ---
  it("shows game board during playing phase", () => {
    mockContextValue.connected = true;
    mockContextValue.roomState = makeLobbyState({
      phase: "playing",
      board: Array.from({ length: 25 }, (_, i) => ({
        word: `Word${i}`,
        color: "neutral" as const,
        revealed: false,
      })),
      current_turn: "red",
      players: [
        {
          id: "p1",
          name: "Alice",
          team: "red",
          role: "spymaster",
          connected: true,
        },
        {
          id: "p2",
          name: "Bob",
          team: "blue",
          role: "operative",
          connected: true,
        },
      ],
    });
    renderHost();
    expect(screen.getByText("RED TEAM")).toBeInTheDocument();
    expect(screen.getByText("Waiting for clue...")).toBeInTheDocument();
    expect(screen.getByText("Word0")).toBeInTheDocument();
    expect(screen.getByText("Word24")).toBeInTheDocument();
  });

  // --- Game over phase ---
  it("shows winner and play again button on game over", () => {
    mockContextValue.connected = true;
    mockContextValue.roomState = makeLobbyState({
      phase: "game_over",
      winner: "blue",
      losing_team: "red",
      board: Array.from({ length: 25 }, (_, i) => ({
        word: `Word${i}`,
        color: "neutral" as const,
        revealed: true,
      })),
    });
    renderHost();
    expect(screen.getByText("BLUE TEAM WINS!")).toBeInTheDocument();
    expect(screen.getByText("Play Again")).toBeInTheDocument();
  });
});
