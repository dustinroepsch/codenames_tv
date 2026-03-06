import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Play from "./Play";
import type { GameContextValue } from "../hooks/useGame";
import type { RoomState } from "../types/game";

const mockContextValue: GameContextValue = {
  roomState: null,
  playerId: null,
  connected: false,
  error: null,
  send: vi.fn(),
  connectToRoom: vi.fn(),
};

vi.mock("../hooks/useGame", () => ({
  useGame: () => mockContextValue,
}));

function renderPlay(code = "ABCD") {
  return render(
    <MemoryRouter initialEntries={[`/play/${code}`]}>
      <Routes>
        <Route path="/play/:code" element={<Play />} />
      </Routes>
    </MemoryRouter>
  );
}

function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
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

function makeBoard() {
  return Array.from({ length: 25 }, (_, i) => ({
    word: `Word${i}`,
    color: "neutral" as const,
    revealed: false,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockContextValue.connected = false;
  mockContextValue.playerId = null;
  mockContextValue.roomState = null;
});

describe("Play page", () => {
  it("calls connectToRoom with code and isHost=false", () => {
    renderPlay("WXYZ");
    expect(mockContextValue.connectToRoom).toHaveBeenCalledWith("WXYZ", false);
  });

  it("shows connecting state when not connected", () => {
    renderPlay("ABCD");
    expect(screen.getByText("Connecting to room ABCD...")).toBeInTheDocument();
  });

  it("shows name input form when connected but not joined", () => {
    mockContextValue.connected = true;
    renderPlay("ABCD");

    expect(screen.getByText("Join Room ABCD")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
    expect(screen.getByText("Join")).toBeDisabled();
  });

  it("enables join button when name is entered", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    renderPlay();

    await user.type(screen.getByPlaceholderText("Your name"), "Alice");
    expect(screen.getByText("Join")).toBeEnabled();
  });

  it("sends join message on form submit", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    renderPlay();

    await user.type(screen.getByPlaceholderText("Your name"), "Bob");
    await user.click(screen.getByText("Join"));

    expect(mockContextValue.send).toHaveBeenCalledWith({
      type: "join",
      payload: { name: "Bob" },
    });
  });

  it("does not submit when name is empty/whitespace", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    renderPlay();

    await user.type(screen.getByPlaceholderText("Your name"), "   ");
    expect(screen.getByText("Join")).toBeDisabled();
  });

  // --- Phase views after joining ---

  it("shows lobby view after joining", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    mockContextValue.playerId = "p1";
    mockContextValue.roomState = makeRoomState({
      players: [
        { id: "p1", name: "Alice", team: null, role: null, connected: true },
      ],
    });
    renderPlay();

    await user.type(screen.getByPlaceholderText("Your name"), "Alice");
    await user.click(screen.getByText("Join"));

    expect(screen.getByText("You're in!")).toBeInTheDocument();
    expect(screen.getByText("Waiting for host to start...")).toBeInTheDocument();
  });

  it("shows word submission view", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    mockContextValue.playerId = "p1";
    mockContextValue.roomState = makeRoomState({
      phase: "word_submission",
      word_count: 3,
    });
    renderPlay();

    await user.type(screen.getByPlaceholderText("Your name"), "Alice");
    await user.click(screen.getByText("Join"));

    expect(screen.getByText("Submit Words")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter a word")).toBeInTheDocument();
    expect(screen.getByText("3 total words submitted")).toBeInTheDocument();
  });

  it("shows spymaster view for spymaster in playing phase", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    mockContextValue.playerId = "p1";
    mockContextValue.roomState = makeRoomState({
      phase: "playing",
      board: makeBoard(),
      current_turn: "red",
      players: [
        { id: "p1", name: "Alice", team: "red", role: "spymaster", connected: true },
        { id: "p2", name: "Bob", team: "blue", role: "operative", connected: true },
      ],
    });
    renderPlay();

    await user.type(screen.getByPlaceholderText("Your name"), "Alice");
    await user.click(screen.getByText("Join"));

    expect(screen.getByText("SPYMASTER")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Clue word")).toBeInTheDocument();
  });

  it("shows operative view for operative in playing phase", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    mockContextValue.playerId = "p2";
    mockContextValue.roomState = makeRoomState({
      phase: "playing",
      board: makeBoard(),
      current_turn: "red",
      current_clue: { word: "animal", number: 3 },
      guesses_remaining: 4,
      players: [
        { id: "p1", name: "Alice", team: "red", role: "spymaster", connected: true },
        { id: "p2", name: "Bob", team: "red", role: "operative", connected: true },
      ],
    });
    renderPlay();

    await user.type(screen.getByPlaceholderText("Your name"), "Bob");
    await user.click(screen.getByText("Join"));

    expect(screen.getByText("OPERATIVE")).toBeInTheDocument();
    expect(screen.getByText("ANIMAL — 3")).toBeInTheDocument();
    expect(screen.getByText("End Turn")).toBeInTheDocument();
  });

  it("shows game over view", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    mockContextValue.playerId = "p1";
    mockContextValue.roomState = makeRoomState({
      phase: "game_over",
      winner: "red",
      board: makeBoard().map((c) => ({ ...c, revealed: true })),
      players: [
        { id: "p1", name: "Alice", team: "red", role: "operative", connected: true },
      ],
    });
    renderPlay();

    await user.type(screen.getByPlaceholderText("Your name"), "Alice");
    await user.click(screen.getByText("Join"));

    expect(screen.getByText("RED TEAM WINS!")).toBeInTheDocument();
    expect(screen.getByText("You won!")).toBeInTheDocument();
  });
});
