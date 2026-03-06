import type { Player } from "../types/game";

interface PlayerListProps {
  players: Player[];
  showTeams?: boolean;
}

export default function PlayerList({
  players,
  showTeams = false,
}: PlayerListProps) {
  if (!showTeams) {
    return (
      <div className="player-list">
        {players.map((p) => (
          <div
            key={p.id}
            className={`player-chip ${p.connected ? "" : "disconnected"}`}
          >
            {p.name}
          </div>
        ))}
      </div>
    );
  }

  const red = players.filter((p) => p.team === "red");
  const blue = players.filter((p) => p.team === "blue");

  return (
    <div className="player-teams">
      <div className="team-column team-red">
        <h3>Red Team</h3>
        {red.map((p) => (
          <div
            key={p.id}
            className={`player-chip ${p.connected ? "" : "disconnected"}`}
          >
            {p.name}
            {p.role === "spymaster" && <span className="role-badge">SM</span>}
          </div>
        ))}
      </div>
      <div className="team-column team-blue">
        <h3>Blue Team</h3>
        {blue.map((p) => (
          <div
            key={p.id}
            className={`player-chip ${p.connected ? "" : "disconnected"}`}
          >
            {p.name}
            {p.role === "spymaster" && <span className="role-badge">SM</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
