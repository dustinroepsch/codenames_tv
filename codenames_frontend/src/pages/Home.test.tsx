import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock api module
vi.mock("../api", () => ({
  createRoom: vi.fn(),
  getRoom: vi.fn(),
}));

import { createRoom, getRoom } from "../api";
const mockCreateRoom = vi.mocked(createRoom);
const mockGetRoom = vi.mocked(getRoom);

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Home page", () => {
  it("renders the title and buttons", () => {
    renderHome();
    expect(screen.getByText("CODENAMES")).toBeInTheDocument();
    expect(screen.getByText("Host a Game")).toBeInTheDocument();
    expect(screen.getByText("Join Game")).toBeInTheDocument();
  });

  it("join button is disabled when code is empty", () => {
    renderHome();
    expect(screen.getByText("Join Game")).toBeDisabled();
  });

  it("join button enables when 4-char code is entered", async () => {
    const user = userEvent.setup();
    renderHome();
    const input = screen.getByPlaceholderText("ROOM CODE");
    await user.type(input, "ABCD");
    expect(screen.getByText("Join Game")).toBeEnabled();
  });

  it("uppercases the room code input", async () => {
    const user = userEvent.setup();
    renderHome();
    const input = screen.getByPlaceholderText("ROOM CODE");
    await user.type(input, "abcd");
    expect(input).toHaveValue("ABCD");
  });

  it("navigates to /host/:code on host click", async () => {
    const user = userEvent.setup();
    mockCreateRoom.mockResolvedValueOnce({ code: "WXYZ", host_id: "h1" });

    renderHome();
    await user.click(screen.getByText("Host a Game"));

    expect(mockCreateRoom).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/host/WXYZ");
  });

  it("shows error when room creation fails", async () => {
    const user = userEvent.setup();
    mockCreateRoom.mockRejectedValueOnce(new Error("network"));

    renderHome();
    await user.click(screen.getByText("Host a Game"));

    expect(screen.getByText("Failed to create room")).toBeInTheDocument();
  });

  it("navigates to /play/:code on successful join", async () => {
    const user = userEvent.setup();
    mockGetRoom.mockResolvedValueOnce({
      code: "ABCD",
      phase: "lobby",
      player_count: 2,
    });

    renderHome();
    await user.type(screen.getByPlaceholderText("ROOM CODE"), "ABCD");
    await user.click(screen.getByText("Join Game"));

    expect(mockGetRoom).toHaveBeenCalledWith("ABCD");
    expect(mockNavigate).toHaveBeenCalledWith("/play/ABCD");
  });

  it("shows error when room is not found", async () => {
    const user = userEvent.setup();
    mockGetRoom.mockResolvedValueOnce({ error: "Room not found" });

    renderHome();
    await user.type(screen.getByPlaceholderText("ROOM CODE"), "ZZZZ");
    await user.click(screen.getByText("Join Game"));

    expect(screen.getByText("Room not found")).toBeInTheDocument();
  });

  it("shows error when join fetch fails", async () => {
    const user = userEvent.setup();
    mockGetRoom.mockRejectedValueOnce(new Error("network"));

    renderHome();
    await user.type(screen.getByPlaceholderText("ROOM CODE"), "ABCD");
    await user.click(screen.getByText("Join Game"));

    expect(screen.getByText("Failed to connect")).toBeInTheDocument();
  });
});
