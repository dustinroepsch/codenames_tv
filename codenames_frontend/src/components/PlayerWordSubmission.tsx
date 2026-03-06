import { useEffect, useState } from "react";
import type { ClientMessage, RoomState } from "../types/game";

interface PlayerWordSubmissionProps {
  roomState: RoomState;
  send: (msg: ClientMessage) => void;
}

export default function PlayerWordSubmission({ roomState, send }: PlayerWordSubmissionProps) {
  const [word, setWord] = useState("");
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = word.trim();
    if (trimmed) {
      send({ type: "submit_word", payload: { word: trimmed } });
      setSubmitted((prev) => [...prev, trimmed]);
      setWord("");
    }
  };

  return (
    <div className="player-word-submission">
      <h2>Submit Words</h2>
      <div className="ws-timer">
        <span className={`timer-number timer-small ${timeLeft <= 10 ? "timer-urgent" : ""}`}>
          {timeLeft}
        </span>
        <span className="timer-label">seconds remaining</span>
      </div>
      <form onSubmit={handleSubmit} className="word-form">
        <input
          type="text"
          placeholder="Enter a word"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          maxLength={30}
          autoFocus
          className="word-input"
        />
        <button type="submit" className="btn btn-primary" disabled={!word.trim()}>
          Submit Word
        </button>
      </form>
      {submitted.length > 0 && (
        <div className="submitted-words">
          <p className="submitted-label">Your words:</p>
          <div className="word-chips">
            {submitted.map((w, i) => (
              <span key={i} className="word-chip">{w}</span>
            ))}
          </div>
        </div>
      )}
      <p className="total-word-count">{roomState.word_count} total words submitted</p>
    </div>
  );
}
