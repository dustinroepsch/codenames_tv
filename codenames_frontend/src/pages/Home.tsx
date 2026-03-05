import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, getRoom } from "../api";

export default function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleHost = async () => {
    setLoading(true);
    setError("");
    try {
      const { code } = await createRoom();
      navigate(`/host/${code}`);
    } catch {
      setError("Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setError("Room code must be 4 letters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getRoom(code);
      if ("error" in result) {
        setError("Room not found");
      } else {
        navigate(`/play/${code}`);
      }
    } catch {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home">
      <h1>CODENAMES</h1>
      <p className="subtitle">A Jackbox-style party game</p>

      <div className="home-actions">
        <button className="btn btn-primary" onClick={handleHost} disabled={loading}>
          Host a Game
        </button>

        <div className="divider">or</div>

        <form onSubmit={handleJoin} className="join-form">
          <input
            type="text"
            placeholder="ROOM CODE"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            className="code-input"
          />
          <button type="submit" className="btn btn-secondary" disabled={loading || joinCode.length !== 4}>
            Join Game
          </button>
        </form>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
