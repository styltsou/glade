mod commands;
mod config;
mod error;
mod types;
mod vault;

use commands::{
    create_folder, create_note, create_vault, delete_entry, delete_vault, duplicate_note,
    export_markdown, export_pdf, get_active_vault, get_pinned_notes, get_recent_notes,
    get_sidebar_state, initialize_app, list_tags, list_vault, list_vaults, pin_note, read_note,
    read_note_raw, record_note_opened, rename_folder, rename_note, rename_vault, save_sidebar_state,
    search_notes, set_active_vault, unpin_note, update_tags, update_vault_last_opened, write_note,
    move_entry, get_notes_in_folder,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            initialize_app,
            list_vaults,
            get_active_vault,
            set_active_vault,
            create_vault,
            rename_vault,
            delete_vault,
            update_vault_last_opened,
            list_vault,
            read_note,
            write_note,
            create_note,
            delete_entry,
            create_folder,
            search_notes,
            list_tags,
            update_tags,
            rename_folder,
            rename_note,
            duplicate_note,
            get_pinned_notes,
            get_recent_notes,
            pin_note,
            unpin_note,
            get_notes_in_folder,
            record_note_opened,
            get_sidebar_state,
            save_sidebar_state,
            read_note_raw,
            export_markdown,
            export_pdf,
            move_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
