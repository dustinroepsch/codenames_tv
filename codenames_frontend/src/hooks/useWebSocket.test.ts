import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "./useWebSocket";

// --- Mock WebSocket ---
let mockInstances: MockWebSocket[] = [];

// WebSocket readyState constants
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSED = 3;

class MockWebSocket {
  static CONNECTING = WS_CONNECTING;
  static OPEN = WS_OPEN;
  static CLOSING = 2;
  static CLOSED = WS_CLOSED;

  url: string;
  readyState = WS_CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = WS_CLOSED;
    this.onclose?.();
  });

  constructor(url: string) {
    this.url = url;
    mockInstances.push(this);
  }

  simulateOpen() {
    this.readyState = WS_OPEN;
    this.onopen?.();
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose() {
    this.readyState = WS_CLOSED;
    this.onclose?.();
  }
}

beforeEach(() => {
  mockInstances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useWebSocket", () => {
  it("does not connect when url is null", () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket({ url: null, onMessage }));
    expect(mockInstances).toHaveLength(0);
  });

  it("connects when url is provided", () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket({ url: "ws://test", onMessage }));
    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0].url).toBe("ws://test");
  });

  it("sets connected to true on open", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: "ws://test", onMessage })
    );
    expect(result.current.connected).toBe(false);

    act(() => mockInstances[0].simulateOpen());
    expect(result.current.connected).toBe(true);
  });

  it("calls onMessage when a message is received", () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket({ url: "ws://test", onMessage }));

    act(() => {
      mockInstances[0].simulateOpen();
      mockInstances[0].simulateMessage({
        type: "joined",
        payload: { player_id: "p1" },
      });
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: "joined",
      payload: { player_id: "p1" },
    });
  });

  it("ignores malformed messages", () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket({ url: "ws://test", onMessage }));

    act(() => {
      mockInstances[0].simulateOpen();
      mockInstances[0].onmessage?.({ data: "not json{{{" });
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it("sends messages as JSON when connected", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: "ws://test", onMessage })
    );

    act(() => mockInstances[0].simulateOpen());
    act(() =>
      result.current.send({ type: "join", payload: { name: "Alice" } })
    );

    expect(mockInstances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: "join", payload: { name: "Alice" } })
    );
  });

  it("does not send when not connected", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: "ws://test", onMessage })
    );

    // WebSocket is still CONNECTING, not OPEN
    act(() =>
      result.current.send({ type: "join", payload: { name: "Alice" } })
    );

    expect(mockInstances[0].send).not.toHaveBeenCalled();
  });

  it("sets connected to false on close", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: "ws://test", onMessage })
    );

    act(() => mockInstances[0].simulateOpen());
    expect(result.current.connected).toBe(true);

    act(() => mockInstances[0].simulateClose());
    expect(result.current.connected).toBe(false);
  });

  it("attempts to reconnect after close", () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket({ url: "ws://test", onMessage }));

    expect(mockInstances).toHaveLength(1);

    act(() => mockInstances[0].simulateClose());
    act(() => vi.advanceTimersByTime(2000));

    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[1].url).toBe("ws://test");
  });

  it("closes socket on unmount", () => {
    const onMessage = vi.fn();
    const { unmount } = renderHook(() =>
      useWebSocket({ url: "ws://test", onMessage })
    );

    act(() => mockInstances[0].simulateOpen());
    unmount();

    expect(mockInstances[0].close).toHaveBeenCalled();
  });
});
