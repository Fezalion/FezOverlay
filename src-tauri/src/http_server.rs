use axum::{
    extract::{Path, Query, State, WebSocketUpgrade, ws},
    http::{StatusCode, header},
    response::{IntoResponse, Json, Response},
    routing::{get, post, Router},
    body::Body,
};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use futures_util::{SinkExt, StreamExt};
use crate::config::{AppConfig, AppSettings};
use base64::Engine;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;

static AVAILABLE_SUB_EFFECTS: &[&str] = &[
    "magneticAttraction",
    "reverseGravity",
    "gravityEvent",
    "battleEvent",
];

// In-memory state
static mut NOW_PLAYING: Option<serde_json::Value> = None;
static BATTLE_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
// WebSocket clients
static WS_CLIENTS: std::sync::LazyLock<tokio::sync::Mutex<Vec<tokio::sync::mpsc::UnboundedSender<ws::Message>>>> =
    std::sync::LazyLock::new(|| tokio::sync::Mutex::new(Vec::new()));

pub async fn start_http_server(config: AppConfig) {
    let config = Arc::new(Mutex::new(config));
    let cfg_clone = config.clone();

    // Determine dist directory for static files
    let dist_dir = {
        let cfg = cfg_clone.lock().await;
        let base = &cfg.base_dir;
        let dist = base.join("dist");
        if !dist.exists() {
            // Fallback to current directory
            std::path::PathBuf::from("dist")
        } else {
            dist
        }
    };

    log::info!("[HTTP] Serving static files from: {:?}", dist_dir);

    let app = Router::new()
        // 1. API routes (must come before SPA fallback)
        .route("/api/settings", get(get_settings_handler).post(update_settings_handler))
        .route("/api/subeffecttypes", get(get_subeffect_types_handler))
        .route("/api/currentversion", get(get_current_version_handler))
        .route("/api/latestversion", get(get_latest_version_handler))
        .route("/api/twitch", get(get_twitch_auth_handler))
        .route("/api/twitch/status", get(get_twitch_status_handler))
        .route("/api/twitch-log", post(log_twitch_event_handler))
        .route("/auth/twitch/callback", get(twitch_callback_page_handler).post(save_twitch_callback_handler))
        .route("/api/youtube/apikey/status", get(get_api_key_status_handler))
        .route("/api/youtube/apikey", post(validate_and_save_api_key_handler))
        .route("/api/youtube/video/:video_id", get(get_video_info_handler))
        .route("/api/youtube/playlist/:playlist_id", get(get_playlist_info_handler))
        .route("/api/leaderboard", get(get_leaderboard_handler))
        .route("/api/leaderboard/win", post(record_win_handler))
        .route("/api/music/playlists", get(get_playlists_handler).post(save_playlists_handler))
        .route("/api/music/nowplaying", get(get_now_playing_handler).post(set_now_playing_handler))
        .route("/api/bots", get(get_bots_handler).post(update_bot_handler))
        .route("/api/commands", get(get_commands_handler).post(update_command_handler))
        .route("/api/emote-proxy", get(emote_proxy_handler))
        .route("/api/battle/state", get(get_battle_state_handler).post(set_battle_state_handler))
        .route("/api/config-path", get(get_config_path_handler))
        .route("/api/open-config-folder", post(open_config_folder_handler))
        .route("/api/open-url", post(open_url_handler))
        .route("/api/refresh", post(refresh_handler))
        .route("/api/log-client-error", post(log_client_error_handler))
        // 2. WebSocket endpoint
        .route("/ws", get(ws_handler))
        // 3. SPA fallback - serves static files or index.html
        .fallback(spa_handler)
        .layer(CorsLayer::permissive())
        .with_state(config);

    let addr = "0.0.0.0:48000";
    log::info!("[HTTP] Server running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn open_url_handler(Json(body): Json<Value>) -> Json<Value> {
    let url = body["url"].as_str().unwrap_or("");
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Json(serde_json::json!({ "ok": false, "error": "Invalid URL" }));
    }

    #[cfg(target_os = "windows")]
    std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", url])
        .spawn()
        .ok();

    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(url).spawn().ok();

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(url).spawn().ok();

    Json(serde_json::json!({ "ok": true }))
}

