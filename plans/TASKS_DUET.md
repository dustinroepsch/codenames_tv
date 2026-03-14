# TASKS_DUET.md — Codenames Duet Implementation Tasks

## Overview

Add Codenames Duet as a selectable game mode alongside the existing Classic mode. The host picks the mode in the lobby before starting. All existing Classic functionality must continue to work unchanged.

**Build order rationale:** Backend model/logic changes first (testable with `cargo test` in isolation), then frontend types, then UI. Each task is a small, testable increment.

---

## Phase D1: Backend Models & Enums

### D1.1 — Add `GameMode` enum and `CardColor::Green`
- [ ] Add `GameMode` enum (`Classic`, `Duet`) to `models.rs` with `#[serde(rename_all = "snake_case")]`
- [ ] Add `CardColor::Green` variant to the existing `CardColor` enum (models.rs:44)
- [ ] Add `game_mode: GameMode` field to `Room` (models.rs:89), defaulting to `Classic` in `Room::new()` (models.rs:102)
- [ ] Update the `card_color_roundtrips` test (models.rs:439) to include `CardColor::Green` in the iteration
- [ ] Tests: `GameMode` serde round-trip, `CardColor::Green` serde round-trip

### D1.2 — Add Duet fields to `Game` and `RoomState`
- [ ] Add to `Game` (models.rs:78):
  - `duet_colors: Option<(Vec<CardColor>, Vec<CardColor>)>` — **must have `#[serde(skip)]`** to prevent leaking key card data (even though `Game` isn't sent directly to clients, this is defensive)
  - `timer_tokens: Option<u8>`
  - `greens_remaining: Option<u8>`
  - `sudden_death: Option<bool>`
  - `duet_won: Option<bool>` — needed because `winner: Option<Team>` cannot express a cooperative win/loss
- [ ] Initialize all new `Game` fields to `None` in the sole production construction site: `start_game()` in ws.rs:548
- [ ] Update the test helper `make_room_with_game()` in models.rs:274 to include the new fields (all `None`)
- [ ] Add to `RoomState` (models.rs:196):
  - `game_mode: GameMode`
  - `timer_tokens: Option<u8>`
  - `greens_remaining: Option<u8>`
  - `sudden_death: Option<bool>`
  - `duet_won: Option<bool>`
- [ ] Populate new `RoomState` fields in both `state_for_player()` (models.rs:121) and `state_for_host()` (models.rs:160):
  - `game_mode` from `self.game_mode`
  - `timer_tokens`, `greens_remaining`, `sudden_death`, `duet_won` from `self.game` fields
- [ ] Update the `room_state_serializes_to_json` test (models.rs:453) — deserialization will fail without the new fields in the test fixture
- [ ] Tests: existing model tests still pass, new fields serialize correctly

### D1.3 — Add `SetGameMode` client message
- [ ] Add `SetGameMode { mode: GameMode }` variant to `ClientMessage` in messages.rs:6
- [ ] Note: `ClientMessage` uses `#[serde(tag = "type", content = "payload", rename_all = "snake_case")]` adjacently-tagged format
- [ ] Tests: deserialize `{"type":"set_game_mode","payload":{"mode":"duet"}}` and `"classic"` variant

### D1.4 — Update `state_for_player` for Duet visibility
- [ ] In `state_for_player()` (models.rs:121), when `self.game_mode == GameMode::Duet`:
  - Determine player's side from `player.team` (`Team::Red` = Side A, `Team::Blue` = Side B)
  - Look up the player's side colors from `game.duet_colors` (side A = `.0`, side B = `.1`)
  - For unrevealed cards: show the player's own side color (green, assassin, or neutral) — **both clue-giver and guesser always see their own side's key**
  - For revealed cards: show the card's stored `color` (set to Green/Neutral/Assassin at reveal time in ws.rs)
- [ ] Classic path unchanged: existing `is_spymaster` logic (models.rs:123-141)
- [ ] `state_for_host()` (models.rs:160) needs no Duet-specific change — host always sees unrevealed cards as neutral
- [ ] Tests: Duet side-A player sees their greens/assassins on unrevealed cards, side-B player sees different greens/assassins, both see revealed cards' true colors, host sees nothing unrevealed

---

## Phase D2: Duet Board Generation

### D2.1 — Extract shared word preparation logic
- [ ] Extract word dedup/padding/shuffle logic from `build_board()` (game.rs:7-23) into a shared helper:
  ```rust
  fn prepare_words(submitted_words: &[String]) -> Vec<String>
  ```
  Returns 25 shuffled words (deduped, padded from dictionary, truncated to 25)
- [ ] Refactor `build_board()` to call `prepare_words()` — no behavior change
- [ ] Tests: all existing `build_board` tests still pass

### D2.2 — Implement `build_duet_board()`
- [ ] New function in `game.rs`:
  ```rust
  pub fn build_duet_board(submitted_words: &[String]) -> (Vec<Card>, Vec<CardColor>, Vec<CardColor>)
  ```
  Returns (board, side_a_colors, side_b_colors)
- [ ] Use `prepare_words()` for word selection
- [ ] Generate dual-sided color assignment following the official distribution:
  | Side A | Side B | Count |
  |--------|--------|-------|
  | Green | Green | 3 |
  | Green | Neutral | 5 |
  | Green | Assassin | 1 |
  | Neutral | Green | 5 |
  | Assassin | Green | 1 |
  | Assassin | Assassin | 1 |
  | Assassin | Neutral | 1 |
  | Neutral | Assassin | 1 |
  | Neutral | Neutral | 7 |
  Totals: 9 green/3 assassin/13 neutral per side, 15 unique greens ✓
- [ ] All cards start with `color: CardColor::Neutral` and `revealed: false`
- [ ] Shuffle position assignments randomly
- [ ] Tests: board has 25 cards; side A has 9 green, 3 assassin, 13 neutral; side B has 9 green, 3 assassin, 13 neutral; 15 unique greens across both sides (positions green on at least one side); all cards start unrevealed; cards start with `color: Neutral`

### D2.3 — Implement `assign_duet_sides()`
- [ ] New function in `game.rs`:
  ```rust
  pub fn assign_duet_sides(players: &mut HashMap<String, Player>)
  ```
- [ ] Randomly split connected players into two sides (`Team::Red` = Side A, `Team::Blue` = Side B)
- [ ] All players get `role: None` — no spymaster/operative distinction in Duet
- [ ] Minimum 1 player per side (with 2+ connected players, integer division guarantees this)
- [ ] Skip disconnected players (same filter as `assign_teams()`: `p.connected`)
- [ ] Tests: all connected players assigned to a team, at least 1 per side, disconnected players skipped, all roles are `None`

### D2.4 — Implement `check_duet_winner()`
- [ ] New function in `game.rs`:
  ```rust
  pub fn check_duet_winner(board: &[Card], side_a: &[CardColor], side_b: &[CardColor]) -> bool
  ```
- [ ] Returns `true` when every position that is green on either side has `revealed == true`
- [ ] Tests: not won when greens remain, won when all 15 revealed, partial reveals not a win

---

## Phase D3: Duet WebSocket / Game Logic

### D3.1 — Handle `SetGameMode` message
- [ ] In `ws.rs` `handle_message` (ws.rs:174), add `ClientMessage::SetGameMode { mode }` arm
- [ ] Only host can set mode (`is_host` check, same pattern as `StartWordSubmission`)
- [ ] Only in Lobby phase (`room.phase == GamePhase::Lobby`)
- [ ] Store `mode` on `room.game_mode`
- [ ] Broadcast state after setting
- [ ] Tests: host can set mode, non-host rejected with error, rejected outside lobby

### D3.2 — Update `StartWordSubmission` for Duet player minimum
- [ ] In `StartWordSubmission` handler (ws.rs:246), change the player count check:
  - Current: `room.player_count() < 4` (ws.rs:251) — hardcoded
  - New: `room.player_count() < if room.game_mode == GameMode::Duet { 2 } else { 4 }`
- [ ] Update the error message (ws.rs:283) to reflect the mode-specific minimum
- [ ] Note: `player_count()` counts ALL players including disconnected — this is pre-existing behavior, not a Duet concern
- [ ] Tests: Duet allows start with 2 players, Duet rejects <2, classic still rejects <4

### D3.3 — Update `start_game` for Duet setup
- [ ] Branch on `room.game_mode` in `start_game()` (ws.rs:534)
- [ ] **Duet path**:
  - Call `game::build_duet_board(&room.submitted_words)` → `(board, side_a, side_b)`
  - Call `game::assign_duet_sides(&mut room.players)`
  - Pick a random starting side: `if rand::random::<bool>() { Team::Red } else { Team::Blue }`
  - Construct `Game` with: `duet_colors: Some((side_a, side_b))`, `timer_tokens: Some(9)`, `greens_remaining: Some(15)`, `sudden_death: Some(false)`, `duet_won: None`, `winner: None`, `losing_team: None`, `current_clue: None`, `guesses_remaining: None`
- [ ] **Classic path**: unchanged (ws.rs:537-556), new fields all `None`
- [ ] Tests: Duet game initializes with correct fields, classic game unchanged

### D3.4 — Update `GiveClue` for Duet
- [ ] In `GiveClue` handler (ws.rs:334), when `room.game_mode == GameMode::Duet`:
  - Check `player.team == Some(game.current_turn)` — any player on the clue-giving side can give a clue
  - **Skip** the `player.role != Some(Role::Spymaster)` check (ws.rs:353) — players have no roles in Duet
  - Set `guesses_remaining = None` (unlimited guesses in Duet — no `number + 1` cap)
  - Reject if `game.sudden_death == Some(true)` — no clues allowed in sudden death
- [ ] Classic path: unchanged (role + team checks remain)
- [ ] Tests: any side-A player can give clue on side-A's turn, side-B player rejected, clue broadcasts correctly, rejected during sudden death

### D3.5 — Update `Guess` for Duet
- [ ] In `Guess` handler (ws.rs:392), when `room.game_mode == GameMode::Duet`:
  - **Role check**: skip `player.role != Some(Role::Operative)` (ws.rs:410) — no roles in Duet
  - **Turn check**: guesser must be on the **opposite** side from `current_turn` (ws.rs:413 currently checks same team)
  - **Clue check**: skip `game.current_clue.is_none()` check (ws.rs:402) when `game.sudden_death == Some(true)` — no clue in sudden death
  - **Card identity resolution**: look up color from `duet_colors` using the clue-giver's side:
    ```rust
    let (ref side_a, ref side_b) = duet_colors;
    let card_color = if game.current_turn == Team::Red { &side_a[idx] } else { &side_b[idx] };
    ```
  - **Green (agent)**: set `card.color = CardColor::Green`, `card.revealed = true`. Decrement `greens_remaining`. If `greens_remaining == 0` → set `duet_won = Some(true)`, `phase = GameOver`. Otherwise continue guessing.
  - **Neutral (bystander)**: set `card.revealed = true` (color stays `Neutral`). Decrement `timer_tokens`. Swap `current_turn`. Clear `current_clue`. If `timer_tokens == 0` → set `sudden_death = Some(true)`.
  - **Assassin**: set `card.color = CardColor::Assassin`, `card.revealed = true`. Set `duet_won = Some(false)`, `phase = GameOver`.
- [ ] **Sudden death guess** (when `game.sudden_death == Some(true)`):
  - Any player from **either** side can guess (no turn/side restriction)
  - Green: same as above (reveal, decrement, check win)
  - Neutral or Assassin: set `duet_won = Some(false)`, `phase = GameOver` — any wrong guess loses
- [ ] Classic path: unchanged (ws.rs:424-472)
- [ ] Tests: correct green guess continues turn, bystander ends turn and costs token, assassin ends game with `duet_won = false`, win when last green found with `duet_won = true`, sudden death correct guess works, sudden death bystander loses, sudden death assassin loses

### D3.6 — Update `EndTurn` for Duet
- [ ] In `EndTurn` handler (ws.rs:490), when `room.game_mode == GameMode::Duet`:
  - **Skip** `player.role == Some(Role::Operative)` check (ws.rs:498) — no roles in Duet
  - Check guesser is on the **opposite** side from `current_turn` (ws.rs:497 currently checks same team)
  - Reject if `game.sudden_death == Some(true)` — must guess in sudden death, can't end turn
  - Decrement `timer_tokens` (voluntary stop costs 1 token)
  - Swap `current_turn`, clear `current_clue`
  - If `timer_tokens == 0` → set `sudden_death = Some(true)`
- [ ] Classic path: unchanged
- [ ] Tests: end turn costs a token, side swaps, sudden death entered at 0 tokens, rejected during sudden death

### D3.7 — Update `PlayAgain` for Duet
- [ ] `PlayAgain` handler (ws.rs:510) already sets `room.game = None` and clears player teams/roles — this naturally clears all Duet game state
- [ ] `room.game_mode` lives on `Room` (not `Game`) and is **not** reset by `PlayAgain` — room stays in the same mode for replay
- [ ] No code changes needed beyond ensuring the field exists on `Room` (done in D1.1)
- [ ] Tests: play again resets game but `game_mode` is preserved

---

## Phase D4: Frontend Types

### D4.1 — Update TypeScript types
- [ ] In `types/game.ts`:
  - Add `export type GameMode = "classic" | "duet";`
  - Add `"green"` to `CardColor` union (currently: `"red" | "blue" | "neutral" | "assassin"`)
  - Add to `RoomState` interface: `game_mode: GameMode`, `timer_tokens: number | null`, `greens_remaining: number | null`, `sudden_death: boolean | null`, `duet_won: boolean | null`
  - Add to `ClientMessage` union: `| { type: "set_game_mode"; payload: { mode: GameMode } }`
- [ ] Update **all frontend test fixtures** that construct `RoomState` objects — they now require `game_mode`, `timer_tokens`, `greens_remaining`, `sudden_death`, `duet_won` fields. Files with test fixtures:
  - `src/pages/Play.test.tsx`
  - `src/pages/Home.test.tsx`
  - `src/pages/Host.test.tsx`
  - `src/components/PlayerLobby.test.tsx`
  - `src/components/PlayerSpymaster.test.tsx`
  - `src/components/PlayerOperative.test.tsx`
  - `src/components/PlayerWordSubmission.test.tsx`
  - `src/components/PlayerGameOver.test.tsx`
  - `src/hooks/useGame.test.ts`
- [ ] Verify no TypeScript build errors (`npm run build`) and all 92 existing tests pass (`npm test`)

---

## Phase D5: Frontend — Lobby

### D5.1 — Host Lobby mode selector
- [ ] In `HostLobby.tsx` (currently has `const canStart = roomState.players.length >= 4` at line 11):
  - Add Classic/Duet toggle or button group
  - Send `{ type: "set_game_mode", payload: { mode } }` when host changes selection
  - Make `canStart` dynamic: `roomState.players.length >= (roomState.game_mode === "duet" ? 2 : 4)`
  - Update waiting message: "Waiting for at least N players..." where N depends on mode
- [ ] Tests: mode toggle renders, sends correct message, button enabled at 2 players for duet, disabled at 3 players for classic

### D5.2 — Player Lobby mode display
- [ ] In `PlayerLobby.tsx` (currently shows no mode info):
  - Show the selected game mode (e.g., "Mode: Codenames Duet" or "Mode: Classic")
  - Read from `roomState.game_mode`
- [ ] Tests: mode label renders for both modes

---

## Phase D6: Frontend — Duet Game Board (Host/TV)

### D6.1 — `DuetStatusBar` component
- [ ] New file: `src/components/DuetStatusBar.tsx`
- [ ] Props: `timerTokens: number`, `greensRemaining: number`, `suddenDeath: boolean`
- [ ] Display: timer tokens remaining (count or visual icons), agents found (15 - greensRemaining) / 15
- [ ] Highlight sudden death state with warning styling
- [ ] Tests: renders token count, renders progress, shows sudden death indicator

### D6.2 — Update `HostGameBoard` for Duet
- [ ] In `HostGameBoard.tsx` (currently renders `ScoreBar` at line 17):
  - When `roomState.game_mode === "duet"`: render `DuetStatusBar` instead of `ScoreBar`
  - Show which side is giving the clue (e.g., "Side A's turn to give a clue")
  - Show current clue (same display as classic)
  - In sudden death: show "SUDDEN DEATH" indicator, no turn info
- [ ] Classic path: unchanged
- [ ] Tests: duet mode renders DuetStatusBar, classic renders ScoreBar

### D6.3 — Update `HostGameOver` for Duet
- [ ] In `HostGameOver.tsx` (currently references `winner` and `losing_team`):
  - When `roomState.game_mode === "duet"`:
    - `duet_won === true`: "MISSION COMPLETE!" with green styling
    - `duet_won === false`: "MISSION FAILED" with lose reason — check if any assassin card was revealed to distinguish assassin loss from timeout loss
  - Play Again button works the same
- [ ] Classic path: unchanged (uses `winner`/`losing_team`)
- [ ] Tests: duet win/lose messages render correctly

---

## Phase D7: Frontend — Duet Player Views (Phone)

### D7.1 — `DuetClueGiver` component
- [ ] New file: `src/components/DuetClueGiver.tsx`
- [ ] Props: `roomState: RoomState`, `send: (msg: ClientMessage) => void`, `playerId: string`
- [ ] Board with `showColors={true}` — `state_for_player` already provides the player's own side colors
- [ ] Clue input form (word + number picker) — reuse same UX pattern as `PlayerSpymaster.tsx` clue form (lines 27-48)
- [ ] `DuetStatusBar` showing timer tokens + greens remaining
- [ ] Cooperative framing: "Your turn to give a clue" (no red/blue team branding)
- [ ] Form disabled when it's the other side's turn (`player.team !== current_turn`)
- [ ] Tests: renders board with colors, clue form submits `give_clue` message, disabled when not your turn

### D7.2 — `DuetGuesser` component
- [ ] New file: `src/components/DuetGuesser.tsx`
- [ ] Props: `roomState: RoomState`, `send: (msg: ClientMessage) => void`, `playerId: string`
- [ ] Board with `showColors={true}` — guesser **always sees their own side's key** (differs from classic where operatives see no colors)
- [ ] Cards interactive (clickable) when it's your turn to guess (`player.team !== current_turn` and `current_clue` exists)
- [ ] "End Turn" button with note that it costs a timer token
- [ ] Current clue display
- [ ] `DuetStatusBar`
- [ ] Tests: cards clickable when guessing, `guess` message sent on click, `end_turn` message sent, disabled when not your turn

### D7.3 — `DuetSuddenDeath` component (or mode within guesser)
- [ ] New file: `src/components/DuetSuddenDeath.tsx` (or render as a mode inside `DuetGuesser`)
- [ ] Board with `showColors={true}` — both sides see their own key
- [ ] Any player can tap a card (no turn restriction) — `interactive={true}` for all
- [ ] No clue displayed, no "End Turn" button
- [ ] "SUDDEN DEATH" warning banner — one wrong guess loses
- [ ] `DuetStatusBar` with `suddenDeath={true}`
- [ ] Tests: both sides can interact, warning shown, no clue or end-turn controls

### D7.4 — Update `Play.tsx` routing for Duet
- [ ] In `Play.tsx` (lines 112-136), the `"playing"` case currently routes on `player?.role === "spymaster"`:
  - Add outer branch: `if (roomState.game_mode === "duet")`
  - Duet routing:
    - If `roomState.sudden_death`: render `DuetSuddenDeath`
    - Else if `player.team === roomState.current_turn`: render `DuetClueGiver`
    - Else: render `DuetGuesser`
  - Classic routing: unchanged (role-based spymaster/operative)
- [ ] Tests: correct component rendered based on mode, side, turn, and sudden death

### D7.5 — Update `PlayerGameOver` for Duet
- [ ] In `PlayerGameOver.tsx` (currently uses `winner`/`losing_team`/`player.team === winner`):
  - When `roomState.game_mode === "duet"`:
    - `duet_won === true`: "MISSION COMPLETE!" — all players win together
    - `duet_won === false`: "MISSION FAILED" with reason
    - No individual win/lose check (no `player.team === winner`)
  - Board revealed (same as classic)
- [ ] Classic path: unchanged
- [ ] Tests: duet win/lose cooperative messages render

---

## Phase D8: Board & CSS

### D8.1 — Add `card-green` styling
- [ ] In `src/index.css` (card color classes are at lines 419-447):
  - Add `.card-green` class with green agent color (e.g., `background: #27ae60; border-color: #27ae60; color: white;`)
  - Add `--green: #27ae60;` to `:root` CSS variables (line 9-18)
- [ ] Board component (`Board.tsx` line 28) already generates `card-${card.color}` dynamically — `card-green` will work automatically
- [ ] Tests: green cards render with `card-green` class

### D8.2 — Duet-specific styles
- [ ] In `src/index.css`:
  - Style `DuetStatusBar` (token display, progress bar)
  - Style sudden death warning banner (red/urgent)
  - Style cooperative game-over screens (green background for win, dark/red for lose)
- [ ] Ensure mobile-friendly sizing for all new components (match existing `.player-spymaster` / `.player-operative` patterns)

---

## Phase D9: Integration Testing & Polish

### D9.1 — Backend integration tests
- [ ] Full Duet game flow: lobby → set mode → word submission → start → clue → guess (green, correct) → guess (bystander, turn ends) → token spent → turn swap → clue → guess remaining greens → win (`duet_won = true`)
- [ ] Assassin loss flow: `duet_won = Some(false)`, `phase = GameOver`
- [ ] Sudden death entry: timer tokens reach 0 → `sudden_death = true`
- [ ] Sudden death win: guess all remaining greens
- [ ] Sudden death loss: guess a bystander → `duet_won = false`
- [ ] Mode switching in lobby: set to duet, set back to classic, set to duet again
- [ ] Classic mode regression: all existing 62 backend tests pass unchanged

### D9.2 — Frontend integration tests
- [ ] Duet lobby flow: mode selection → player count validation → start
- [ ] Duet playing flow: clue-giver sees their key (`showColors`), guesser sees their own key, cards reveal correctly
- [ ] Game over screens for both win and lose
- [ ] Classic mode regression: all existing 92 frontend tests pass unchanged

### D9.3 — Cross-mode regression
- [ ] Run full `cargo test` — all backend tests pass (62 existing + new Duet tests)
- [ ] Run full `npm test` — all frontend tests pass (92 existing + new Duet tests)
- [ ] Manual smoke test: play a Classic game end-to-end, play a Duet game end-to-end

---

## Dependency Graph

```
D1.1 → D1.2 → D1.3 (can parallel with D1.2)
                 ↓
               D1.4
                 ↓
        D2.1 → D2.2 → D2.3 → D2.4
                                 ↓
        D3.1 → D3.2 → D3.3 → D3.4 → D3.5 → D3.6 → D3.7
                                                       ↓
        D4.1 (can start after D1.2 types are finalized)
          ↓
        D5.1 + D5.2 (parallel, depend on D4.1)
          ↓
        D6.1 → D6.2 → D6.3 (host views, depend on D4.1)
        D7.1 → D7.2 → D7.3 → D7.4 → D7.5 (player views, depend on D4.1)
        D8.1 + D8.2 (CSS, can parallel with D6/D7)
          ↓
        D9.1 → D9.2 → D9.3 (all above complete)
```

**Critical path:** D1.1 → D1.2 → D1.4 → D2.1 → D2.2 → D3.3 → D3.5 → D4.1 → D7.4 → D9.3

Backend phases (D1–D3) can be fully built and tested with `cargo test` before any frontend work begins.
Frontend host views (D6) and player views (D7) can be built in parallel.
CSS (D8) can be done alongside D6/D7.

---

## Key Design Decisions Reference

| Decision | Rationale |
|---|---|
| Reuse `Team::Red`/`Team::Blue` for sides | Avoids adding a new `Side` enum; maps cleanly to existing turn/player infrastructure |
| `duet_colors` on `Game` with `#[serde(skip)]` | Keeps dual-sided key server-only; `state_for_player` computes per-player view |
| `duet_won: Option<bool>` separate from `winner` | `winner: Option<Team>` can't express cooperative outcomes; Duet checks `duet_won`, Classic checks `winner` |
| Both clue-giver and guesser see their own side's key | Per official rules; differs from classic where operatives see no colors |
| `role: None` for all Duet players | No spymaster/operative distinction; all players on a side are equal |
| Extract `prepare_words()` helper | Avoids duplicating word dedup/padding logic between `build_board` and `build_duet_board` |
