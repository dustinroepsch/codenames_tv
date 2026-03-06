import { useEffect, useState } from "react";
import type { RoomState, ClientMessage } from "../types/game";

interface HostWordSubmissionProps {
  roomState: RoomState;
  send: (msg: ClientMessage) => void;
}

export default function HostWordSubmission({
  roomState,
  send,
}: HostWordSubmissionProps) {
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="host-word-submission">
      <h2>Submit Your Words!</h2>
      <p className="ws-instruction">Players: enter words on your phones</p>
      <div className="ws-timer">
        <span
          className={`timer-number ${timeLeft <= 10 ? "timer-urgent" : ""}`}
        >
          {timeLeft}
        </span>
        <span className="timer-label">seconds remaining</span>
      </div>
      <div className="ws-word-count">
        <span className="word-count-number">{roomState.word_count}</span>
        <span className="word-count-label">words submitted</span>
      </div>
      <div className="ws-dots">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
      <button
        className="btn btn-secondary"
        onClick={() => send({ type: "end_word_submission" })}
      >
        End Early
      </button>
    </div>
  );
}
