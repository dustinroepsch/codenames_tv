import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayerWordSubmission from "./PlayerWordSubmission";
import type { RoomState } from "../types/game";

function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABCD",
    phase: "word_submission",
    players: [
      { id: "p1", name: "Alice", team: null, role: null, connected: true },
    ],
    board: null,
    current_turn: null,
    current_clue: null,
    guesses_remaining: null,
    winner: null,
    losing_team: null,
    word_count: 5,
    host_id: "h1",
    ...overrides,
  };
}

describe("PlayerWordSubmission", () => {
  it("shows word input and submit button", () => {
    render(<PlayerWordSubmission roomState={makeRoomState()} send={vi.fn()} />);
    expect(screen.getByText("Submit Words")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter a word")).toBeInTheDocument();
    expect(screen.getByText("Submit Word")).toBeDisabled();
  });

  it("enables submit when word is entered", async () => {
    const user = userEvent.setup();
    render(<PlayerWordSubmission roomState={makeRoomState()} send={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Enter a word"), "dragon");
    expect(screen.getByText("Submit Word")).toBeEnabled();
  });

  it("sends submit_word message and clears input", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(<PlayerWordSubmission roomState={makeRoomState()} send={send} />);

    await user.type(screen.getByPlaceholderText("Enter a word"), "dragon");
    await user.click(screen.getByText("Submit Word"));

    expect(send).toHaveBeenCalledWith({
      type: "submit_word",
      payload: { word: "dragon" },
    });
    expect(screen.getByPlaceholderText("Enter a word")).toHaveValue("");
  });

  it("shows submitted words after submitting", async () => {
    const user = userEvent.setup();
    render(<PlayerWordSubmission roomState={makeRoomState()} send={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Enter a word"), "dragon");
    await user.click(screen.getByText("Submit Word"));

    expect(screen.getByText("Your words:")).toBeInTheDocument();
    expect(screen.getByText("dragon")).toBeInTheDocument();
  });

  it("shows total word count from room state", () => {
    render(<PlayerWordSubmission roomState={makeRoomState({ word_count: 12 })} send={vi.fn()} />);
    expect(screen.getByText("12 total words submitted")).toBeInTheDocument();
  });

  it("does not submit empty/whitespace words", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(<PlayerWordSubmission roomState={makeRoomState()} send={send} />);

    await user.type(screen.getByPlaceholderText("Enter a word"), "   ");
    expect(screen.getByText("Submit Word")).toBeDisabled();
  });
});
