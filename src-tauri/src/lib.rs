mod config;
mod http_server;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Wry,
    WindowEvent,
    Emitter,
    Manager,
    WebviewWindowBuilder, WebviewUrl,
};
use std::sync::Arc;
use tokio::sync::Mutex;
use config::AppConfig;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(move |app| {
            // Tray setup
            let open_dashboard = MenuItemBuilder::with_id("page_settings", "Open Settings").build(app)?;
            let open_music = MenuItemBuilder::with_id("page_music", "Open Music").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Application").build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .items(&[&open_dashboard,&open_music,&quit])
                .build()?;

            let _tray: tauri::tray::TrayIcon<Wry> = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "page_music" => {
                            if let Some(music_window) = app.get_webview_window("music") {
                                // If it exists, bring it to the front
                                let _ = music_window.show();
                                let _ = music_window.unminimize();
                                let _ = music_window.set_focus();
                            } else {
                                // If it doesn't exist, create a new window pointing to the /music route
                                let _music_window = WebviewWindowBuilder::new(
                                    app,
                                    "music", // Unique window label
                                    WebviewUrl::App("music".into()) // Directs it to localhost:48000/music
                                )
                                .title("Music Overlay")
                                .inner_size(1280.0, 720.0) // Set your preferred starting size
                                .resizable(true)
                                .build();
                            }
                        }

                        page_id if page_id.starts_with("page_") => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();

                                let route = page_id.strip_prefix("page_").unwrap();

                                let _ = window.emit("navigate-to", route);
                            }
                        }                    
                        _ => {}
                    }
                })
                .build(app)?;

            // Setup logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize app config
            let config = {
                let resource_dir = app.path().resource_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                let base_dir = if cfg!(debug_assertions) {
                    std::env::current_dir()
                        .unwrap_or_else(|_| resource_dir.clone())
                        .parent()
                        .map(|p| p.to_path_buf())
                        .unwrap_or_else(|| resource_dir.clone())
                } else {
                    resource_dir.clone()
                };
                AppConfig::new(base_dir)
            };

            // Load .env file
            dotenvy::from_path(&config.env_path).ok();
            config.reload_env();

            // Note: If Axum handles all state now, you might not even need app.manage()
            app.manage(Arc::new(Mutex::new(config.clone())));

            // Start Axum server
            tauri::async_runtime::spawn(async move {
                http_server::start_http_server(config).await;
            });

            Ok(())
        })
        // .invoke_handler is completely gone
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}