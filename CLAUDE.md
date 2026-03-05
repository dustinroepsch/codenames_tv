# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jackbox-style Codenames: a host shares their screen on a TV, players join from phones via a 4-letter room code. Spymasters see the key card on their phone only; the host/TV view never reveals it.

## Commands

### Frontend (run from `codenames_frontend/`)

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npm test             # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
npx vitest run src/hooks/useGame.test.ts  # Run a single test file
```

### Backend (run from `codenames_backend/`)

```bash
cargo run            # Start server (http://localhost:3001)
cargo test           # Run all tests
cargo test game::tests::board_has_25_cards  # Run a single test by name
```

## Architecture

### Communication pattern

REST for room creation (`POST /rooms`, `GET /rooms/{code}`), WebSocket for everything else (`/ws/{code}?host=bool`). All game state flows through WebSocket as JSON messages.

The server broadcasts personalized state to each player using an envelope format: `"player_id|json"`. Host connections receive `"__host__|json"` — the host view never includes unrevealed card colors. Spymasters see true card colors; operatives and the host see all unrevealed cards as `neutral`.

### Backend (Rust/Axum/Tokio)

- **`main.rs`** — Axum router, CORS, REST handlers. `AppState` holds `RoomManager` + `RoomChannels`.
- **`models.rs`** — Core types (`Room`, `Player`, `Game`, `Card`, `GamePhase`, `Team`, `Role`, `CardColor`). `Room::state_for_player()` and `Room::state_for_host()` produce sanitized `RoomState` views.
- **`messages.rs`** — `ClientMessage` / `ServerMessage` enums with serde `{tag = "type", content = "payload"}` adjacently-tagged format.
- **`ws.rs`** — WebSocket handler. `handle_message()` is the core dispatcher for all game actions (join, clue, guess, turn management). Uses `broadcast::channel` per room.
- **`game.rs`** — Board generation (25 cards: 9/8/7/1 color split), team assignment, win condition checks.
- **`room_manager.rs`** — Thread-safe `Arc<Mutex<HashMap>>` room store. `with_room()` for atomic mutations.
- **`dictionary.rs`** — 400+ built-in words for padding player-submitted words to 25.

### Game phases

`Lobby` -> `WordSubmission` (60s timer) -> `Playing` -> `GameOver` (can loop back to Lobby via `PlayAgain`)

### Frontend (React 19 / TypeScript / Vite 7)

- **Routing**: react-router-dom — `/` (Home), `/host/:code` (TV view), `/play/:code` (phone view)
- **State management**: `GameContext` / `useGame` hook wraps a single WebSocket connection. All game state comes from server `RoomState` pushes — no client-side game logic.
- **`useWebSocket`** — Manages WebSocket lifecycle with auto-reconnect (2s delay). Parses `ServerMessage` JSON.
- **`api.ts`** — REST client + WS URL builder. Backend URL from `VITE_API_URL` env var, defaults to `http://localhost:3001`.
- **Host page** (`pages/Host.tsx`) — Phase-switching view: `HostLobby`, `HostWordSubmission`, `HostGameBoard`, `HostGameOver`
- **Play page** (`pages/Play.tsx`) — Player phone view. Has join form; player-side phase views are not yet implemented (Phase 4 TODO).
- **Testing**: Vitest + React Testing Library + jsdom. Test setup in `src/test/setup.ts`.

### Shared types

TypeScript types in `src/types/game.ts` mirror Rust models. Both use snake_case JSON serialization. When modifying the message protocol or models, update both `messages.rs`/`models.rs` and `types/game.ts`.

## Key Conventions

- All serde enums use `rename_all = "snake_case"` — TypeScript string unions match
- Room codes are always uppercase 4-letter strings
- Host connections are identified by `?host=true` query param, not by player ID
- The host is not a player — host WebSocket gets a separate `__host__` broadcast stream
- Frontend uses React Compiler (Babel plugin) — no manual `useMemo`/`useCallback` optimization needed for new code
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`
