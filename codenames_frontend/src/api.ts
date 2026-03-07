const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export async function createRoom(): Promise<{ code: string; host_id: string }> {
  const res = await fetch(`${API_BASE}/rooms`, { method: "POST" });
  return res.json();
}

export async function getRoom(
  code: string,
): Promise<
  { code: string; phase: string; player_count: number } | { error: string }
> {
  const res = await fetch(`${API_BASE}/rooms/${code.toUpperCase()}`);
  return res.json();
}

export function wsUrl(
  roomCode: string,
  isHost: boolean,
  sessionId?: string | null,
): string {
  let url = `${WS_BASE}/ws/${roomCode.toUpperCase()}?host=${isHost}`;
  if (sessionId) {
    url += `&session=${encodeURIComponent(sessionId)}`;
  }
  return url;
}
