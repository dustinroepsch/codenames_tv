import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "../types/game";

interface UseWebSocketOptions {
  url: string | null;
  onMessage: (msg: ServerMessage) => void;
}

export function useWebSocket({ url, onMessage }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const connectRef = useRef<() => void>(undefined);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    connectRef.current = () => {
      if (!url) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

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