async fn open_config_folder_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
) -> Json<Value> {
    let cfg = config.lock().await;
    let path = cfg.base_dir.to_string_lossy().to_string();
    drop(cfg);
    
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&path).spawn().ok();
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&path).spawn().ok();
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&path).spawn().ok();

    Json(serde_json::json!({ "ok": true }))
}

// SPA handler - serve index.html for all non-API GET requests
async fn spa_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    uri: axum::http::Uri,
) -> Response {
    let path = uri.path();

    // If it's an API route, pass through (will be caught by other handlers)
    if path.starts_with("/api/") || path.starts_with("/auth/") || path == "/ws" {
        return StatusCode::NOT_FOUND.into_response();
    }

    let cfg = config.lock().await;
    let dist_dir = if cfg.base_dir.join("dist").exists() {
        cfg.base_dir.join("dist")
    } else {
        std::path::PathBuf::from("dist")
    };

    // If dist doesn't exist, proxy to Vite dev server
    if !dist_dir.exists() {
        drop(cfg); // release the lock before async fetch
        let vite_port = 5173;
        let vite_url = format!("http://localhost:{}{}", vite_port, uri);

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        match client.get(&vite_url).send().await {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let content_type = resp
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("application/octet-stream")
                    .to_string();

                match resp.bytes().await {
                    Ok(body) => Response::builder()
                        .status(status)
                        .header(header::CONTENT_TYPE, content_type)
                        .body(Body::from(body.to_vec()))
                        .unwrap()
                        .into_response(),
                    Err(_) => StatusCode::BAD_GATEWAY.into_response(),
                }
            }
            Err(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Application files not available. Run: npm run dev (for hot-reload) or npm run build (for production)",
            )
                .into_response(),
        }
    } else {
        // Try to serve exact file first
        let file_path = dist_dir.join(path.trim_start_matches('/'));
        if file_path.exists() && file_path.is_file() {
            let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");
            let content_type = match ext {
                "html" => "text/html",
                "js" => "application/javascript",
                "css" => "text/css",
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "svg" => "image/svg+xml",
                "ico" => "image/x-icon",
                "json" => "application/json",
                "woff2" => "font/woff2",
                "woff" => "font/woff",
                _ => "application/octet-stream",
            };
            if let Ok(data) = fs::read(&file_path) {
                return Response::builder()
                    .header(header::CONTENT_TYPE, content_type)
                    .body(Body::from(data))
                    .unwrap()
                    .into_response();
            }
        }

        // SPA fallback: serve index.html
        let index_path = dist_dir.join("index.html");
        match fs::read_to_string(&index_path) {
            Ok(html) => Response::builder()
                .header(header::CONTENT_TYPE, "text/html")
                .body(Body::from(html))
                .unwrap()
                .into_response(),
            Err(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Application files not available. Run: npm run build".to_string(),
            )
                .into_response(),
        }
    }
}

// WebSocket handler
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(config): State<Arc<Mutex<AppConfig>>>,
) -> Response {
    ws.on_upgrade(move |socket| handle_ws_connection(socket)).into_response()
}

