# TASKS.md — Codenames Game Implementation Plan

## Implementation Strategy

The app follows a **Jackbox-style** model: one shared TV screen (host) + players on phones. This means two distinct view modes from a single frontend, connected via WebSockets to a Rust backend that manages all game state.

**Build order rationale:** Backend data models and API first, then frontend views. Each phase delivers a vertically testable slice so things can be validated incrementally.

---

## Phase 1: Backend Foundation

### 1.1 — Set up Rust web server with Axum
- Add dependencies: `axum`, `tokio`, `serde`, `serde_json`, `tower-http` (CORS)
- Create a basic HTTP server with a health-check endpoint (`GET /health`)
- Configure CORS to allow the Vite dev server origin

### 1.2 — Define core game data models
- `Room`: id, room_code (4-6 char), host player, list of players, game state enum, settings
- `Player`: id, display_name, team (Red/Blue/Unassigned), role (Spymaster/Operative/None)
- `Game`: board (5x5 grid), key_card (color assignments), current_turn (team), clue, guesses_remaining, revealed cards
- `Card`: word, color (Red/Blue/Neutral/Assassin), revealed flag
- `GamePhase` enum: `Lobby → WordSubmission → TeamAssignment → Playing → GameOver`
- Serialize everything with serde for JSON transport

### 1.3 — Room management (REST endpoints)
- `POST /rooms` — create a room, return room code
- `GET /rooms/:code` — get room info (for join validation)
- In-memory room store (`Arc<Mutex<HashMap>>` or `DashMap`) — no database needed initially
- Generate short unique room codes (4 uppercase letters)

### 1.4 — WebSocket connection layer
- `GET /ws/:room_code` — upgrade to WebSocket (via `axum::extract::ws`)
- On connect: player sends a join message with display name
- Broadcast room state updates to all connected clients
- Handle disconnects gracefully (mark player disconnected, allow rejoin)
- Define a message protocol: `{ type: "...", payload: {...} }` for both client→server and server→client

### 1.5 — Word submission phase
- Host triggers start → server moves phase to `WordSubmission`
- Server starts a configurable countdown timer (e.g., 60s)
- Players submit words via WebSocket message
- Server collects words, deduplicates, validates (non-empty, reasonable length)
- When timer expires (or host ends early): if < 25 words, pad from a built-in dictionary word list
- Select 25 words for the board

### 1.6 — Game setup logic
- Randomly split players into Red/Blue teams (roughly even)
- Randomly assign one Spymaster per team
- Generate key card: 9 cards for first team, 8 for second, 7 neutral, 1 assassin
- First team (with 9 cards) goes first
- Shuffle and assign words to the 5x5 grid
- Broadcast full game state (with key card only to spymasters)

### 1.7 — Game turn logic
- **Spymaster gives clue**: receives `{ type: "give_clue", word: "...", number: N }` — server validates (single word, number ≥ 0), broadcasts clue to all
- **Operatives guess**: receives `{ type: "guess", card_index: N }` — server reveals card, checks color:
  - Correct (own team color): guesses_remaining -= 1, team may continue (or stop voluntarily via `end_turn`)
  - Opponent color: card revealed, turn ends
  - Neutral: card revealed, turn ends
  - Assassin: card revealed, guessing team **loses immediately**
- Operatives can make up to `number + 1` guesses (or pass/end turn early)
- After each guess, check win conditions: team wins if all their cards are revealed
- Broadcast updated board state after each action

### 1.8 — Built-in dictionary word list
- Embed a list of 400+ simple, common English words (nouns preferred) as a static `&[&str]`
- Used to pad when players don't submit enough words
- Words should be fun/interesting for the game (avoid boring filler)

---

## Phase 2: Frontend — Shared Infrastructure

### 2.1 — WebSocket client hook and state management
- Create a `useWebSocket` hook: connect, send messages, receive messages, reconnect logic
- Create a `useGameState` hook or context: parse server messages, maintain local game state
- Use React Context (`GameContext`) to provide state to all components

### 2.2 — Routing and view detection
- Add `react-router-dom` for routing
- Routes: `/` (landing), `/host` (TV display), `/play/:roomCode` (player phone view)
- Responsive design: host view optimized for landscape/TV, player view optimized for portrait/mobile

### 2.3 — Landing / Home page
- "Host a Game" button → creates room via REST, navigates to `/host`
- "Join a Game" → input for room code, navigates to `/play/:roomCode`
- Clean, simple, bold design (readable from couch distance on TV)

---

## Phase 3: Frontend — Host (TV) Views

### 3.1 — Lobby screen (TV)
- Display room code prominently (large text for phone entry)
- Show list of connected players as they join
- "Start Game" button (enabled when ≥ 4 players connected)

### 3.2 — Word submission screen (TV)
- Show countdown timer
- Show count of words submitted (no spoilers on actual words)
- Animated/fun waiting state

### 3.3 — Game board screen (TV)
- 5x5 grid of word cards
- Cards show: word text, revealed state with team color
- Unrevealed cards are neutral/hidden color
- Display: current team's turn, current clue + number, guesses remaining
- Team scores (cards remaining for each team)
- Key card is **NOT** shown on TV (operatives can see TV)

### 3.4 — Game over screen (TV)
- Show winning team
- Reveal full key card / board
- "Play Again" button (returns to lobby with same players)

---

## Phase 4: Frontend — Player (Phone) Views

### 4.1 — Join screen (phone)
- Enter display name
- Connect to room via WebSocket
- Show waiting state after joining

### 4.2 — Word submission screen (phone)
- Text input to submit words
- Show list of words you've submitted
- Countdown timer visible
- Submit button for each word

### 4.3 — Spymaster view (phone)
- See the key card (which cards belong to which team)
- Input field: clue word + number
- Submit clue button (only active on your team's turn)
- Cannot tap cards to guess

### 4.4 — Operative view (phone)
- See the 5x5 board (words + revealed colors)
- Tap cards to guess (only active on your team's turn, after clue given)
- "End Turn" button to stop guessing early
- Current clue + guesses remaining displayed

### 4.5 — Game over view (phone)
- Show result (win/lose)
- Reveal key card
- "Play Again" acknowledgment

---

## Phase 5: Polish & Completeness

### 5.1 — Error handling and edge cases
- Player disconnect/reconnect (rejoin with same name + room code)
- Room expiry / cleanup (remove rooms after inactivity)
- Handle invalid moves (server-side validation, return errors)
- Handle race conditions (two players guessing simultaneously)

### 5.2 — Timer and animations
- Animated card reveals
- Turn transition effects
- Word submission countdown with visual urgency

### 5.3 — Mobile UX polish
- Touch-friendly tap targets
- Prevent zoom/scroll issues on mobile browsers
- Viewport meta tags, full-screen capable

### 5.4 — Audio/visual feedback (stretch)
- Sound effects for card reveals, turn changes, game over
- Visual flair for assassin reveal

---

## Dependency Graph

```
Phase 1 (Backend) has no frontend dependencies — can be built and tested standalone.

1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
                           ↑
                          1.8 (dictionary can be added anytime before 1.5)

Phase 2 depends on 1.3 + 1.4 (needs REST + WebSocket endpoints to connect to)
Phase 3 depends on Phase 2 (shared infra)
Phase 4 depends on Phase 2 (shared infra)
Phase 3 and Phase 4 can be built in parallel.
Phase 5 depends on Phases 3 + 4.
```
