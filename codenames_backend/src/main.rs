mod dictionary;
mod game;
mod messages;
mod models;
mod room_manager;
mod ws;

use axum::{
    Router,
    extract::{Path, Query, State, WebSocketUpgrade},
    http::Method,
    response::Json,
    routing::{get, post},
};
use room_manager::RoomManager;
use serde::Deserialize;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
struct AppState {
    room_manager: RoomManager,
    channels: ws::RoomChannels,
}

#[tokio::main]
async fn main() {
    let state = AppState {
        room_manager: RoomManager::new(),
        channels: ws::new_room_channels(),
    };

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);
    let cors = match std::env::var("CORS_ORIGIN") {
        Ok(origins) => {
            let headers: Vec<axum::http::HeaderValue> = origins
                .split(',')
                .map(|o| o.trim().parse::<axum::http::HeaderValue>().unwrap())
                .collect();
            cors.allow_origin(headers)
        }
        Err(_) => cors.allow_origin(Any),
    };

    // Spawn background task to clean up stale rooms every 5 minutes
    let cleanup_rm = state.room_manager.clone();
    let cleanup_ch = state.channels.clone();

    let app = Router::new()
        .route("/health", get(health))
        .route("/rooms", post(create_room))
        .route("/rooms/{code}", get(get_room))
        .route("/ws/{code}", get(ws_upgrade))
        .layer(cors)
        .with_state(state);
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
            let stale_codes = cleanup_rm.remove_stale_rooms(3600).await;
            if !stale_codes.is_empty() {
                let mut channels = cleanup_ch.lock().await;
                for code in &stale_codes {
                    channels.remove(code);
                }
                println!("Cleaned up {} stale rooms", stale_codes.len());
            }
        }
    });

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
    println!("Backend listening on http://0.0.0.0:3001");
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> &'static str {
    "ok"
}

async fn create_room(State(state): State<AppState>) -> Json<serde_json::Value> {
    let code = state.room_manager.generate_code().await;
    let host_id = uuid::Uuid::new_v4().to_string();
    state
        .room_manager
        .create_room(code.clone(), host_id.clone())
        .await;
    Json(serde_json::json!({ "code": code, "host_id": host_id }))
}

async fn get_room(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Json<serde_json::Value> {
    let code = code.to_uppercase();
    match state.room_manager.get_room(&code).await {
        Some(room) => Json(serde_json::json!({
            "code": room.code,
            "phase": room.phase,
            "player_count": room.player_count(),
        })),
        None => Json(serde_json::json!({ "error": "Room not found" })),
    }
}

#[derive(Deserialize)]
struct WsQuery {
    host: Option<bool>,
    session: Option<String>,
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    Path(code): Path<String>,
    Query(query): Query<WsQuery>,
    State(state): State<AppState>,
) -> axum::response::Response {
    let code = code.to_uppercase();
    let is_host = query.host.unwrap_or(false);
    let session = query.session;
    ws.on_upgrade(move |socket| {
        ws::handle_socket(
            socket,
            code,
            state.room_manager,
            state.channels,
            is_host,
            session,
        )
    })
}
