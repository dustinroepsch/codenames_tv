use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GamePhase {
    Lobby,
    WordSubmission,
    Playing,
    GameOver,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Team {
    Red,
    Blue,
}

impl Team {
    pub fn other(self) -> Self {
        match self {
            Team::Red => Team::Blue,
            Team::Blue => Team::Red,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Spymaster,
    Operative,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardColor {
    Red,
    Blue,
    Neutral,
    Assassin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub word: String,
    pub color: CardColor,
    pub revealed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub team: Option<Team>,
    pub role: Option<Role>,
    pub connected: bool,
    /// Session token for reconnection. Not sent to clients.
    #[serde(skip)]
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Clue {
    pub word: String,
    /// The number the spymaster said. `None` means "unlimited".
    pub number: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub board: Vec<Card>,
    pub current_turn: Team,
    pub current_clue: Option<Clue>,
    /// Guesses left this turn. `None` means unlimited (from a 0 or unlimited clue).
    pub guesses_remaining: Option<u8>,
    pub winner: Option<Team>,
    pub losing_team: Option<Team>,
}

#[derive(Debug, Clone)]
pub struct Room {
    pub code: String,
    pub host_id: String,
    pub players: HashMap<String, Player>,
    pub phase: GamePhase,
    pub game: Option<Game>,
    pub submitted_words: Vec<String>,
    pub word_submission_deadline: Option<u64>,
    /// Unix epoch seconds of last activity (for room cleanup).
    pub last_activity: u64,
}

impl Room {
    pub fn new(code: String, host_id: String) -> Self {
        Room {
            code,
            host_id,
            players: HashMap::new(),
            phase: GamePhase::Lobby,
            game: None,
            submitted_words: Vec::new(),
            word_submission_deadline: None,
            last_activity: now_secs(),
        }
    }

    pub fn player_count(&self) -> usize {
        self.players.len()
    }

    /// Build a sanitized view of the room state for a specific player.
    /// Spymasters see the key card; operatives and spectators do not.
    pub fn state_for_player(&self, player_id: &str) -> RoomState {
        let player = self.players.get(player_id);
        let is_spymaster = player
            .map(|p| p.role == Some(Role::Spymaster))
            .unwrap_or(false);

        let board = self.game.as_ref().map(|g| {
            g.board
                .iter()
                .map(|card| {
                    if card.revealed || is_spymaster {
                        card.clone()
                    } else {
                        Card {
                            word: card.word.clone(),
                            color: CardColor::Neutral, // hide true color
                            revealed: false,
                        }
                    }
                })
                .collect()
        });

        RoomState {
            code: self.code.clone(),
            phase: self.phase,
            players: self.players.values().cloned().collect(),
            board,
            current_turn: self.game.as_ref().map(|g| g.current_turn),
            current_clue: self.game.as_ref().and_then(|g| g.current_clue.clone()),
            guesses_remaining: self.game.as_ref().and_then(|g| g.guesses_remaining),
            winner: self.game.as_ref().and_then(|g| g.winner),
            losing_team: self.game.as_ref().and_then(|g| g.losing_team),
            word_count: self.submitted_words.len(),
            host_id: self.host_id.clone(),
        }
    }

    /// Build a host view that never shows the key card (TV is visible to all).
    pub fn state_for_host(&self) -> RoomState {
        let board = self.game.as_ref().map(|g| {
            g.board
                .iter()
                .map(|card| {
                    if card.revealed {
                        card.clone()
                    } else {
                        Card {
                            word: card.word.clone(),
                            color: CardColor::Neutral,
                            revealed: false,
                        }
                    }
                })
                .collect()
        });

        RoomState {
            code: self.code.clone(),
            phase: self.phase,
            players: self.players.values().cloned().collect(),
            board,
            current_turn: self.game.as_ref().map(|g| g.current_turn),
            current_clue: self.game.as_ref().and_then(|g| g.current_clue.clone()),
            guesses_remaining: self.game.as_ref().and_then(|g| g.guesses_remaining),
            winner: self.game.as_ref().and_then(|g| g.winner),
            losing_team: self.game.as_ref().and_then(|g| g.losing_team),
            word_count: self.submitted_words.len(),
            host_id: self.host_id.clone(),
        }
    }
}

/// Serializable room state sent to clients.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomState {
    pub code: String,
    pub phase: GamePhase,
    pub players: Vec<Player>,
    pub board: Option<Vec<Card>>,
    pub current_turn: Option<Team>,
    pub current_clue: Option<Clue>,
    /// Guesses left this turn. `None` when unlimited or no active game.
    pub guesses_remaining: Option<u8>,
    pub winner: Option<Team>,
    pub losing_team: Option<Team>,
    pub word_count: usize,
    pub host_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_board() -> Vec<Card> {
        vec![
            Card {
                word: "secret_red".into(),
                color: CardColor::Red,
                revealed: false,
            },
            Card {
                word: "secret_blue".into(),
                color: CardColor::Blue,
                revealed: false,
            },
            Card {
                word: "revealed_red".into(),
                color: CardColor::Red,
                revealed: true,
            },
            Card {
                word: "secret_assassin".into(),
                color: CardColor::Assassin,
                revealed: false,
            },
            Card {
                word: "secret_neutral".into(),
                color: CardColor::Neutral,
                revealed: false,
            },
        ]
    }

    fn make_room_with_game() -> Room {
        let mut room = Room::new("TEST".into(), "host1".into());
        room.phase = GamePhase::Playing;

        // Add a spymaster
        room.players.insert(
            "spy1".into(),
            Player {
                id: "spy1".into(),
                name: "Spymaster".into(),
                team: Some(Team::Red),
                role: Some(Role::Spymaster),
                connected: true,
                session_id: None,
            },
        );
        // Add an operative
        room.players.insert(
            "op1".into(),
            Player {
                id: "op1".into(),
                name: "Operative".into(),
                team: Some(Team::Red),
                role: Some(Role::Operative),
                connected: true,
                session_id: None,
            },
        );

        room.game = Some(Game {
            board: make_test_board(),
            current_turn: Team::Red,
            current_clue: None,
            guesses_remaining: None,
            winner: None,
            losing_team: None,
        });

        room
    }

    // --- Team ---

    #[test]
    fn team_other_swaps() {
        assert_eq!(Team::Red.other(), Team::Blue);
        assert_eq!(Team::Blue.other(), Team::Red);
    }

    // --- Room::new ---

    #[test]
    fn new_room_starts_in_lobby() {
        let room = Room::new("ABCD".into(), "host".into());
        assert_eq!(room.phase, GamePhase::Lobby);
        assert_eq!(room.code, "ABCD");
        assert_eq!(room.host_id, "host");
        assert!(room.players.is_empty());
        assert!(room.game.is_none());
        assert!(room.submitted_words.is_empty());
    }

    #[test]
    fn player_count_tracks_players() {
        let mut room = Room::new("ABCD".into(), "host".into());
        assert_eq!(room.player_count(), 0);
        room.players.insert(
            "p1".into(),
            Player {
                id: "p1".into(),
                name: "A".into(),
                team: None,
                role: None,
                connected: true,
                session_id: None,
            },
        );
        assert_eq!(room.player_count(), 1);
    }

    // --- state_for_player ---

    #[test]
    fn spymaster_sees_true_card_colors() {
        let room = make_room_with_game();
        let state = room.state_for_player("spy1");
        let board = state.board.unwrap();

        // Unrevealed cards should show true colors for spymaster
        let secret_red = board.iter().find(|c| c.word == "secret_red").unwrap();
        assert_eq!(secret_red.color, CardColor::Red);

        let secret_assassin = board.iter().find(|c| c.word == "secret_assassin").unwrap();
        assert_eq!(secret_assassin.color, CardColor::Assassin);
    }

    #[test]
    fn operative_sees_hidden_card_colors() {
        let room = make_room_with_game();
        let state = room.state_for_player("op1");
        let board = state.board.unwrap();

        // Unrevealed cards should be hidden (Neutral) for operative
        let secret_red = board.iter().find(|c| c.word == "secret_red").unwrap();
        assert_eq!(secret_red.color, CardColor::Neutral);

        let secret_assassin = board.iter().find(|c| c.word == "secret_assassin").unwrap();
        assert_eq!(secret_assassin.color, CardColor::Neutral);
    }

    #[test]
    fn operative_sees_revealed_card_true_colors() {
        let room = make_room_with_game();
        let state = room.state_for_player("op1");
        let board = state.board.unwrap();

        let revealed = board.iter().find(|c| c.word == "revealed_red").unwrap();
        assert_eq!(revealed.color, CardColor::Red);
        assert!(revealed.revealed);
    }

    #[test]
    fn unknown_player_sees_hidden_colors() {
        let room = make_room_with_game();
        let state = room.state_for_player("nonexistent");
        let board = state.board.unwrap();

        let secret_red = board.iter().find(|c| c.word == "secret_red").unwrap();
        assert_eq!(secret_red.color, CardColor::Neutral);
    }

    // --- state_for_host ---

    #[test]
    fn host_never_sees_unrevealed_card_colors() {
        let room = make_room_with_game();
        let state = room.state_for_host();
        let board = state.board.unwrap();

        let secret_red = board.iter().find(|c| c.word == "secret_red").unwrap();
        assert_eq!(secret_red.color, CardColor::Neutral);

        let secret_assassin = board.iter().find(|c| c.word == "secret_assassin").unwrap();
        assert_eq!(secret_assassin.color, CardColor::Neutral);
    }

    #[test]
    fn host_sees_revealed_card_colors() {
        let room = make_room_with_game();
        let state = room.state_for_host();
        let board = state.board.unwrap();

        let revealed = board.iter().find(|c| c.word == "revealed_red").unwrap();
        assert_eq!(revealed.color, CardColor::Red);
    }

    // --- state metadata ---

    #[test]
    fn state_includes_room_metadata() {
        let mut room = make_room_with_game();
        room.submitted_words = vec!["a".into(), "b".into(), "c".into()];
        let state = room.state_for_player("spy1");

        assert_eq!(state.code, "TEST");
        assert_eq!(state.phase, GamePhase::Playing);
        assert_eq!(state.word_count, 3);
        assert_eq!(state.host_id, "host1");
        assert_eq!(state.current_turn, Some(Team::Red));
    }

    #[test]
    fn state_without_game_has_no_board() {
        let room = Room::new("ABCD".into(), "host".into());
        let state = room.state_for_player("anyone");
        assert!(state.board.is_none());
        assert!(state.current_turn.is_none());
    }

    // --- Serde round-trips ---

    #[test]
    fn game_phase_serializes_as_snake_case() {
        let json = serde_json::to_string(&GamePhase::WordSubmission).unwrap();
        assert_eq!(json, "\"word_submission\"");
    }

    #[test]
    fn team_serializes_as_snake_case() {
        assert_eq!(serde_json::to_string(&Team::Red).unwrap(), "\"red\"");
        assert_eq!(serde_json::to_string(&Team::Blue).unwrap(), "\"blue\"");
    }

    #[test]
    fn card_color_roundtrips() {
        for color in [
            CardColor::Red,
            CardColor::Blue,
            CardColor::Neutral,
            CardColor::Assassin,
        ] {
            let json = serde_json::to_string(&color).unwrap();
            let back: CardColor = serde_json::from_str(&json).unwrap();
            assert_eq!(color, back);
        }
    }

    #[test]
    fn room_state_serializes_to_json() {
        let room = make_room_with_game();
        let state = room.state_for_player("op1");
        let json = serde_json::to_string(&state).unwrap();
        // Should be valid JSON that can be parsed back
        let parsed: RoomState = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.code, "TEST");
        assert_eq!(parsed.phase, GamePhase::Playing);
    }
}
