# Codenames

A Jackbox-style web implementation of the board game [Codenames](https://en.wikipedia.org/wiki/Codenames_(board_game)). One player hosts on a TV/shared screen, and everyone else joins from their phones using a room code.

## How It Works

1. **Host** creates a room and shares their screen to a TV
2. **Players** join from their phones by entering the 4-letter room code
3. Host starts the game once 4+ players are connected
4. Players submit words on a timer — these become the board words (padded from a built-in dictionary if needed)
5. Teams and spymasters are assigned randomly
6. Play Codenames — spymasters give clues, operatives guess cards

The host/TV screen never reveals the key card, so it's safe for everyone to see. Spymasters see the key card on their phone only.

## Tech Stack

| | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 7 |
| **Backend** | Rust, Axum, Tokio |
| **Communication** | WebSocket (real-time) + REST (room creation) |
| **Storage** | In-memory (no database) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)

### Run the backend

```bash
cd codenames_backend
cargo run
```

The server starts on `http://localhost:3001`.

### Run the frontend

```bash
cd codenames_frontend
npm install
npm run dev
```

The dev server starts on `http://localhost:5173`.

### Run tests

```bash
# Backend (58 tests)
cd codenames_backend
cargo test

# Frontend (45 tests)
cd codenames_frontend
npm test
```

## Project Structure

```
codenames_backend/
  src/
    main.rs           # Axum server, routes, CORS
    models.rs         # Room, Player, Game, Card types
    game.rs           # Board generation, team assignment, win conditions
    ws.rs             # WebSocket handler, message routing, game actions
    messages.rs       # Client/server message protocol
    dictionary.rs     # 400+ built-in words
    room_manager.rs   # Thread-safe in-memory room store

codenames_frontend/
  src/
    api.ts            # REST client + WebSocket URL builder
    types/game.ts     # TypeScript types matching backend models
    hooks/            # useWebSocket, useGame
    context/          # GameContext provider
    components/       # Board, PlayerList, ScoreBar, Host phase views
    pages/            # Home, Host (TV), Play (phone)
```

## Game Rules

- 25 word cards arranged in a 5x5 grid
- One team has 9 cards, the other has 8, plus 7 neutral and 1 assassin
- The team with 9 cards goes first
- **Spymasters** give a one-word clue and a number indicating how many cards match
- **Operatives** guess cards — correct guesses let them continue, wrong color or neutral ends the turn
- Hitting the **assassin** card = instant loss
- First team to reveal all their cards wins
