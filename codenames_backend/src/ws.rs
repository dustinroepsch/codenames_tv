use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use tokio::sync::{broadcast, Mutex};

use crate::game;
use crate::messages::{ClientMessage, ServerMessage};
use crate::models::*;
use crate::room_manager::RoomManager;

/// Per-room broadcast channels for pushing state updates.
pub type RoomChannels = Arc<Mutex<HashMap<String, broadcast::Sender<String>>>>;

pub fn new_room_channels() -> RoomChannels {
    Arc::new(Mutex::new(HashMap::new()))
}

/// Get or create a broadcast channel for a room.
async fn get_channel(channels: &RoomChannels, room_code: &str) -> broadcast::Sender<String> {
    let mut map = channels.lock().await;
    map.entry(room_code.to_string())
        .or_insert_with(|| broadcast::channel(64).0)
        .clone()
}

/// Broadcast updated state to all players in the room.
async fn broadcast_state(room_manager: &RoomManager, channels: &RoomChannels, room_code: &str) {
    let room = match room_manager.get_room(room_code).await {
        Some(r) => r,
        None => return,
    };

    let tx = get_channel(channels, room_code).await;

    // Send personalized state to each player
    for (player_id, _) in &room.players {
        let state = room.state_for_player(player_id);
        let msg = ServerMessage::State(state);
        if let Ok(json) = serde_json::to_string(&msg) {
            // We encode the target player_id into the message for filtering
            let envelope = format!("{}|{}", player_id, json);
            let _ = tx.send(envelope);
        }
    }

    // Also send a host view (no key card visible)
    let host_state = room.state_for_host();
    let msg = ServerMessage::State(host_state);
    if let Ok(json) = serde_json::to_string(&msg) {
        let envelope = format!("__host__|{}", json);
        let _ = tx.send(envelope);
    }
}

