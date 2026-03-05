import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Play from "./Play";
import type { GameContextValue } from "../hooks/useGame";

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

  it("shows room state after joining", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    mockContextValue.playerId = "p1";
    mockContextValue.roomState = {
      code: "ABCD",
      phase: "lobby",
      players: [
        { id: "p1", name: "Bob", team: null, role: null, connected: true },
      ],
      board: null,
      current_turn: null,
      current_clue: null,
      guesses_remaining: null,
      winner: null,
      losing_team: null,
      word_count: 0,
      host_id: "h1",
    };
    renderPlay();

    // Need to trigger the join to set `joined` state
    await user.type(screen.getByPlaceholderText("Your name"), "Bob");
    await user.click(screen.getByText("Join"));

    expect(screen.getByText("Room: ABCD")).toBeInTheDocument();
    expect(screen.getByText("Phase: lobby")).toBeInTheDocument();
    expect(screen.getByText("You: Bob")).toBeInTheDocument();
  });

  it("does not submit when name is empty/whitespace", async () => {
    const user = userEvent.setup();
    mockContextValue.connected = true;
    renderPlay();

    await user.type(screen.getByPlaceholderText("Your name"), "   ");
    // Button should still be disabled (whitespace-only)
    expect(screen.getByText("Join")).toBeDisabled();
  });
});
