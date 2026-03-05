import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Host from "./Host";
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

function renderHost(code = "ABCD") {
  return render(
    <MemoryRouter initialEntries={[`/host/${code}`]}>
      <Routes>
        <Route path="/host/:code" element={<Host />} />
      </Routes>
    </MemoryRouter>
  );
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

  it("shows room info when connected", () => {
    mockContextValue.connected = true;
    mockContextValue.roomState = {
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
    };

    renderHost("ABCD");
    expect(screen.getByText("Room: ABCD")).toBeInTheDocument();
    expect(screen.getByText("Phase: lobby")).toBeInTheDocument();
    expect(screen.getByText("Players: 1")).toBeInTheDocument();
  });
});
