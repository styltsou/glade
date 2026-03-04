mod commands;
mod error;
mod types;
mod vault;

use commands::{
    create_folder, create_note, delete_entry, list_tags, list_vault, read_note, search_notes,
    update_tags, write_note,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_vault,
            read_note,
            write_note,
            create_note,
            delete_entry,
            create_folder,
            search_notes,
            list_tags,
            update_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