async fn handle_ws_connection(socket: axum::extract::ws::WebSocket) {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    
    // Register client
    WS_CLIENTS.lock().await.push(tx.clone());

    // Send refresh on connect
    let refresh = serde_json::json!({"type": "refresh", "target": "all"});
    if let Ok(msg) = serde_json::to_string(&refresh) {
        tx.send(ws::Message::Text(msg.into())).ok();
    }

    // Send now playing if available
    unsafe {
        if let Some(ref track) = NOW_PLAYING {
            if let Ok(msg) = serde_json::to_string(&serde_json::json!({
                "type": "nowPlaying",
                "track": track
            })) {
                tx.send(ws::Message::Text(msg.into())).ok();
            }
        }
    }

    // Split socket to handle sending and receiving concurrently
    let (mut sender, mut receiver) = socket.split();

    // Forward broadcast messages to the socket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(ws::Message::Text(text)) => {
                if let Ok(data) = serde_json::from_str::<Value>(&text) {
                    let msg_type = data["type"].as_str().unwrap_or("");
                    match msg_type {
                        "spawnEmote" | "chatMessage" | "nowPlaying" | "battleState" => {
                            broadcast_ws(&text).await;
                        }
                        _ => {}
                    }
                }
            }
            Ok(ws::Message::Close(_)) => break,
            Ok(ws::Message::Ping(data)) => {
                tx.send(ws::Message::Pong(data)).ok();
            }
            _ => {}
        }
    }

    // Remove client on disconnect
    WS_CLIENTS.lock().await.retain(|c| !c.is_closed());
    send_task.abort();
}

pub async fn broadcast_ws(message: &str) {
    let clients = WS_CLIENTS.lock().await;
    for client in clients.iter() {
        client.send(ws::Message::Text(message.to_string().into())).ok();
    }
}

// Helper to get config reference
fn get_env(cfg: &AppConfig, key: &str) -> String {
    std::env::var(key).ok().unwrap_or_default()
}

// --- HANDLER IMPLEMENTATIONS ---

async fn get_settings_handler(State(config): State<Arc<Mutex<AppConfig>>>) -> Json<Value> {
    let cfg = config.lock().await;
    let settings = AppSettings::load(&cfg.settings_path);
    Json(serde_json::to_value(settings).unwrap_or_default())
}

