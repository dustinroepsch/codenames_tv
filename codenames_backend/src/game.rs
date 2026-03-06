use rand::seq::SliceRandom;

use crate::dictionary;
use crate::models::*;

/// Build the 5x5 board from submitted words, padding with dictionary words if needed.
pub fn build_board(submitted_words: &[String]) -> Vec<Card> {
    let mut words: Vec<String> = submitted_words.to_vec();

    // Deduplicate (case-insensitive)
    words.sort_by_key(|a| a.to_lowercase());
    words.dedup_by(|a, b| a.eq_ignore_ascii_case(b));

    // Pad to 25 if needed
    if words.len() < 25 {
        let padding = dictionary::random_words(25 - words.len(), &words);
        words.extend(padding);
    }

    // Shuffle and take 25
    let mut rng = rand::thread_rng();
    words.shuffle(&mut rng);
    words.truncate(25);

    // Assign colors: first team gets 9, second gets 8, 7 neutral, 1 assassin
    // Randomly pick which team goes first (gets 9)
    let first_team = if rand::random::<bool>() {
        Team::Red
    } else {
        Team::Blue
    };
    let second_team = first_team.other();

    let mut colors = Vec::with_capacity(25);
    for _ in 0..9 {
        colors.push(if first_team == Team::Red {
            CardColor::Red
        } else {
            CardColor::Blue
        });
    }
    for _ in 0..8 {
        colors.push(if second_team == Team::Red {
            CardColor::Red
        } else {
            CardColor::Blue
        });
    }
    for _ in 0..7 {
        colors.push(CardColor::Neutral);
    }
    colors.push(CardColor::Assassin);
    colors.shuffle(&mut rng);

    let board: Vec<Card> = words
        .into_iter()
        .zip(colors)
        .map(|(word, color)| Card {
            word,
            color,
            revealed: false,
        })
        .collect();

    board
}

/// Get which team goes first (the team with 9 cards).
pub fn first_team(board: &[Card]) -> Team {
    let red_count = board.iter().filter(|c| c.color == CardColor::Red).count();
    if red_count == 9 {
        Team::Red
    } else {
        Team::Blue
    }
}

/// Assign players to teams and roles randomly.
/// Returns the team that goes first.
pub fn assign_teams(players: &mut std::collections::HashMap<String, Player>) -> Team {
    let mut rng = rand::thread_rng();
    let mut ids: Vec<String> = players
        .iter()
        .filter(|(_, p)| p.connected)
        .map(|(id, _)| id.clone())
        .collect();
    ids.shuffle(&mut rng);

    let half = ids.len() / 2;
    // First half = Red, second half = Blue
    for (i, id) in ids.iter().enumerate() {
        if let Some(player) = players.get_mut(id) {
            if i < half {
                player.team = Some(Team::Red);
            } else {
                player.team = Some(Team::Blue);
            }
            player.role = Some(Role::Operative);
        }
    }

    // Pick one spymaster per team
    let red_players: Vec<&String> = ids.iter().take(half).collect();
    let blue_players: Vec<&String> = ids.iter().skip(half).collect();

    if let Some(spymaster_id) = red_players.choose(&mut rng)
        && let Some(p) = players.get_mut(*spymaster_id) {
            p.role = Some(Role::Spymaster);
        }
    if let Some(spymaster_id) = blue_players.choose(&mut rng)
        && let Some(p) = players.get_mut(*spymaster_id) {
            p.role = Some(Role::Spymaster);
        }

    // Return a placeholder; actual first team is determined by board
    Team::Red
}

