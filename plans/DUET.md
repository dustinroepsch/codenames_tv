# Codenames Duet — Implementation Plan

## Duet Rules Summary

Codenames Duet is a **cooperative** 2+ player variant. Players sit on opposite sides of a double-sided key card. Each side shows 9 green (agent) words and 3 black (assassin) words. Together there are **15 unique green words** to find (3 overlap between sides). Players take turns giving clues and guessing, spending timer tokens each turn. Win by finding all 15 greens before tokens run out; lose by touching an assassin or running out of turns.

### Key Card Structure (25 cards)
- Side A: 9 green, 3 black, 13 bystander (tan)
- Side B: 9 green, 3 black, 13 bystander (tan)
- Overlaps: 3 green/green, 1 black/black, 1 green-A/black-B, 1 black-A/green-B, 1 black-A/tan-B, 1 tan-A/black-B
- Net: **15 unique greens**, **5 unique assassins** (but only 3 visible per side)

### Turn Flow
1. One player gives a clue (word + number)
2. Partner guesses by touching cards (identity based on clue-giver's side only)
   - **Green on clue-giver's side**: correct, cover with agent card, may continue guessing (unlimited correct guesses)
   - **Bystander**: incorrect, turn ends. Clue-giver places a timer token on the word
   - **Assassin**: game over — both lose immediately
3. Guesser may stop voluntarily by taking a timer token from the bank
4. Each turn costs exactly 1 timer token (either from bystander hit or voluntary stop)
5. Players alternate clue-giving (loosely enforced; can give 2 in a row but shouldn't do all from one side)

### Timer Tokens & Sudden Death
- Standard game: **9 timer tokens** in the time bank
- When all tokens used without winning: **sudden death** — both players may guess (no clue), but any incorrect guess = lose
- Mission map offers different token counts (7–11) and allowed-mistake limits for difficulty

### Win/Lose
- **Win**: All 15 green words found
- **Lose**: Touch an assassin OR run out of tokens without finding all greens (or incorrect guess in sudden death)

---

## Design Decisions

### Mapping Duet to the Existing Architecture

The current codebase uses `Team` (Red/Blue) with `Role` (Spymaster/Operative). For Duet we reuse `Team` to represent **sides of the key card**:

| Classic Concept | Duet Equivalent |
|---|---|
| Team Red / Blue | Side A / Side B (still use `Team::Red` / `Team::Blue` internally) |
| Spymaster | Clue-giver (the side whose turn it is) |
| Operative | Guesser (the other side) |
| Competitive teams | Cooperative — both sides work together |
| 9/8/7/1 card split | Dual-sided key: each card has a color per side |
| `winner: Team` | `winner: None` (cooperative) or use a `duet_won: bool` flag |

### Card Model for Duet

Each card needs **two colors** (one per side of the key card). Options:

**Chosen approach**: Add a `duet_colors` field to `Game` — a parallel `Vec<(CardColor, CardColor)>` storing the true colors for side A and side B. The existing `Card.color` field continues to represent what the **current viewer** should see (computed per-player in `state_for_player`). This avoids changing the `Card` struct that's serialized to clients.

### State Visibility in Duet

- **Side A player** (clue-giver): sees their 9 greens and 3 assassins. Bystanders shown as neutral.
- **Side B player** (guesser): sees the board but does NOT see either side's key — unrevealed cards appear neutral. They guess based on the clue only.
- **Host/TV**: never sees any key colors (same as classic).
- When roles swap (Side B gives clue), Side B sees their greens/assassins, Side A sees neutral.

Wait — actually re-reading the rules: both players **always** see their own side of the key card. The clue-giver sees their side to give clues, and the guesser also sees their own side (which helps them avoid their own assassins, but the identity of a guessed card depends on the clue-giver's side). So:

- **Each player always sees their own side's greens and assassins** (like a spymaster)
- **Guesses are resolved against the clue-giver's side**
- Players must avoid guessing words that are assassins on the clue-giver's side (which they can't see)

This is a key difference from classic mode where operatives can't see any colors.

### Minimum Player Count

- Classic: 4 players minimum (2 per team)
- Duet: **2 players minimum** (1 per side), but supports more split across two sides

---

## Implementation Phases

### Phase D1: Backend Model Changes

**Files**: `models.rs`, `game.rs`, `messages.rs`

1. **Add `GameMode` enum**
   ```rust
   #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
   #[serde(rename_all = "snake_case")]
   pub enum GameMode {
       Classic,
       Duet,
   }
   ```

2. **Add `game_mode` to `Room`**
   ```rust
   pub struct Room {
       // ... existing fields ...
       pub game_mode: GameMode,  // default Classic
   }
   ```

3. **Add Duet-specific fields to `Game`**
   ```rust
   pub struct Game {
       // ... existing fields ...
       /// For Duet: parallel color arrays for each side. Index matches board index.
       pub duet_colors: Option<(Vec<CardColor>, Vec<CardColor>)>,
       /// Timer tokens remaining in the time bank (Duet only).
       pub timer_tokens: Option<u8>,
       /// Number of green agents remaining to find (Duet only, out of 15).
       pub greens_remaining: Option<u8>,
       /// Whether the game is in sudden death (Duet only).
       pub sudden_death: Option<bool>,
   }
   ```

4. **Add `CardColor::Green`** for Duet agent cards
   ```rust
   pub enum CardColor {
       Red,
       Blue,
       Neutral,
       Assassin,
       Green,  // Duet cooperative agent
   }
   ```

5. **Add `game_mode` and duet fields to `RoomState`**
   ```rust
   pub struct RoomState {
       // ... existing fields ...
       pub game_mode: GameMode,
       pub timer_tokens: Option<u8>,
       pub greens_remaining: Option<u8>,
       pub sudden_death: Option<bool>,
   }
   ```

6. **Update `state_for_player` for Duet**
   - Determine which side the player is on (Team::Red = Side A, Team::Blue = Side B)
   - Show the player their own side's colors: green for their greens, assassin for their assassins, neutral for bystanders
   - Revealed cards show `Green` if they were a correct agent, `Neutral` for bystanders, `Assassin` if assassin was hit

7. **New `ClientMessage` variant**
   ```rust
   /// Host selects game mode (in lobby).
   SetGameMode { mode: GameMode },
   ```

### Phase D2: Duet Board Generation

**File**: `game.rs`

1. **`build_duet_board()`** — generates 25 cards with dual-sided key
   - Returns `(Vec<Card>, Vec<CardColor>, Vec<CardColor>)` — board + side_a_colors + side_b_colors
   - All cards start with `color: CardColor::Neutral` (hidden)
   - Color distribution follows the official pattern:
     - 3 positions: green/green (both sides)
     - 5 positions: green-A only (bystander on B)
     - 1 position: green-A, black-B
     - 5 positions: green-B only (bystander on A)
     - 1 position: black-A, green-B
     - 1 position: black/black (both sides)
     - 1 position: black-A, bystander-B
     - 1 position: bystander-A, black-B
     - 7 positions: bystander/bystander (both sides)
   - Total: 9 green per side, 3 black per side, 13 bystander per side ✓
   - Total unique greens: 3 + 5 + 1 + 5 + 1 = 15 ✓

2. **`assign_duet_sides()`** — assign players to sides
   - Randomly split connected players into two sides (Team::Red = Side A, Team::Blue = Side B)
   - No spymaster/operative distinction — all players have `role: None` (or a new `Role::Agent`)
   - Minimum 1 player per side

3. **`check_duet_winner()`** — check if all 15 greens have been found
   - Count remaining greens across both side arrays for unrevealed cards

### Phase D3: Duet Game Logic

**File**: `ws.rs`

1. **`handle_message` changes for Duet**

   - **`SetGameMode`**: host sets mode before starting. Stored on `Room`.

   - **`StartWordSubmission`**: allow 2+ players for Duet (currently requires 4).

   - **`start_game`**: branch on `room.game_mode`:
     - Classic: existing logic
     - Duet: call `build_duet_board()`, `assign_duet_sides()`, set `timer_tokens = 9`, `greens_remaining = 15`, pick a random starting side

   - **`GiveClue`**: In Duet:
     - Any player on the current turn's side can give the clue
     - All players are effectively "spymasters" for their own side
     - Skip the `player.role == Spymaster` check; instead check `player.team == current_turn`
     - `guesses_remaining` is **unlimited** in Duet (no number+1 cap — players guess until they miss or stop)

   - **`Guess`**: In Duet:
     - Any player on the **opposite** side from `current_turn` can guess
     - Card identity resolved against **clue-giver's side** (`duet_colors[current_turn_side][card_index]`)
     - **Green**: reveal card as green, decrement `greens_remaining`. If 0 → win! Continue guessing.
     - **Bystander**: reveal card. Turn ends. Decrement `timer_tokens`. Place token on card.
     - **Assassin**: reveal card as assassin. Game over — lose.
     - If `timer_tokens` reaches 0 and greens remain → enter sudden death

   - **`EndTurn`**: In Duet:
     - Guesser stops voluntarily → decrement `timer_tokens` (costs 1 token to stop)
     - Swap `current_turn` to other side
     - If `timer_tokens` reaches 0 → enter sudden death
     - Must guess at least 1 before ending turn? (Rules say guesser must touch at least one card per turn for zero-clues, but standard turns allow ending before guessing. We'll allow ending turn anytime after clue is given.)

   - **Sudden Death** (`guess` when `sudden_death == true`):
     - Both sides can guess (no clue given)
     - Any incorrect guess (bystander or assassin) → lose immediately
     - Only green guesses allowed to continue
     - Win when all greens found

2. **Timer token tracking**
   - Start: 9 tokens
   - Each turn costs 1 token (bystander hit or voluntary end)
   - Invalid clue penalty: discard 1 extra token (stretch goal)
   - Display remaining tokens to all players

### Phase D4: Frontend Type & Context Changes

**Files**: `types/game.ts`, `context/GameContext.tsx`

1. **Update TypeScript types**
   ```typescript
   export type GameMode = "classic" | "duet";
   export type CardColor = "red" | "blue" | "neutral" | "assassin" | "green";

   export interface RoomState {
     // ... existing fields ...
     game_mode: GameMode;
     timer_tokens: number | null;
     greens_remaining: number | null;
     sudden_death: boolean | null;
   }

   // New client message
   | { type: "set_game_mode"; payload: { mode: GameMode } }
   ```

2. **GameContext**: no structural changes needed — it's already mode-agnostic.

### Phase D5: Frontend — Lobby Mode Selection

**Files**: `HostLobby.tsx`, `PlayerLobby.tsx`

1. **Host Lobby**: add a game mode toggle/selector (Classic / Duet) that sends `set_game_mode` message. Show current mode. Adjust minimum player display (4 for classic, 2 for duet).

2. **Player Lobby**: show the selected game mode so players know what they're joining.

### Phase D6: Frontend — Duet Game Views

**Files**: new `DuetClueGiver.tsx`, `DuetGuesser.tsx`, or modify existing `PlayerSpymaster.tsx` / `PlayerOperative.tsx`

**Approach**: Branch in `Play.tsx` based on `roomState.game_mode`. For Duet, render Duet-specific components (or adapt existing ones).

1. **Duet Clue-Giver View** (your side's turn)
   - Shows board with YOUR side's colors (green = your agents, black = your assassins)
   - Clue input form (word + number)
   - Timer tokens display
   - Greens remaining counter (out of 15)
   - No "team" branding — cooperative framing ("Your turn to give a clue")

2. **Duet Guesser View** (partner's turn)
   - Shows board with YOUR side's colors (you still see your own key)
   - Cannot see clue-giver's side (but your own greens/assassins are visible to help you reason)
   - Tap cards to guess
   - "End Turn" button (costs a timer token)
   - Current clue display
   - Timer tokens display

3. **Duet Host/TV View**
   - Board with no key colors (same as classic host)
   - Timer tokens display (prominent)
   - Greens remaining counter
   - Current clue + who's giving it
   - No team scores — replace `ScoreBar` with a `DuetStatusBar` showing tokens + progress

4. **Duet Game Over View**
   - Win: "Mission Complete!" with green theme
   - Lose: "Mission Failed" with reason (assassin / out of turns)
   - Reveal full board (both sides' colors)

### Phase D7: Frontend — Board Component Updates

**File**: `Board.tsx`, possibly new `DuetScoreBar.tsx`

1. **Board**: add CSS for `card-green` color class. Existing `card-assassin`, `card-neutral` already work.

2. **DuetStatusBar**: replaces `ScoreBar` in Duet mode
   - Shows: timer tokens remaining (visual token icons), greens found / 15
   - Whose turn to give clue

### Phase D8: Testing

1. **Backend tests** (`game.rs`):
   - `build_duet_board` produces correct dual-side color distribution (9 green, 3 black, 13 bystander per side; 15 unique greens)
   - `check_duet_winner` correctly detects all 15 greens found
   - Timer token decrement logic
   - Sudden death behavior
   - Assassin hit → lose

2. **Backend tests** (`ws.rs` / integration):
   - Duet game flow: clue → guess → correct → continue → bystander → turn end → token spent
   - Assassin hit ends game
   - Sudden death entry and resolution
   - Both sides can guess in sudden death
   - Mode selection in lobby

3. **Frontend tests**:
   - Mode selector renders and sends correct message
   - Duet views render based on game_mode
   - Timer tokens display correctly
   - Green card color renders

---

## File Change Summary

| File | Changes |
|---|---|
| `models.rs` | Add `GameMode`, `CardColor::Green`, duet fields on `Game`/`Room`/`RoomState`, update `state_for_player` |
| `game.rs` | Add `build_duet_board()`, `assign_duet_sides()`, `check_duet_winner()` |
| `messages.rs` | Add `SetGameMode` client message |
| `ws.rs` | Branch `handle_message` logic on game mode, duet guess/clue/turn logic |
| `types/game.ts` | Add `GameMode`, `CardColor::green`, duet fields on `RoomState`, new client message |
| `HostLobby.tsx` | Mode selector UI |
| `PlayerLobby.tsx` | Show selected mode |
| `Play.tsx` | Branch on game_mode for playing phase |
| `Host.tsx` | Branch on game_mode for playing/game-over phases |
| `Board.tsx` | Add `card-green` CSS class |
| `ScoreBar.tsx` | Keep for classic; add `DuetStatusBar` for duet |
| `HostGameBoard.tsx` | Swap ScoreBar for DuetStatusBar when duet |
| `HostGameOver.tsx` | Cooperative win/lose message for duet |
| `PlayerGameOver.tsx` | Cooperative win/lose message for duet |
| New: `DuetClueGiver.tsx` | Duet clue-giver phone view |
| New: `DuetGuesser.tsx` | Duet guesser phone view |
| New: `DuetStatusBar.tsx` | Timer tokens + greens progress bar |
| CSS | Add `.card-green` color, duet-specific styles |

---

## Build Order

```
D1 (models) → D2 (board gen) → D3 (game logic) → D4 (TS types)
                                                       ↓
                                          D5 (lobby) + D6 (game views) + D7 (board/status)
                                                       ↓
                                                    D8 (testing)
```

D1–D3 are backend-only and can be built + tested with `cargo test` before touching frontend.
D4–D7 are frontend changes that depend on the backend protocol being finalized.
D8 runs throughout but has a dedicated pass at the end.

## Stretch Goals (Post-MVP)

- **Mission map**: configurable difficulty (different token counts + allowed mistakes)
- **Looser turn order**: allow same side to give 2 clues in a row (rule variant)
- **Invalid clue penalty**: host can flag invalid clue → 1 token penalty
- **Visual bystander tokens**: show timer tokens placed on specific bystander cards
- **Dual-side reveal on game over**: show both sides of the key card overlaid