async fn update_settings_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let cfg = config.lock().await;
    let mut settings = AppSettings::load(&cfg.settings_path);

    // Handle subEffectTypes
    if let Some(sub_types) = body.get("subEffectTypes") {
        let filtered: Vec<String> = match sub_types {
            Value::Array(arr) => arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .filter(|s| AVAILABLE_SUB_EFFECTS.contains(&s.as_str()))
                .collect(),
            Value::String(s) if AVAILABLE_SUB_EFFECTS.contains(&s.as_str()) => vec![s.clone()],
            _ => vec![],
        };
        settings.sub_effect_types = filtered;
    }

    // Merge rest
    if let Some(obj) = body.as_object() {
        if let Ok(mut current_value) = serde_json::to_value(&settings) {
            if let Some(current_obj) = current_value.as_object_mut() {
                for (key, value) in obj {
                    if key != "subEffectTypes" {
                        current_obj.insert(key.clone(), value.clone());
                    }
                }
                if let Ok(merged) = serde_json::from_value(current_value) {
                    settings = merged;
                }
            }
        }
    }

    if let Err(e) = settings.save(&cfg.settings_path) {
        log::error!("[Settings] Failed to save: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    log::info!("[Settings] Saved to {:?}", cfg.settings_path);
    // Broadcast refresh
    broadcast_ws(r#"{"type":"refresh","target":"all"}"#).await;
    Ok(Json(serde_json::to_value(settings).unwrap_or_default()))
}

async fn get_subeffect_types_handler() -> Json<Vec<&'static str>> {
    Json(AVAILABLE_SUB_EFFECTS.to_vec())
}

async fn get_current_version_handler(State(config): State<Arc<Mutex<AppConfig>>>) -> Json<Value> {
    let cfg = config.lock().await;
    let version = fs::read_to_string(&cfg.version_path).unwrap_or_default();
    Json(serde_json::json!({ "version": version.trim() }))
}

async fn get_latest_version_handler() -> Json<Value> {
    let client = reqwest::Client::new();
    let url = "https://api.github.com/repos/Fezalion/FezOverlay/releases/latest";
    match client.get(url).header("User-Agent", "node").send().await {
        Ok(resp) => {
            if let Ok(data) = resp.json::<Value>().await {
                let version = data["tag_name"].as_str()
                    .or_else(|| data["name"].as_str())
                    .unwrap_or("");
                return Json(serde_json::json!({ "version": version }));
            }
        }
        Err(e) => log::error!("Failed to fetch latest release: {}", e),
    }
    Json(serde_json::json!({ "version": "" }))
}

async fn get_twitch_auth_handler(State(config): State<Arc<Mutex<AppConfig>>>) -> Result<Json<Value>, StatusCode> {
    let cfg = config.lock().await;
    let auth = get_env(&cfg, "TWITCH_ACCESS_TOKEN");
    let username = get_env(&cfg, "TWITCH_USERNAME");
    if auth.is_empty() {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(Json(serde_json::json!({
        "auth": auth,
        "username": username,
        "client": "pro83yr2qxpqs1qwy85uqkp17w5wpl"
    })))
}

async fn get_twitch_status_handler(State(config): State<Arc<Mutex<AppConfig>>>) -> Json<Value> {
    let cfg = config.lock().await;
    cfg.reload_env();
    let auth = get_env(&cfg, "TWITCH_ACCESS_TOKEN");
    let username = get_env(&cfg, "TWITCH_USERNAME");
    let configured = !auth.is_empty();
    Json(serde_json::json!({
        "configured": configured,
        "username": if configured { username } else { String::new() }
    }))
}

/// Serves the SPA page for the Twitch OAuth callback.
/// Twitch redirects to GET /auth/twitch/callback#access_token=...
/// The frontend AuthCallback component picks up the hash fragment
/// and POSTs the token back to this same endpoint.
async fn twitch_callback_page_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
) -> Response {
    let cfg = config.lock().await;
    let dist_dir = if cfg.base_dir.join("dist").exists() {
        cfg.base_dir.join("dist")
    } else {
        std::path::PathBuf::from("dist")
    };

    let index_path = dist_dir.join("index.html");
    match fs::read_to_string(&index_path) {
        Ok(html) => Response::builder()
            .header(header::CONTENT_TYPE, "text/html")
            .body(Body::from(html))
            .unwrap()
            .into_response(),
        Err(_) => {
            // If dist doesn't exist, proxy to Vite
            drop(cfg);
            let vite_url = format!("http://localhost:5173/auth/twitch/callback");
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .build()
                .unwrap_or_default();
            match client.get(&vite_url).send().await {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    let ct = resp.headers().get("content-type")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("text/html")
                        .to_string();
                    match resp.bytes().await {
                        Ok(body) => Response::builder()
                            .status(status)
                            .header(header::CONTENT_TYPE, ct)
                            .body(Body::from(body.to_vec()))
                            .unwrap()
                            .into_response(),
                        Err(_) => StatusCode::BAD_GATEWAY.into_response(),
                    }
                }
                Err(_) => {
                    let html = r#"<!DOCTYPE html><html><body><p>Twitch auth callback — close this tab and return to the app.</p><script>
                        const params = new URLSearchParams(window.location.hash.substring(1));
                        const token = params.get('access_token');
                        if (token) {
                            fetch('/auth/twitch/callback', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({access_token:token}) })
                                .then(r=>r.json()).then(() => { document.body.innerHTML = '<p>✓ Authenticated! You can close this tab.</p>'; })
                                .catch(() => { document.body.innerHTML = '<p>✗ Failed to save token.</p>'; });
                        } else {
                            document.body.innerHTML = '<p>✗ No access token found.</p>';
                        }
                    </script></body></html>"#;
                    Response::builder()
                        .header(header::CONTENT_TYPE, "text/html")
                        .body(Body::from(html))
                        .unwrap()
                        .into_response()
                }
            }
        }
    }
}

