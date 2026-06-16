// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
   let args: Vec<String> = std::env::args().collect();
    let debug_mode = args.contains(&"--debug".to_string());

    #[cfg(target_os = "windows")]
    if debug_mode {
        unsafe {
            windows::Win32::System::Console::AllocConsole().ok();
        }
        std::env::set_var("RUST_LOG", "info");
        env_logger::init();
    }

  app_lib::run();
}
