use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::models::Room;

/// Thread-safe store of all active rooms.
#[derive(Clone)]
pub struct RoomManager {
    rooms: Arc<Mutex<HashMap<String, Room>>>,
}

impl RoomManager {
    pub fn new() -> Self {
        RoomManager {
            rooms: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Generate a unique 4-letter room code.
    pub async fn generate_code(&self) -> String {
        let rooms = self.rooms.lock().await;
        loop {
            let code: String = (0..4)
                .map(|_| {
                    let idx = rand::random::<u8>() % 26;
                    (b'A' + idx) as char
                })
                .collect();
            if !rooms.contains_key(&code) {
                return code;
            }
        }
    }

    pub async fn create_room(&self, code: String, host_id: String) -> Room {
        let room = Room::new(code.clone(), host_id);
        let mut rooms = self.rooms.lock().await;
        rooms.insert(code, room.clone());
        room
    }

    pub async fn get_room(&self, code: &str) -> Option<Room> {
        let rooms = self.rooms.lock().await;
        rooms.get(code).cloned()
    }

    pub async fn with_room<F, R>(&self, code: &str, f: F) -> Option<R>
    where
        F: FnOnce(&mut Room) -> R,
    {
        let mut rooms = self.rooms.lock().await;
        rooms.get_mut(code).map(f)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::GamePhase;

    #[tokio::test]
    async fn generate_code_returns_4_uppercase_letters() {
        let rm = RoomManager::new();
        let code = rm.generate_code().await;
        assert_eq!(code.len(), 4);
        assert!(code.chars().all(|c| c.is_ascii_uppercase()));
    }

    #[tokio::test]
    async fn generate_code_is_unique() {
        let rm = RoomManager::new();
        let mut codes = std::collections::HashSet::new();
        for _ in 0..50 {
            let code = rm.generate_code().await;
            codes.insert(code);
        }
        // With 26^4 = 456976 possibilities, 50 codes should all be unique
        assert_eq!(codes.len(), 50);
    }

    #[tokio::test]
    async fn create_and_get_room() {
        let rm = RoomManager::new();
        rm.create_room("ABCD".into(), "host1".into()).await;
        let room = rm.get_room("ABCD").await;
        assert!(room.is_some());
        let room = room.unwrap();
        assert_eq!(room.code, "ABCD");
        assert_eq!(room.host_id, "host1");
        assert_eq!(room.phase, GamePhase::Lobby);
    }

    #[tokio::test]
    async fn get_nonexistent_room_returns_none() {
        let rm = RoomManager::new();
        assert!(rm.get_room("NOPE").await.is_none());
    }

    #[tokio::test]
    async fn with_room_mutates_room() {
        let rm = RoomManager::new();
        rm.create_room("ABCD".into(), "host1".into()).await;

        rm.with_room("ABCD", |room| {
            room.phase = GamePhase::WordSubmission;
        })
        .await;

        let room = rm.get_room("ABCD").await.unwrap();
        assert_eq!(room.phase, GamePhase::WordSubmission);
    }

    #[tokio::test]
    async fn with_room_returns_none_for_missing_room() {
        let rm = RoomManager::new();
        let result = rm.with_room("NOPE", |_| 42).await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn with_room_returns_closure_result() {
        let rm = RoomManager::new();
        rm.create_room("ABCD".into(), "host1".into()).await;

        let count = rm.with_room("ABCD", |room| room.player_count()).await;
        assert_eq!(count, Some(0));
    }

    #[tokio::test]
    async fn multiple_rooms_are_independent() {
        let rm = RoomManager::new();
        rm.create_room("AAAA".into(), "host1".into()).await;
        rm.create_room("BBBB".into(), "host2".into()).await;

        rm.with_room("AAAA", |room| {
            room.phase = GamePhase::Playing;
        })
        .await;

        let a = rm.get_room("AAAA").await.unwrap();
        let b = rm.get_room("BBBB").await.unwrap();
        assert_eq!(a.phase, GamePhase::Playing);
        assert_eq!(b.phase, GamePhase::Lobby);
    }
}
