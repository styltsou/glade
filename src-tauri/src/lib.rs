mod commands;
mod config;
mod error;
mod types;
mod vault;

use commands::{
    create_folder, create_note, delete_entry, duplicate_note, get_pinned_notes, get_recent_notes,
    get_sidebar_state, list_tags, list_vault, pin_note, read_note, record_note_opened,
    rename_note, save_sidebar_state, search_notes, unpin_note, update_tags, write_note,
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
            rename_note,
            duplicate_note,
            get_pinned_notes,
            get_recent_notes,
            pin_note,
            unpin_note,
            record_note_opened,
            get_sidebar_state,
            save_sidebar_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
