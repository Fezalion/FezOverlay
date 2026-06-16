use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AppConfig {
    /// Directory for writable runtime data (settings, .env, playlists, etc.)
    /// In debug: current dir. In release: app data dir (%APPDATA%/com.fezalion.fezoverlay)
    pub base_dir: PathBuf,
    /// Directory for bundled resources (dist, icons, etc.)
    /// In debug: same as base_dir. In release: Tauri resource_dir
    pub resource_dir: PathBuf,
    pub env_path: PathBuf,
    pub settings_path: PathBuf,
    pub bots_path: PathBuf,
    pub commands_path: PathBuf,
    pub playlists_dir: PathBuf,
    pub version_path: PathBuf,
    pub emote_cache_dir: PathBuf,
    pub leaderboard_path: PathBuf,
    pub error_log_path: PathBuf,
}

impl AppConfig {
    pub fn new(base_dir: PathBuf, resource_dir: PathBuf) -> Self {

        // Ensure the data directory exists
        std::fs::create_dir_all(&base_dir).ok();

        let env_path = if cfg!(debug_assertions) {
            PathBuf::from(".env")
        } else {
            base_dir.join(".env")
        };

        Self {
            settings_path: base_dir.join("settings.json"),
            bots_path: base_dir.join("excludedBots.json"),
            commands_path: base_dir.join("customcommands.json"),
            playlists_dir: base_dir.join("playlists"),
            version_path: base_dir.join("version.txt"),
            emote_cache_dir: base_dir.join("emote_cache"),
            leaderboard_path: base_dir.join("leaderboard.json"),
            error_log_path: base_dir.join(format!(
                "error-log-{}.log",
                Utc::now().format("%Y-%m-%d-%H-%M-%S")
            )),
            base_dir,
            resource_dir,
            env_path,
        }
    }

   pub fn reload_env(&self) {
    if self.env_path.exists() {
        dotenvy::from_path_override(&self.env_path).ok();
    }
    log::info!("[API] Reloaded environment variables.");
}

