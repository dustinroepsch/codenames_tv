import { useState } from "react";
import type { ClientMessage, RoomState } from "../types/game";
import Board from "./Board";
import ScoreBar from "./ScoreBar";

interface PlayerSpymasterProps {
  roomState: RoomState;
  send: (msg: ClientMessage) => void;
  playerId: string;
}

export default function PlayerSpymaster({ roomState, send, playerId }: PlayerSpymasterProps) {
  const [clueWord, setClueWord] = useState("");
  const [clueNumber, setClueNumber] = useState<number | null>(1);

  const { board, current_turn, current_clue, guesses_remaining } = roomState;
  const player = roomState.players.find((p) => p.id === playerId);
  const isMyTurn = player?.team === current_turn;
  const waitingForClue = isMyTurn && !current_clue;

  if (!board) return null;

  const handleGiveClue = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = clueWord.trim();
    if (trimmed && waitingForClue) {
      send({ type: "give_clue", payload: { word: trimmed, number: clueNumber } });
      setClueWord("");
      setClueNumber(1);
    }
  };

  const decrease = () => {
    setClueNumber((n) => (n === null ? 9 : Math.max(0, n - 1)));
  };

  const increase = () => {
    setClueNumber((n) => (n === null ? null : n >= 9 ? null : n + 1));
  };

  const displayNumber = clueNumber === null ? "\u221E" : String(clueNumber);

  return (
    <div className="player-spymaster">
      <div className="role-header">
        <span className={`role-title role-${player?.team}`}>SPYMASTER</span>
        <span className={`team-label team-label-${player?.team}`}>
          {player?.team?.toUpperCase()} TEAM
        </span>
      </div>
      <ScoreBar board={board} currentTurn={current_turn} />
      <div className="turn-info">
        <span className={`turn-team turn-${current_turn}`}>
          {current_turn?.toUpperCase()} TEAM'S TURN
        </span>
        {current_clue ? (
          <span className="clue-display">
            {current_clue.word.toUpperCase()} — {current_clue.number ?? "\u221E"}
            {guesses_remaining != null && (
              <span className="guesses-left"> ({guesses_remaining} guesses left)</span>
            )}
          </span>
        ) : isMyTurn ? (
          <span className="clue-display waiting">Give your clue below</span>
        ) : (
          <span className="clue-display waiting">Waiting for opponent's clue...</span>
        )}
      </div>
      <Board board={board} showColors />
      {waitingForClue && (
        <form onSubmit={handleGiveClue} className="clue-form">
          <div className="clue-row">
            <input
              type="text"
              placeholder="Clue word"
              value={clueWord}
              onChange={(e) => setClueWord(e.target.value)}
              className="clue-input"
              autoFocus
            />
            <div className="number-picker">
              <button
                type="button"
                className="picker-btn"
                onClick={decrease}
                disabled={clueNumber === 0}
                aria-label="Decrease number"
              >
                -
              </button>
              <span className="picker-value">{displayNumber}</span>
              <button
                type="button"
                className="picker-btn"
                onClick={increase}
                disabled={clueNumber === null}
                aria-label="Increase number"
              >
                +
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!clueWord.trim()}>
            Give Clue
          </button>
        </form>
      )}
    </div>
  );
}
