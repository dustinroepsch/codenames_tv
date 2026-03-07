use serde::{Deserialize, Serialize};

/// Messages sent from client to server.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Player joins the room with a display name.
    Join { name: String },
    /// Player reconnects using their session (no name needed).
    Reconnect,
    /// Host starts word submission phase.
    StartWordSubmission,
    /// Player submits a word.
    SubmitWord { word: String },
    /// Host ends word submission early.
    EndWordSubmission,
    /// Spymaster gives a clue. `number` is `None` for unlimited.
    GiveClue { word: String, number: Option<u8> },
    /// Operative guesses a card by index (0-24).
    Guess { card_index: usize },
    /// Operative ends their team's turn voluntarily.
    EndTurn,
    /// Host requests to play again (back to lobby).
    PlayAgain,
}

/// Messages sent from server to client.
#[derive(Debug, Serialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Full room state update.
    State(crate::models::RoomState),
    /// Error message.
    Error { message: String },
    /// Player's assigned ID upon joining.
    Joined { player_id: String },
    /// Session-based reconnect failed (client should re-join).
    ReconnectFailed,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_join_message() {
        let json = r#"{"type":"join","payload":{"name":"Alice"}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::Join { name } => assert_eq!(name, "Alice"),
            _ => panic!("Expected Join message"),
        }
    }

    #[test]
    fn deserialize_submit_word() {
        let json = r#"{"type":"submit_word","payload":{"word":"Dragon"}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::SubmitWord { word } => assert_eq!(word, "Dragon"),
            _ => panic!("Expected SubmitWord message"),
        }
    }

    #[test]
    fn deserialize_give_clue() {
        let json = r#"{"type":"give_clue","payload":{"word":"animal","number":3}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::GiveClue { word, number } => {
                assert_eq!(word, "animal");
                assert_eq!(number, Some(3));
            }
            _ => panic!("Expected GiveClue message"),
        }
    }

    #[test]
    fn deserialize_give_clue_zero() {
        let json = r#"{"type":"give_clue","payload":{"word":"feathers","number":0}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::GiveClue { word, number } => {
                assert_eq!(word, "feathers");
                assert_eq!(number, Some(0));
            }
            _ => panic!("Expected GiveClue message"),
        }
    }

    #[test]
    fn deserialize_give_clue_unlimited() {
        let json = r#"{"type":"give_clue","payload":{"word":"feathers","number":null}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::GiveClue { word, number } => {
                assert_eq!(word, "feathers");
                assert_eq!(number, None);
            }
            _ => panic!("Expected GiveClue message"),
        }
    }

    #[test]
    fn deserialize_guess() {
        let json = r#"{"type":"guess","payload":{"card_index":12}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::Guess { card_index } => assert_eq!(card_index, 12),
            _ => panic!("Expected Guess message"),
        }
    }

    #[test]
    fn deserialize_start_word_submission() {
        let json = r#"{"type":"start_word_submission"}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, ClientMessage::StartWordSubmission));
    }

    #[test]
    fn deserialize_end_word_submission() {
        let json = r#"{"type":"end_word_submission"}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, ClientMessage::EndWordSubmission));
    }

    #[test]
    fn deserialize_end_turn() {
        let json = r#"{"type":"end_turn"}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, ClientMessage::EndTurn));
    }

    #[test]
    fn deserialize_play_again() {
        let json = r#"{"type":"play_again"}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, ClientMessage::PlayAgain));
    }

    #[test]
    fn deserialize_reconnect() {
        let json = r#"{"type":"reconnect"}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, ClientMessage::Reconnect));
    }

    #[test]
    fn serialize_reconnect_failed() {
        let msg = ServerMessage::ReconnectFailed;
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"reconnect_failed\""));
    }

    #[test]
    fn invalid_message_type_fails() {
        let json = r#"{"type":"nonexistent"}"#;
        assert!(serde_json::from_str::<ClientMessage>(json).is_err());
    }

    #[test]
    fn serialize_error_message() {
        let msg = ServerMessage::Error {
            message: "bad request".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"error\""));
        assert!(json.contains("bad request"));
    }

    #[test]
    fn serialize_joined_message() {
        let msg = ServerMessage::Joined {
            player_id: "abc-123".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"joined\""));
        assert!(json.contains("abc-123"));
    }
}
