import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoom, getRoom, wsUrl } from "./api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("wsUrl", () => {
  it("builds a WebSocket URL with room code and host flag", () => {
    const url = wsUrl("abcd", true);
    expect(url).toBe("ws://localhost:3001/ws/ABCD?host=true");
  });

  it("uppercases the room code", () => {
    const url = wsUrl("xyzw", false);
    expect(url).toContain("/ws/XYZW");
    expect(url).toContain("host=false");
  });
});

describe("createRoom", () => {
  it("POSTs to /rooms and returns the response", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: "ABCD", host_id: "h1" }),
    });

    const result = await createRoom();

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:3001/rooms", {
      method: "POST",
    });
    expect(result).toEqual({ code: "ABCD", host_id: "h1" });
  });
});

describe("getRoom", () => {
  it("GETs /rooms/:code with uppercase code", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({ code: "ABCD", phase: "lobby", player_count: 2 }),
    });

    const result = await getRoom("abcd");

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:3001/rooms/ABCD");
    expect(result).toEqual({ code: "ABCD", phase: "lobby", player_count: 2 });
  });

  it("returns error object when room not found", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ error: "Room not found" }),
    });

    const result = await getRoom("ZZZZ");
    expect(result).toEqual({ error: "Room not found" });
  });
});