  pub fn upsert_env_var(&self, key: &str, value: &str) {
    let env_data = if self.env_path.exists() {
        fs::read_to_string(&self.env_path).unwrap_or_default()
    } else {
        String::new()
    };

    let mut found = false;
    let env_line = format!("{}={}", key, value);

    let updated: Vec<String> = env_data
        .lines()
        .filter(|l| !l.trim().is_empty())        // drop blank lines
        .filter(|l| !l.trim_start().starts_with('#')) // drop comment lines
        .map(|line| {
            if line.starts_with(&format!("{}=", key)) {
                found = true;
                env_line.clone()
            } else {
                line.to_string()
            }
        })
        .collect();

    let mut final_lines = updated;
    if !found {
        final_lines.push(env_line);
    }

    fs::write(&self.env_path, final_lines.join("\n") + "\n").ok();
}

pub fn get_env(&self, key: &str) -> String {
        if !self.env_path.exists() { return String::new(); }
        fs::read_to_string(&self.env_path)
            .unwrap_or_default()
            .lines()
            .find(|l| l.starts_with(&format!("{}=", key)))
            .and_then(|l| l.splitn(2, '=').nth(1))
            .map(str::to_string)
            .unwrap_or_default()
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default, alias = "bg_color")]
    pub bgColor: String,
    #[serde(default)]
    pub scale_size: f64,
    #[serde(default)]
    pub font_family: String,
    #[serde(default)]
    pub font_color: String,
    #[serde(default)]
    pub text_stroke: bool,
    #[serde(default)]
    pub text_stroke_size: f64,
    #[serde(default)]
    pub text_stroke_color: String,
    #[serde(default)]
    pub player_alignment: String,
    #[serde(default)]
    pub scroll_speed: u32,
    #[serde(default)]
    pub hide_on_nothing: bool,
    #[serde(default)]
    pub sub_effects: bool,
    #[serde(default)]
    pub raid_effect: bool,
    #[serde(default)]
    pub sub_effect_types: Vec<String>,
    #[serde(default)]
    pub sub_only_mode: bool,
    #[serde(default)]
    pub emote_static_mode: bool,
    #[serde(default)]
    pub enable_bttv: bool,
    #[serde(default)]
    pub enable_ffz: bool,
    #[serde(default)]
    pub include_twitch_channel_emotes: bool,
    #[serde(default)]
    pub twitch_name: String,
    #[serde(default)]
    pub lastfm_name: String,
    #[serde(default)]
    pub emote_set_id: String,
    #[serde(default)]
    pub emote_lifetime: u64,
    #[serde(default)]
    pub emote_scale: f64,
    #[serde(default)]
    pub emote_delay: u64,
    #[serde(default)]
    pub chat_location_coords: serde_json::Value,
    #[serde(default)]
    pub chat_background_color: String,
    #[serde(default)]
    pub chat_font_color: String,
    #[serde(default)]
    pub max_chat_messages: u32,
    #[serde(default)]
    pub chat_fade_duration: u64,
    #[serde(default)]
    pub chat_fade_transition: u64,
    #[serde(default)]
    pub chat_alignment: String,
    #[serde(default)]
    pub chat_edit_mode: bool,
    #[serde(default)]
    pub chat_width: u32,
    #[serde(default)]
    pub chat_height: u32,
    #[serde(default)]
    pub chat_font_size: u32,
    #[serde(default)]
    pub chat_font_bold: bool,
    #[serde(default)]
    pub chat_effect_rainbow_text: bool,
    #[serde(default)]
    pub chat_effect_rainbow_text_chance: u32,
    #[serde(default)]
    pub chat_effect_jumping_text: bool,
    #[serde(default)]
    pub chat_effect_jumping_text_chance: u32,
    #[serde(default)]
    pub chat_effect_scatter_text: bool,
    #[serde(default)]
    pub chat_effect_scatter_text_chance: u32,
    #[serde(default)]
    pub yap_meter_threshold: f64,
    #[serde(default)]
    pub yap_meter_silence_threshold: u32,
    #[serde(default)]
    pub yap_meter_max_yap: u32,
    #[serde(default)]
    pub yap_meter_length: u32,
    #[serde(default)]
    pub yap_meter_blabbering_emote: String,
    #[serde(default)]
    pub yap_meter_yapping_emote: String,
    #[serde(default)]
    pub sub_effect_hue_shift_chance: u32,
    #[serde(default)]
    pub sub_effect_black_hole_chance: u32,
    #[serde(default)]
    pub sub_effect_black_hole_duration: u32,
    #[serde(default)]
    pub sub_effect_black_hole_strength: u32,
    #[serde(default)]
    pub sub_effect_reverse_gravity_chance: u32,
    #[serde(default)]
    pub sub_effect_reverse_gravity_strength: u32,
    #[serde(default)]
    pub sub_effect_reverse_gravity_duration: u32,
    #[serde(default)]
    pub sub_effect_gravity_event_chance: u32,
    #[serde(default)]
    pub sub_effect_gravity_event_duration: u32,
    #[serde(default)]
    pub sub_effect_gravity_event_strength: u32,
    #[serde(default)]
    pub battle_event_chance: u32,
    #[serde(default)]
    pub battle_event_participants: u32,
    #[serde(default)]
    pub battle_event_hp: u32,
    #[serde(default)]
    pub battle_event_damage: u32,
    #[serde(default)]
    pub battle_event_duration: u32,
    #[serde(default)]
    pub battle_event_dps_tracker: bool,
    #[serde(default)]
    pub battle_event_dps_tracker_live: bool,
    #[serde(default)]
    pub battle_event_dps_tracker_live_float_left: bool,
    #[serde(default)]
    pub battle_event_dps_tracker_float_left: bool,
    #[serde(default)]
    pub battle_event_leaderboard_float_left: bool,
    #[serde(default)]
    pub battle_event_accept_plebs: bool,
    #[serde(default)]
    pub battle_event_show_skill_history: bool,
    #[serde(default)]
    pub max_song_length: u32,
    #[serde(default)]
    pub redeem_feed: String,
    #[serde(default)]
    pub redeem_song_request: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        serde_json::from_str("{}").unwrap_or_else(|_| Self {
            bgColor: "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0,0,0,1) 100%)".into(),
            scale_size: 2.0,
            font_family: "Arial, sans-serif".into(),
            font_color: "#ffffff".into(),
            text_stroke: false,
            text_stroke_size: 0.0,
            text_stroke_color: "rgba(0, 0, 0, 1)".into(),
            player_alignment: "right".into(),
            scroll_speed: 25,
            hide_on_nothing: false,
            sub_effects: false,
            raid_effect: false,
            sub_effect_types: vec![],
            sub_only_mode: false,
            emote_static_mode: false,
            enable_bttv: true,
            enable_ffz: true,
            include_twitch_channel_emotes: true,
            twitch_name: String::new(),
            lastfm_name: String::new(),
            emote_set_id: String::new(),
            emote_lifetime: 5000,
            emote_scale: 1.0,
            emote_delay: 150,
            chat_location_coords: serde_json::json!({"x": 0, "y": 0}),
            chat_background_color: "rgba(0, 0, 0, 0)".into(),
            chat_font_color: "#ffffff".into(),
            max_chat_messages: 10,
            chat_fade_duration: 10000,
            chat_fade_transition: 2000,
            chat_alignment: "left".into(),
            chat_edit_mode: false,
            chat_width: 800,
            chat_height: 300,
            chat_font_size: 14,
            chat_font_bold: false,
            chat_effect_rainbow_text: false,
            chat_effect_rainbow_text_chance: 10,
            chat_effect_jumping_text: false,
            chat_effect_jumping_text_chance: 10,
            chat_effect_scatter_text: false,
            chat_effect_scatter_text_chance: 10,
            yap_meter_threshold: 1.0,
            yap_meter_silence_threshold: 3,
            yap_meter_max_yap: 60,
            yap_meter_length: 300,
            yap_meter_blabbering_emote: "BLABBERING".into(),
            yap_meter_yapping_emote: "yapping".into(),
            sub_effect_hue_shift_chance: 5,
            sub_effect_black_hole_chance: 5,
            sub_effect_black_hole_duration: 15,
            sub_effect_black_hole_strength: 5,
            sub_effect_reverse_gravity_chance: 5,
            sub_effect_reverse_gravity_strength: 2,
            sub_effect_reverse_gravity_duration: 15,
            sub_effect_gravity_event_chance: 5,
            sub_effect_gravity_event_duration: 15,
            sub_effect_gravity_event_strength: 1,
            battle_event_chance: 5,
            battle_event_participants: 8,
            battle_event_hp: 300,
            battle_event_damage: 50,
            battle_event_duration: 60,
            battle_event_dps_tracker: true,
            battle_event_dps_tracker_live: true,
            battle_event_dps_tracker_live_float_left: false,
            battle_event_dps_tracker_float_left: false,
            battle_event_leaderboard_float_left: false,
            battle_event_accept_plebs: false,
            battle_event_show_skill_history: true,
            max_song_length: 0,
            redeem_feed: String::new(),
            redeem_song_request: String::new(),
        })
    }
}

impl AppSettings {
    pub fn load(path: &PathBuf) -> Self {
        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    pub fn save(&self, path: &PathBuf) -> Result<(), String> {
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(path, content)
            .map_err(|e| format!("Failed to write settings: {}", e))
    }   
}