async fn save_twitch_callback_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let access_token = body["access_token"].as_str().unwrap_or("");
    let username = body["username"].as_str();
    let cfg = config.lock().await;
    
    let mut env_data = fs::read_to_string(&cfg.env_path).unwrap_or_default();
    env_data = env_data.replace("TWITCH_ACCESS_TOKEN=", "#TWITCH_ACCESS_TOKEN=");
    env_data = env_data.replace("TWITCH_USERNAME=", "#TWITCH_USERNAME=");
    env_data.push_str(&format!("\nTWITCH_ACCESS_TOKEN={}", access_token));
    if let Some(name) = username {
        env_data.push_str(&format!("\nTWITCH_USERNAME={}", name.trim().to_lowercase()));
    }
    fs::write(&cfg.env_path, env_data.trim().to_string() + "\n").ok();
    cfg.reload_env();

    Json(serde_json::json!({
        "success": true,
        "message": "Token and identity credentials saved and loaded"
    }))
}

async fn log_twitch_event_handler(Json(body): Json<Value>) -> Json<Value> {
    let event = body["event"].as_str().unwrap_or("");
    let detail = body["detail"].as_str().unwrap_or("");
    log::info!("[Twitch] [{}] — {}", event, detail);
    Json(serde_json::json!({ "ok": true }))
}

async fn get_api_key_status_handler(State(config): State<Arc<Mutex<AppConfig>>>) -> Json<Value> {
    let cfg = config.lock().await;
    let key = get_env(&cfg, "VITE_YOUTUBE_API_KEY");
    Json(serde_json::json!({ "configured": !key.is_empty() }))
}

async fn validate_and_save_api_key_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let api_key = body["apiKey"].as_str().unwrap_or("");
    if api_key.len() < 20 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let test_url = format!("https://www.googleapis.com/youtube/v3/videos?id=dQw4w9WgXcQ&part=id&key={}", api_key);
    let client = reqwest::Client::new();
    match client.get(&test_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let cfg = config.lock().await;
            cfg.upsert_env_var("VITE_YOUTUBE_API_KEY", api_key);
            cfg.reload_env();
            Ok(Json(serde_json::json!({ "success": true })))
        }
        Ok(resp) => {
            let status = resp.status();
            Err(StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_REQUEST))
        }
        Err(_) => Err(StatusCode::BAD_GATEWAY),
    }
}

async fn get_video_info_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Path(video_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let cfg = config.lock().await;
    let api_key = get_env(&cfg, "VITE_YOUTUBE_API_KEY");
    if api_key.is_empty() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    let url = format!("https://www.googleapis.com/youtube/v3/videos?id={}&part=snippet,contentDetails&key={}", video_id, api_key);
    let client = reqwest::Client::new();
    match client.get(&url).send().await {
        Ok(resp) => {
            if let Ok(data) = resp.json::<Value>().await {
                if let Some(item) = data["items"][0].as_object() {
                    return Ok(Json(serde_json::json!({
                        "videoId": video_id,
                        "title": item["snippet"]["title"].as_str().unwrap_or(""),
                        "channel": item["snippet"]["channelTitle"].as_str().unwrap_or("Unknown channel"),
                        "duration": item["contentDetails"]["duration"].as_str().unwrap_or("")
                    })));
                }
            }
            Err(StatusCode::NOT_FOUND)
        }
        Err(_) => Err(StatusCode::BAD_GATEWAY),
    }
}

async fn get_playlist_info_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Path(playlist_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let cfg = config.lock().await;
    let api_key = get_env(&cfg, "VITE_YOUTUBE_API_KEY");
    if api_key.is_empty() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let client = reqwest::Client::new();
    let meta_url = format!("https://www.googleapis.com/youtube/v3/playlists?id={}&part=snippet&key={}", playlist_id, api_key);
    
    let meta = client.get(&meta_url).send().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    let meta_data: Value = meta.json().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    let title = meta_data["items"][0]["snippet"]["title"].as_str().unwrap_or("Imported Playlist");

    let mut all_items = Vec::new();
    let mut next_page = String::new();
    loop {
        let items_url = format!(
            "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId={}&key={}&pageToken={}",
            playlist_id, api_key, next_page
        );
        if let Ok(resp) = client.get(&items_url).send().await {
            if let Ok(page) = resp.json::<Value>().await {
                if let Some(items) = page["items"].as_array() {
                    for item in items {
                        if let Some(video_id) = item["snippet"]["resourceId"]["videoId"].as_str() {
                            all_items.push(serde_json::json!({
                                "videoId": video_id,
                                "title": item["snippet"]["title"].as_str().unwrap_or(""),
                                "channel": item["snippet"]["videoOwnerChannelTitle"].as_str()
                                    .or_else(|| item["snippet"]["channelTitle"].as_str())
                                    .unwrap_or("Unknown")
                            }));
                        }
                    }
                }
                next_page = page["nextPageToken"].as_str().unwrap_or("").to_string();
                if next_page.is_empty() { break; }
            } else { break; }
        } else { break; }
    }

    Ok(Json(serde_json::json!({
        "title": title,
        "items": all_items
    })))
}

