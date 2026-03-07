import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "../types/game";

interface UseWebSocketOptions {
  url: string | null;
  onMessage: (msg: ServerMessage) => void;
  /** Called when the WebSocket opens. Receives a send function for immediate use. */
  onConnect?: (send: (msg: ClientMessage) => void) => void;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
}: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const connectRef = useRef<() => void>(undefined);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  useEffect(() => {
    connectRef.current = () => {
      if (!url) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        const sendFn = (msg: ClientMessage) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        };
        onConnectRef.current?.(sendFn);
      };

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          onMessageRef.current(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout.current = setTimeout(() => {
          connectRef.current?.();
        }, 2000);
      };

      ws.onerror = () => ws.close();
    };
  }, [url]);

  useEffect(() => {
    if (url) connectRef.current?.();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [url]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, send };
}
