import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayerSpymaster from "./PlayerSpymaster";
import type { RoomState } from "../types/game";

function makeBoard() {
  return Array.from({ length: 25 }, (_, i) => ({
    word: `Word${i}`,
    color: (i < 9 ? "red" : i < 17 ? "blue" : i < 24 ? "neutral" : "assassin") as "red" | "blue" | "neutral" | "assassin",
    revealed: false,
  }));
}

function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABCD",
    phase: "playing",
    players: [
      { id: "p1", name: "Alice", team: "red", role: "spymaster", connected: true },
      { id: "p2", name: "Bob", team: "blue", role: "operative", connected: true },
    ],
    board: makeBoard(),
    current_turn: "red",
    current_clue: null,
    guesses_remaining: null,
    winner: null,
    losing_team: null,
    word_count: 0,
    host_id: "h1",
    ...overrides,
  };
}

describe("PlayerSpymaster", () => {
  it("shows spymaster role header", () => {
    render(<PlayerSpymaster roomState={makeRoomState()} send={vi.fn()} playerId="p1" />);
    expect(screen.getByText("SPYMASTER")).toBeInTheDocument();
    expect(screen.getByText("RED TEAM")).toBeInTheDocument();
  });

  it("shows board with cards", () => {
    render(<PlayerSpymaster roomState={makeRoomState()} send={vi.fn()} playerId="p1" />);
    expect(screen.getByText("Word0")).toBeInTheDocument();
    expect(screen.getByText("Word24")).toBeInTheDocument();
  });

  it("shows clue form when it is spymaster's turn and no clue given", () => {
    render(<PlayerSpymaster roomState={makeRoomState()} send={vi.fn()} playerId="p1" />);
    expect(screen.getByPlaceholderText("Clue word")).toBeInTheDocument();
    expect(screen.getByText("Give Clue")).toBeDisabled();
    expect(screen.getByText("Give your clue below")).toBeInTheDocument();
  });

  it("does not show clue form when it is not spymaster's turn", () => {
    const state = makeRoomState({ current_turn: "blue" });
    render(<PlayerSpymaster roomState={state} send={vi.fn()} playerId="p1" />);
    expect(screen.queryByPlaceholderText("Clue word")).not.toBeInTheDocument();
    expect(screen.getByText("Waiting for opponent's clue...")).toBeInTheDocument();
  });

  it("sends give_clue message on submit", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(<PlayerSpymaster roomState={makeRoomState()} send={send} playerId="p1" />);

    await user.type(screen.getByPlaceholderText("Clue word"), "animal");
    const numberInput = screen.getByRole("spinbutton");
    await user.clear(numberInput);
    await user.type(numberInput, "3");
    await user.click(screen.getByText("Give Clue"));

    expect(send).toHaveBeenCalledWith({
      type: "give_clue",
      payload: { word: "animal", number: 3 },
    });
  });

  it("does not show clue form when clue already given", () => {
    const state = makeRoomState({
      current_clue: { word: "animal", number: 3 },
      guesses_remaining: 4,
    });
    render(<PlayerSpymaster roomState={state} send={vi.fn()} playerId="p1" />);
    expect(screen.queryByPlaceholderText("Clue word")).not.toBeInTheDocument();
    expect(screen.getByText("ANIMAL — 3")).toBeInTheDocument();
    expect(screen.getByText("(4 guesses left)")).toBeInTheDocument();
  });

  it("returns null when board is null", () => {
    const state = makeRoomState({ board: null });
    const { container } = render(
      <PlayerSpymaster roomState={state} send={vi.fn()} playerId="p1" />
    );
    expect(container.innerHTML).toBe("");
  });
});