async fn get_leaderboard_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Query(params): Query<HashMap<String, String>>,
) -> Json<Vec<Value>> {
    let limit: usize = params.get("limit").and_then(|l| l.parse().ok()).unwrap_or(5).max(1);
    let cfg = config.lock().await;
    let data: HashMap<String, u32> = fs::read_to_string(&cfg.leaderboard_path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default();

    let mut entries: Vec<Value> = data.into_iter()
        .map(|(u, w)| serde_json::json!({"username": u, "wins": w}))
        .collect();
    entries.sort_by(|a, b| {
        b["wins"].as_u64().cmp(&a["wins"].as_u64())
            .then(a["username"].as_str().cmp(&b["username"].as_str()))
    });
    entries.truncate(limit);
    Json(entries)
}

async fn record_win_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let username = body["username"].as_str().unwrap_or("").trim().to_lowercase();
    if username.is_empty() {
        return Json(serde_json::json!({ "error": "Missing username" }));
    }

    let cfg = config.lock().await;
    let mut data: HashMap<String, u32> = fs::read_to_string(&cfg.leaderboard_path)
        .ok().and_then(|c| serde_json::from_str(&c).ok()).unwrap_or_default();
    
    let wins = data.get(&username).copied().unwrap_or(0) + 1;
    data.insert(username.clone(), wins);
    fs::write(&cfg.leaderboard_path, serde_json::to_string_pretty(&data).unwrap_or_default()).ok();

    let mut entries: Vec<Value> = data.into_iter()
        .map(|(u, w)| serde_json::json!({"username": u, "wins": w}))
        .collect();
    entries.sort_by(|a, b| b["wins"].as_u64().cmp(&a["wins"].as_u64()));
    entries.truncate(5);

    Json(serde_json::json!({
        "success": true,
        "username": username,
        "wins": wins,
        "top": entries
    }))
}

// Playlists handlers
async fn get_playlists_handler(State(config): State<Arc<Mutex<AppConfig>>>) -> Json<Vec<Value>> {
    let cfg = config.lock().await;
    fs::create_dir_all(&cfg.playlists_dir).ok();
    let mut playlists = Vec::new();
    if let Ok(entries) = fs::read_dir(&cfg.playlists_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(val) = serde_json::from_str::<Value>(&content) {
                        playlists.push(val);
                    }
                }
            }
        }
    }
    Json(playlists)
}

