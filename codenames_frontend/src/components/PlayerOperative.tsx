import type { ClientMessage, RoomState } from "../types/game";
import Board from "./Board";
import ScoreBar from "./ScoreBar";

interface PlayerOperativeProps {
  roomState: RoomState;
  send: (msg: ClientMessage) => void;
  playerId: string;
}

export default function PlayerOperative({
  roomState,
  send,
  playerId,
}: PlayerOperativeProps) {
  const { board, current_turn, current_clue, guesses_remaining } = roomState;
  const player = roomState.players.find((p) => p.id === playerId);
  const isMyTurn = player?.team === current_turn;
  const canGuess = isMyTurn && current_clue !== null;

  if (!board) return null;

  const handleCardClick = (index: number) => {
    if (canGuess) {
      send({ type: "guess", payload: { card_index: index } });
    }
  };

  const handleEndTurn = () => {
    send({ type: "end_turn" });
  };

  return (
    <div className="player-operative">
      <div className="role-header">
        <span className={`role-title role-${player?.team}`}>OPERATIVE</span>
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
            {current_clue.word.toUpperCase()} —{" "}
            {current_clue.number ?? "\u221E"}
            {guesses_remaining != null ? (
              <span className="guesses-left">
                {" "}
                ({guesses_remaining} guesses left)
              </span>
            ) : (
              <span className="guesses-left"> (unlimited guesses)</span>
            )}
          </span>
        ) : (
          <span className="clue-display waiting">Waiting for clue...</span>
        )}
      </div>
      <Board
        board={board}
        onCardClick={handleCardClick}
        interactive={canGuess}
      />
      {canGuess && (
        <button
          className="btn btn-secondary end-turn-btn"
          onClick={handleEndTurn}
        >
          End Turn
        </button>
      )}
      {isMyTurn && !current_clue && (
        <p className="waiting-msg">Waiting for your spymaster's clue...</p>
      )}
      {!isMyTurn && (
        <p className="waiting-msg">Waiting for the other team...</p>
      )}
    </div>
  );
}