/// Handle a single WebSocket connection.
pub async fn handle_socket(
    socket: WebSocket,
    room_code: String,
    room_manager: RoomManager,
    channels: RoomChannels,
    is_host: bool,
) {
    let (mut ws_tx, mut ws_rx) = socket.split();

    let tx = get_channel(&channels, &room_code).await;
    let mut rx = tx.subscribe();

    let player_id = uuid::Uuid::new_v4().to_string();
    let player_id_clone = player_id.clone();
    let room_code_clone = room_code.clone();

    // Spawn task to forward broadcast messages to this client
    let forward_task = tokio::spawn(async move {
        while let Ok(envelope) = rx.recv().await {
            // Parse envelope: "target_id|json"
            if let Some((target, json)) = envelope.split_once('|') {
                let should_send = if is_host {
                    target == "__host__"
                } else {
                    target == player_id_clone
                };
                if should_send {
                    if ws_tx.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Send initial state so the client isn't stuck on "Loading"
    broadcast_state(&room_manager, &channels, &room_code).await;

    // Process incoming messages
    while let Some(Ok(msg)) = ws_rx.next().await {
        let text = match msg {
            Message::Text(t) => t.to_string(),
            Message::Close(_) => break,
            _ => continue,
        };

        let client_msg: ClientMessage = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => {
                let err = ServerMessage::Error {
                    message: format!("Invalid message: {}", e),
                };
                let _ = tx.send(format!(
                    "{}|{}",
                    player_id,
                    serde_json::to_string(&err).unwrap()
                ));
                continue;
            }
        };

        handle_message(
            &client_msg,
            &player_id,
            &room_code,
            &room_manager,
            &channels,
            is_host,
        )
        .await;
    }

    // Player disconnected — mark as disconnected
    room_manager
        .with_room(&room_code_clone, |room| {
            if let Some(player) = room.players.get_mut(&player_id) {
                player.connected = false;
            }
        })
        .await;

    broadcast_state(&room_manager, &channels, &room_code_clone).await;
    forward_task.abort();
}

async fn handle_message(
    msg: &ClientMessage,
    player_id: &str,
    room_code: &str,
    room_manager: &RoomManager,
    channels: &RoomChannels,
    is_host: bool,
) {
    match msg {
        ClientMessage::Join { name } => {
            room_manager
                .with_room(room_code, |room| {
                    // Check if player is rejoining
                    let existing = room
                        .players
                        .values()
                        .find(|p| p.name == *name && !p.connected)
                        .map(|p| p.id.clone());

                    if let Some(_existing_id) = existing {
                        // Rejoin not fully supported yet — just add as new
                    }

                    room.players.insert(
                        player_id.to_string(),
                        Player {
                            id: player_id.to_string(),
                            name: name.clone(),
                            team: None,
                            role: None,
                            connected: true,
                        },
                    );
                })
                .await;

            // Send the player their ID
            let tx = get_channel(channels, room_code).await;
            let joined = ServerMessage::Joined {
                player_id: player_id.to_string(),
            };
            if let Ok(json) = serde_json::to_string(&joined) {
                let _ = tx.send(format!("{}|{}", player_id, json));
            }

            broadcast_state(room_manager, channels, room_code).await;
        }

        ClientMessage::StartWordSubmission => {
            if !is_host {
                send_error(channels, room_code, player_id, "Only the host can start word submission").await;
                return;
            }
            let valid = room_manager
                .with_room(room_code, |room| {
                    if room.phase != GamePhase::Lobby {
                        return false;
                    }
                    if room.player_count() < 4 {
                        return false;
                    }
                    room.phase = GamePhase::WordSubmission;
                    room.submitted_words.clear();
                    // Deadline: 60 seconds from now
                    let deadline = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs()
                        + 60;
                    room.word_submission_deadline = Some(deadline);
                    true
                })
                .await;

            if valid == Some(true) {
                broadcast_state(room_manager, channels, room_code).await;

                // Spawn timer to auto-end word submission
                let rm = room_manager.clone();
                let ch = channels.clone();
                let rc = room_code.to_string();
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                    let still_submitting = rm
                        .with_room(&rc, |room| room.phase == GamePhase::WordSubmission)
                        .await;
                    if still_submitting == Some(true) {
                        start_game(&rm, &ch, &rc).await;
                    }
                });
            } else {
                send_error(channels, room_code, player_id, "Cannot start word submission (need 4+ players, must be in lobby)").await;
            }
        }

        ClientMessage::SubmitWord { word } => {
            let trimmed = word.trim().to_string();
            if trimmed.is_empty() || trimmed.len() > 30 {
                send_error(channels, room_code, player_id, "Word must be 1-30 characters").await;
                return;
            }

            room_manager
                .with_room(room_code, |room| {
                    if room.phase == GamePhase::WordSubmission {
                        // Deduplicate case-insensitively
                        if !room
                            .submitted_words
                            .iter()
                            .any(|w| w.eq_ignore_ascii_case(&trimmed))
                        {
                            room.submitted_words.push(trimmed);
                        }
                    }
                })
                .await;

            broadcast_state(room_manager, channels, room_code).await;
        }

        ClientMessage::EndWordSubmission => {
            if !is_host {
                send_error(channels, room_code, player_id, "Only the host can end word submission").await;
                return;
            }
            start_game(room_manager, channels, room_code).await;
        }

        ClientMessage::GiveClue { word, number } => {
            let result = room_manager
                .with_room(room_code, |room| {
                    let game = match &mut room.game {
                        Some(g) => g,
                        None => return Err("No active game"),
                    };
                    if room.phase != GamePhase::Playing {
                        return Err("Game is not in progress");
                    }
                    if game.current_clue.is_some() {
                        return Err("A clue has already been given this turn");
                    }

                    // Verify the player is the current team's spymaster
                    let player = match room.players.get(player_id) {
                        Some(p) => p,
                        None => return Err("Player not found"),
                    };
                    if player.role != Some(Role::Spymaster) {
                        return Err("Only spymasters can give clues");
                    }
                    if player.team != Some(game.current_turn) {
                        return Err("It's not your team's turn");
                    }

                    let clue_word = word.trim().to_string();
                    if clue_word.is_empty() || clue_word.contains(' ') {
                        return Err("Clue must be a single word");
                    }

                    game.current_clue = Some(Clue {
                        word: clue_word,
                        number: *number,
                    });
                    // 0 or unlimited (None) → unlimited guesses
                    // N (1-9) → N+1 guesses
                    game.guesses_remaining = match number {
                        Some(0) | None => None, // unlimited
                        Some(n) => Some(n + 1),
                    };

                    Ok(())
                })
                .await;

            match result {
                Some(Err(e)) => {
                    send_error(channels, room_code, player_id, e).await;
                    return;
                }
                None => return,
                _ => {}
            }

            broadcast_state(room_manager, channels, room_code).await;
        }

        ClientMessage::Guess { card_index } => {
            let result = room_manager
                .with_room(room_code, |room| {
                    let game = match &mut room.game {
                        Some(g) => g,
                        None => return Err("No active game"),
                    };
                    if room.phase != GamePhase::Playing {
                        return Err("Game is not in progress");
                    }
                    if game.current_clue.is_none() {
                        return Err("Wait for the spymaster to give a clue");
                    }

                    let player = match room.players.get(player_id) {
                        Some(p) => p,
                        None => return Err("Player not found"),
                    };
                    if player.role != Some(Role::Operative) {
                        return Err("Only operatives can guess");
                    }
                    if player.team != Some(game.current_turn) {
                        return Err("It's not your team's turn");
                    }

                    if *card_index >= 25 {
                        return Err("Invalid card index");
                    }
                    if game.board[*card_index].revealed {
                        return Err("Card already revealed");
                    }

                    // Reveal the card
                    game.board[*card_index].revealed = true;
                    let card_color = game.board[*card_index].color;
                    let current_team = game.current_turn;

                    match card_color {
                        CardColor::Assassin => {
                            // Guessing team loses
                            game.winner = Some(current_team.other());
                            game.losing_team = Some(current_team);
                            room.phase = GamePhase::GameOver;
                        }
                        CardColor::Red | CardColor::Blue => {
                            let guessed_team = if card_color == CardColor::Red {
                                Team::Red
                            } else {
                                Team::Blue
                            };

                            // Check if that team's cards are all revealed → they win
                            if let Some(winner) = game::check_winner(&game.board) {
                                game.winner = Some(winner);
                                room.phase = GamePhase::GameOver;
                            } else if guessed_team == current_team {
                                // Correct guess — decrement if not unlimited
                                if let Some(remaining) = &mut game.guesses_remaining {
                                    *remaining = remaining.saturating_sub(1);
                                    if *remaining == 0 {
                                        // Used all guesses, end turn
                                        game.current_turn = current_team.other();
                                        game.current_clue = None;
                                        game.guesses_remaining = None;
                                    }
                                }
                                // If None (unlimited), just keep going
                            } else {
                                // Wrong team's card — end turn
                                game.current_turn = current_team.other();
                                game.current_clue = None;
                                game.guesses_remaining = None;
                            }
                        }
                        CardColor::Neutral => {
                            // Neutral — end turn
                            game.current_turn = current_team.other();
                            game.current_clue = None;
                            game.guesses_remaining = None;
                        }
                    }

                    Ok(())
                })
                .await;

            match result {
                Some(Err(e)) => {
                    send_error(channels, room_code, player_id, e).await;
                    return;
                }
                None => return,
                _ => {}
            }

            broadcast_state(room_manager, channels, room_code).await;
        }

        ClientMessage::EndTurn => {
            room_manager
                .with_room(room_code, |room| {
                    if let Some(game) = &mut room.game {
                        if room.phase == GamePhase::Playing && game.current_clue.is_some() {
                            if let Some(player) = room.players.get(player_id) {
                                if player.team == Some(game.current_turn)
                                    && player.role == Some(Role::Operative)
                                {
                                    game.current_turn = game.current_turn.other();
                                    game.current_clue = None;
                                    game.guesses_remaining = None;
                                }
                            }
                        }
                    }
                })
                .await;

            broadcast_state(room_manager, channels, room_code).await;
        }

        ClientMessage::PlayAgain => {
            if !is_host {
                send_error(channels, room_code, player_id, "Only the host can restart").await;
                return;
            }
            room_manager
                .with_room(room_code, |room| {
                    room.phase = GamePhase::Lobby;
                    room.game = None;
                    room.submitted_words.clear();
                    room.word_submission_deadline = None;
                    for player in room.players.values_mut() {
                        player.team = None;
                        player.role = None;
                    }
                })
                .await;

            broadcast_state(room_manager, channels, room_code).await;
        }
    }
}

/// Transition from word submission to playing.
async fn start_game(room_manager: &RoomManager, channels: &RoomChannels, room_code: &str) {
    room_manager
        .with_room(room_code, |room| {
            if room.phase != GamePhase::WordSubmission {
                return;
            }

            // Build board
            let board = game::build_board(&room.submitted_words);
            let first = game::first_team(&board);

            // Assign teams
            game::assign_teams(&mut room.players);

            room.game = Some(Game {
                board,
                current_turn: first,
                current_clue: None,
                guesses_remaining: None,
                winner: None,
                losing_team: None,
            });
            room.phase = GamePhase::Playing;
        })
        .await;

    broadcast_state(room_manager, channels, room_code).await;
}

async fn send_error(channels: &RoomChannels, room_code: &str, player_id: &str, message: &str) {
    let tx = get_channel(channels, room_code).await;
    let err = ServerMessage::Error {
        message: message.to_string(),
    };
    if let Ok(json) = serde_json::to_string(&err) {
        let _ = tx.send(format!("{}|{}", player_id, json));
    }
}