async fn save_playlists_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let cfg = config.lock().await;
    fs::create_dir_all(&cfg.playlists_dir).ok();
    
    let playlists = if let Some(arr) = body["playlists"].as_array() { arr.clone() }
        else if let Some(arr) = body.as_array() { arr.clone() }
        else { return Json(serde_json::json!({ "error": "Expected playlists array" })); };

    let mut desired = std::collections::HashSet::new();
    for (i, pl) in playlists.iter().enumerate() {
        let default_id = format!("playlist_{}", i + 1);
        let id = pl["id"].as_str().unwrap_or(&default_id);
        let safe: String = id.chars().map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' }).collect();
        let name = format!("{}.json", safe);
        desired.insert(name.clone());
        let path = cfg.playlists_dir.join(&name);
        let wrapped = serde_json::json!({
            "id": id,
            "name": pl["name"].as_str().unwrap_or(&format!("Playlist {}", i + 1)),
            "sourceType": pl["sourceType"].as_str().unwrap_or("manual"),
            "sourceId": pl["sourceId"].as_str(),
            "isPrimary": pl["isPrimary"].as_bool().unwrap_or(false),
            "items": pl["items"].as_array().cloned().unwrap_or_default(),
        });
        fs::write(&path, serde_json::to_string_pretty(&wrapped).unwrap()).ok();
    }

    // Remove old files
    if let Ok(entries) = fs::read_dir(&cfg.playlists_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str().map(String::from) {
                if name.ends_with(".json") && !desired.contains(&name) {
                    fs::remove_file(entry.path()).ok();
                }
            }
        }
    }

    Json(serde_json::json!({ "success": true, "count": playlists.len() }))
}

async fn get_now_playing_handler() -> Json<Value> {
    unsafe { Json(NOW_PLAYING.clone().unwrap_or(Value::Null)) }
}

async fn set_now_playing_handler(Json(body): Json<Value>) -> Json<Value> {
    let track = body.get("track").cloned();
    unsafe { NOW_PLAYING = track; }
    broadcast_ws(r#"{"type":"nowPlayingUpdated"}"#).await;
    Json(serde_json::json!({ "ok": true }))
}

async fn get_bots_handler(State(config): State<Arc<Mutex<AppConfig>>>) -> Json<Vec<String>> {
    let cfg = config.lock().await;
    let bots: Vec<String> = fs::read_to_string(&cfg.bots_path)
        .ok().and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_else(|| vec![
            "streamelements".into(), "nightbot".into(), "moobot".into(),
            "fossabot".into(), "wizebot".into(), "soundalerts".into(), "stay_hydrated_bot".into(),
        ]);
    Json(bots)
}

async fn update_bot_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let cfg = config.lock().await;
    let action = body["action"].as_str().unwrap_or("");
    let username = body["username"].as_str().unwrap_or("");
    
    let mut bots: Vec<String> = fs::read_to_string(&cfg.bots_path)
        .ok().and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default();

    match action {
        "add" => { let lower = username.to_lowercase(); if !bots.contains(&lower) { bots.push(lower); } }
        "remove" => { bots.retain(|b| b.to_lowercase() != username.to_lowercase()); }
        _ => {}
    }
    fs::write(&cfg.bots_path, serde_json::to_string_pretty(&bots).unwrap_or_default()).ok();
    Json(serde_json::json!({ "success": true, "bots": bots }))
}

async fn get_commands_handler(State(config): State<Arc<Mutex<AppConfig>>>) -> Json<Vec<Value>> {
    let cfg = config.lock().await;
    let cmds: Vec<Value> = fs::read_to_string(&cfg.commands_path)
        .ok().and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default();
    Json(cmds)
}

async fn update_command_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let cfg = config.lock().await;
    let action = body["action"].as_str().unwrap_or("");
    let name = body["name"].as_str().unwrap_or("");
    
    let mut cmds: Vec<Value> = fs::read_to_string(&cfg.commands_path)
        .ok().and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default();

    match action {
        "add" => {
            if let Some(text) = body["text"].as_str() {
                cmds.retain(|c| c["name"].as_str().map(|n| n.to_lowercase()) != Some(name.to_lowercase()));
                cmds.push(serde_json::json!({"name": name, "text": text}));
            }
        }
        "remove" => {
            cmds.retain(|c| c["name"].as_str().map(|n| n.to_lowercase()) != Some(name.to_lowercase()));
        }
        _ => {}
    }
    fs::write(&cfg.commands_path, serde_json::to_string_pretty(&cmds).unwrap_or_default()).ok();
    Json(serde_json::json!({ "success": true, "commands": cmds }))
}

