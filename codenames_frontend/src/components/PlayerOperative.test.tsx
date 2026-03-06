import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayerOperative from "./PlayerOperative";
import type { RoomState } from "../types/game";

function makeBoard() {
  return Array.from({ length: 25 }, (_, i) => ({
    word: `Word${i}`,
    color: "neutral" as const,
    revealed: false,
  }));
}

function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABCD",
    phase: "playing",
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
        team: "red",
        role: "operative",
        connected: true,
      },
    ],
    board: makeBoard(),
    current_turn: "red",
    current_clue: { word: "animal", number: 3 },
    guesses_remaining: 4,
    winner: null,
    losing_team: null,
    word_count: 0,
    host_id: "h1",
    ...overrides,
  };
}

describe("PlayerOperative", () => {
  it("shows operative role header", () => {
    render(
      <PlayerOperative
        roomState={makeRoomState()}
        send={vi.fn()}
        playerId="p2"
      />,
    );
    expect(screen.getByText("OPERATIVE")).toBeInTheDocument();
    expect(screen.getByText("RED TEAM")).toBeInTheDocument();
  });

  it("shows current clue and guesses remaining", () => {
    render(
      <PlayerOperative
        roomState={makeRoomState()}
        send={vi.fn()}
        playerId="p2"
      />,
    );
    expect(screen.getByText("ANIMAL — 3")).toBeInTheDocument();
    expect(screen.getByText("(4 guesses left)")).toBeInTheDocument();
  });

  it("shows board cards", () => {
    render(
      <PlayerOperative
        roomState={makeRoomState()}
        send={vi.fn()}
        playerId="p2"
      />,
    );
    expect(screen.getByText("Word0")).toBeInTheDocument();
    expect(screen.getByText("Word24")).toBeInTheDocument();
  });

  it("shows end turn button when it is player's turn and clue given", () => {
    render(
      <PlayerOperative
        roomState={makeRoomState()}
        send={vi.fn()}
        playerId="p2"
      />,
    );
    expect(screen.getByText("End Turn")).toBeInTheDocument();
  });

  it("sends end_turn message on button click", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <PlayerOperative roomState={makeRoomState()} send={send} playerId="p2" />,
    );

    await user.click(screen.getByText("End Turn"));
    expect(send).toHaveBeenCalledWith({ type: "end_turn" });
  });

  it("sends guess message on card click", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <PlayerOperative roomState={makeRoomState()} send={send} playerId="p2" />,
    );

    await user.click(screen.getByText("Word5"));
    expect(send).toHaveBeenCalledWith({
      type: "guess",
      payload: { card_index: 5 },
    });
  });

  it("shows waiting message when no clue given yet", () => {
    const state = makeRoomState({
      current_clue: null,
      guesses_remaining: null,
    });
    render(<PlayerOperative roomState={state} send={vi.fn()} playerId="p2" />);
    expect(
      screen.getByText("Waiting for your spymaster's clue..."),
    ).toBeInTheDocument();
    expect(screen.queryByText("End Turn")).not.toBeInTheDocument();
  });

  it("shows waiting message when it is not player's turn", () => {
    const state = makeRoomState({ current_turn: "blue" });
    render(<PlayerOperative roomState={state} send={vi.fn()} playerId="p2" />);
    expect(
      screen.getByText("Waiting for the other team..."),
    ).toBeInTheDocument();
    expect(screen.queryByText("End Turn")).not.toBeInTheDocument();
  });

  it("does not allow guessing when it is not player's turn", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const state = makeRoomState({ current_turn: "blue" });
    render(<PlayerOperative roomState={state} send={send} playerId="p2" />);

    await user.click(screen.getByText("Word0"));
    expect(send).not.toHaveBeenCalled();
  });

  it("shows unlimited guesses display for zero/unlimited clues", () => {
    const state = makeRoomState({
      current_clue: { word: "feathers", number: 0 },
      guesses_remaining: null,
    });
    render(<PlayerOperative roomState={state} send={vi.fn()} playerId="p2" />);
    expect(screen.getByText(/FEATHERS/)).toBeInTheDocument();
    expect(screen.getByText("(unlimited guesses)")).toBeInTheDocument();
  });

  it("shows infinity symbol for unlimited clue number", () => {
    const state = makeRoomState({
      current_clue: { word: "feathers", number: null },
      guesses_remaining: null,
    });
    render(<PlayerOperative roomState={state} send={vi.fn()} playerId="p2" />);
    expect(screen.getByText(/\u221E/)).toBeInTheDocument();
    expect(screen.getByText("(unlimited guesses)")).toBeInTheDocument();
  });

  it("returns null when board is null", () => {
    const state = makeRoomState({ board: null });
    const { container } = render(
      <PlayerOperative roomState={state} send={vi.fn()} playerId="p2" />,
    );
    expect(container.innerHTML).toBe("");
  });
});