/// Check if a team has won (all their cards revealed).
pub fn check_winner(board: &[Card]) -> Option<Team> {
    let red_remaining = board
        .iter()
        .filter(|c| c.color == CardColor::Red && !c.revealed)
        .count();
    let blue_remaining = board
        .iter()
        .filter(|c| c.color == CardColor::Blue && !c.revealed)
        .count();

    if red_remaining == 0 {
        Some(Team::Red)
    } else if blue_remaining == 0 {
        Some(Team::Blue)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_player(id: &str, name: &str) -> (String, Player) {
        (
            id.to_string(),
            Player {
                id: id.to_string(),
                name: name.to_string(),
                team: None,
                role: None,
                connected: true,
            },
        )
    }

    // --- build_board tests ---

    #[test]
    fn board_has_25_cards() {
        let board = build_board(&[]);
        assert_eq!(board.len(), 25);
    }

    #[test]
    fn board_color_distribution_is_correct() {
        let board = build_board(&[]);
        let red = board.iter().filter(|c| c.color == CardColor::Red).count();
        let blue = board.iter().filter(|c| c.color == CardColor::Blue).count();
        let neutral = board.iter().filter(|c| c.color == CardColor::Neutral).count();
        let assassin = board.iter().filter(|c| c.color == CardColor::Assassin).count();

        assert!(red == 9 || red == 8, "Red should be 8 or 9, got {}", red);
        assert!(blue == 9 || blue == 8, "Blue should be 8 or 9, got {}", blue);
        assert_eq!(red + blue, 17, "Red + Blue should be 17");
        assert_eq!(neutral, 7);
        assert_eq!(assassin, 1);
    }

    #[test]
    fn board_all_cards_start_unrevealed() {
        let board = build_board(&[]);
        assert!(board.iter().all(|c| !c.revealed));
    }

    #[test]
    fn board_uses_submitted_words() {
        let words: Vec<String> = (0..25).map(|i| format!("CustomWord{}", i)).collect();
        let board = build_board(&words);
        // All 25 board words should be from our custom set
        for card in &board {
            assert!(
                card.word.starts_with("CustomWord"),
                "Expected custom word, got: {}",
                card.word
            );
        }
    }

    #[test]
    fn board_pads_with_dictionary_when_few_words_submitted() {
        let words = vec!["MyWord1".to_string(), "MyWord2".to_string()];
        let board = build_board(&words);
        assert_eq!(board.len(), 25);
        // At least our 2 submitted words should appear
        let custom_count = board
            .iter()
            .filter(|c| c.word == "MyWord1" || c.word == "MyWord2")
            .count();
        assert_eq!(custom_count, 2);
    }

    #[test]
    fn board_deduplicates_submitted_words() {
        let words: Vec<String> = std::iter::repeat("duplicate".to_string()).take(30).collect();
        let board = build_board(&words);
        assert_eq!(board.len(), 25);
        // Only 1 card should have "duplicate", rest padded from dictionary
        let dup_count = board.iter().filter(|c| c.word == "duplicate").count();
        assert_eq!(dup_count, 1);
    }

    #[test]
    fn board_has_unique_words() {
        let board = build_board(&[]);
        let words: std::collections::HashSet<_> = board.iter().map(|c| &c.word).collect();
        assert_eq!(words.len(), 25);
    }

    // --- first_team tests ---

    #[test]
    fn first_team_returns_team_with_9_cards() {
        // Create a board where Red has 9
        let mut board = Vec::new();
        for i in 0..9 {
            board.push(Card { word: format!("r{}", i), color: CardColor::Red, revealed: false });
        }
        for i in 0..8 {
            board.push(Card { word: format!("b{}", i), color: CardColor::Blue, revealed: false });
        }
        for i in 0..7 {
            board.push(Card { word: format!("n{}", i), color: CardColor::Neutral, revealed: false });
        }
        board.push(Card { word: "assassin".into(), color: CardColor::Assassin, revealed: false });

        assert_eq!(first_team(&board), Team::Red);
    }

    #[test]
    fn first_team_returns_blue_when_blue_has_9() {
        let mut board = Vec::new();
        for i in 0..8 {
            board.push(Card { word: format!("r{}", i), color: CardColor::Red, revealed: false });
        }
        for i in 0..9 {
            board.push(Card { word: format!("b{}", i), color: CardColor::Blue, revealed: false });
        }
        for i in 0..7 {
            board.push(Card { word: format!("n{}", i), color: CardColor::Neutral, revealed: false });
        }
        board.push(Card { word: "assassin".into(), color: CardColor::Assassin, revealed: false });

        assert_eq!(first_team(&board), Team::Blue);
    }

    // --- assign_teams tests ---

    #[test]
    fn assign_teams_splits_players_into_two_teams() {
        let mut players: HashMap<String, Player> = HashMap::new();
        for i in 0..6 {
            let (id, p) = make_player(&format!("p{}", i), &format!("Player{}", i));
            players.insert(id, p);
        }

        assign_teams(&mut players);

        let red_count = players.values().filter(|p| p.team == Some(Team::Red)).count();
        let blue_count = players.values().filter(|p| p.team == Some(Team::Blue)).count();

        assert_eq!(red_count + blue_count, 6);
        assert!(red_count >= 2 && blue_count >= 2, "Teams should be roughly even");
    }

    #[test]
    fn assign_teams_assigns_one_spymaster_per_team() {
        let mut players: HashMap<String, Player> = HashMap::new();
        for i in 0..6 {
            let (id, p) = make_player(&format!("p{}", i), &format!("Player{}", i));
            players.insert(id, p);
        }

        assign_teams(&mut players);

        let red_spymasters = players
            .values()
            .filter(|p| p.team == Some(Team::Red) && p.role == Some(Role::Spymaster))
            .count();
        let blue_spymasters = players
            .values()
            .filter(|p| p.team == Some(Team::Blue) && p.role == Some(Role::Spymaster))
            .count();

        assert_eq!(red_spymasters, 1, "Red team should have exactly 1 spymaster");
        assert_eq!(blue_spymasters, 1, "Blue team should have exactly 1 spymaster");
    }

    #[test]
    fn assign_teams_all_players_get_roles() {
        let mut players: HashMap<String, Player> = HashMap::new();
        for i in 0..4 {
            let (id, p) = make_player(&format!("p{}", i), &format!("Player{}", i));
            players.insert(id, p);
        }

        assign_teams(&mut players);

        for p in players.values() {
            assert!(p.team.is_some(), "Player {} should have a team", p.name);
            assert!(p.role.is_some(), "Player {} should have a role", p.name);
        }
    }

    #[test]
    fn assign_teams_skips_disconnected_players() {
        let mut players: HashMap<String, Player> = HashMap::new();
        for i in 0..4 {
            let (id, p) = make_player(&format!("p{}", i), &format!("Player{}", i));
            players.insert(id, p);
        }
        // Add a disconnected player
        players.insert(
            "dc".to_string(),
            Player {
                id: "dc".to_string(),
                name: "Disconnected".to_string(),
                team: None,
                role: None,
                connected: false,
            },
        );

        assign_teams(&mut players);

        let dc = players.get("dc").unwrap();
        assert!(dc.team.is_none(), "Disconnected player should not be assigned a team");
    }

    // --- check_winner tests ---

    #[test]
    fn no_winner_when_cards_remain() {
        let board = vec![
            Card { word: "a".into(), color: CardColor::Red, revealed: true },
            Card { word: "b".into(), color: CardColor::Red, revealed: false },
            Card { word: "c".into(), color: CardColor::Blue, revealed: false },
        ];
        assert_eq!(check_winner(&board), None);
    }

    #[test]
    fn red_wins_when_all_red_revealed() {
        let board = vec![
            Card { word: "a".into(), color: CardColor::Red, revealed: true },
            Card { word: "b".into(), color: CardColor::Red, revealed: true },
            Card { word: "c".into(), color: CardColor::Blue, revealed: false },
            Card { word: "d".into(), color: CardColor::Neutral, revealed: false },
        ];
        assert_eq!(check_winner(&board), Some(Team::Red));
    }

    #[test]
    fn blue_wins_when_all_blue_revealed() {
        let board = vec![
            Card { word: "a".into(), color: CardColor::Red, revealed: false },
            Card { word: "b".into(), color: CardColor::Blue, revealed: true },
            Card { word: "c".into(), color: CardColor::Blue, revealed: true },
            Card { word: "d".into(), color: CardColor::Neutral, revealed: false },
        ];
        assert_eq!(check_winner(&board), Some(Team::Blue));
    }

    #[test]
    fn check_winner_ignores_neutral_and_assassin() {
        let board = vec![
            Card { word: "a".into(), color: CardColor::Red, revealed: true },
            Card { word: "b".into(), color: CardColor::Blue, revealed: true },
            Card { word: "c".into(), color: CardColor::Neutral, revealed: false },
            Card { word: "d".into(), color: CardColor::Assassin, revealed: false },
        ];
        // Both teams have all their cards revealed — red checked first
        assert_eq!(check_winner(&board), Some(Team::Red));
    }
}