async fn get_battle_state_handler() -> Json<Value> {
    Json(serde_json::json!({ "active": BATTLE_ACTIVE.load(std::sync::atomic::Ordering::Relaxed) }))
}

async fn set_battle_state_handler(Json(body): Json<Value>) -> Json<Value> {
    let active = body["active"].as_bool().unwrap_or(false);
    BATTLE_ACTIVE.store(active, std::sync::atomic::Ordering::Relaxed);
    broadcast_ws(&serde_json::to_string(&serde_json::json!({
        "type": "battleState", "active": active
    })).unwrap_or_default()).await;
    Json(serde_json::json!({ "ok": true, "active": active }))
}

async fn get_config_path_handler(State(config): State<Arc<Mutex<AppConfig>>>) -> Json<Value> {
    let cfg = config.lock().await;
    let path = cfg.base_dir.to_string_lossy().to_string();
    Json(serde_json::json!({ "path": path }))
}

async fn refresh_handler(Json(body): Json<Value>) -> Json<&'static str> {
    let target = body["target"].as_str().unwrap_or("all");
    broadcast_ws(&serde_json::to_string(&serde_json::json!({
        "type": "refresh", "target": target
    })).unwrap_or_default()).await;
    Json("Refresh triggered")
}

async fn log_client_error_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let cfg = config.lock().await;
    let error = body["error"].as_str().unwrap_or("");
    let info = body["info"].as_str().unwrap_or("");
    let ua = body["userAgent"].as_str().unwrap_or("");
    let entry = format!(
        "[{}] CLIENT ERROR\nUser-Agent: {}\n{}\n{}\n",
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ"),
        ua, error, info
    );
    fs::OpenOptions::new().create(true).append(true).open(&cfg.error_log_path)
        .and_then(|mut f| std::io::Write::write_all(&mut f, entry.as_bytes())).ok();
    Json(serde_json::json!({ "ok": true }))
}

async fn emote_proxy_handler(
    State(config): State<Arc<Mutex<AppConfig>>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, StatusCode> {
    let url = match params.get("url") {
        Some(u) => u,
        None => return Err(StatusCode::BAD_REQUEST),
    };

    let cfg = config.lock().await;
    let safe_name = base64::engine::general_purpose::STANDARD.encode(url.as_bytes())
        .trim_end_matches('=')
        .to_string();
    
    // Determine extension from URL path
    let parsed_url = reqwest::Url::parse(url).map_err(|_| StatusCode::BAD_REQUEST)?;
    let path = std::path::Path::new(parsed_url.path());
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("img");
    let cache_name = format!("{}.{}", safe_name, ext);
    let emote_cache_dir = cfg.emote_cache_dir.clone();
    let cache_path = emote_cache_dir.join(&cache_name);
    
    fs::create_dir_all(&emote_cache_dir).ok();

    // Check cache
    if cache_path.exists() {
        if let Ok(data) = fs::read(&cache_path) {
            let content_type = match ext {
                "png" => "image/png",
                "gif" => "image/gif",
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "svg" => "image/svg+xml",
                _ => "application/octet-stream",
            };
            return Ok(Response::builder()
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CACHE_CONTROL, "public, max-age=86400")
                .body(Body::from(data))
                .unwrap());
        }
    }

    // Fetch and cache
    let client = reqwest::Client::builder()
        .user_agent("node-emote-proxy")
        .build()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match client.get(url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let bytes = resp.bytes().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
            let tmp_path = emote_cache_dir.join(format!("tmp_{}", cache_name));
            fs::write(&tmp_path, &bytes).ok();
            fs::rename(&tmp_path, &cache_path).ok();
            let content_type = match ext {
                "png" => "image/png",
                "gif" => "image/gif",
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "svg" => "image/svg+xml",
                _ => "application/octet-stream",
            };
            Ok(Response::builder()
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CACHE_CONTROL, "public, max-age=86400")
                .body(Body::from(bytes.to_vec()))
                .unwrap())
        }
        _ => Err(StatusCode::BAD_GATEWAY),
    }
}