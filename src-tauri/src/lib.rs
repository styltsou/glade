mod commands;
mod frontmatter;
mod launch;
#[cfg(test)]
mod integration_tests;
mod links;
mod migration;
mod naming;
mod relocate;
mod config;
mod error;
mod types;
mod updates;
mod vault;
mod watch;
mod workspace;
mod workspace_state;

use tauri::Manager;
use commands::{
    record_file_opened, get_home_data, pin_folder,
    unpin_folder, remove_from_glade, locate_folder,
    create_folder, create_note, delete_entry, duplicate_note,
    export_markdown, export_pdf, get_pinned_notes, get_recent_notes, write_file,
    get_sidebar_state, initialize_app, list_tags, list_vault, pin_note, read_note,
    read_note_raw, record_note_opened, rename_folder, set_note_title, name_untitled_note, discard_empty_note, rename_note_file, title_file_name, save_sidebar_state, set_property, remove_property, set_frontmatter_text,
    search_notes, unpin_note, update_tags, rename_tag, write_note,
    move_entry, get_notes_in_folder, };

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(workspace::Workspaces::default())
        .manage(watch::Watchers::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Remember each window's size, position and maximized state between runs.
        .plugin(
            // Not VISIBLE or DECORATIONS: the frontend shows the window itself, and it is frameless.
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .with_filter(|label| !label.starts_with("export-pdf-"))
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let paths: Vec<String> = args.into_iter().skip(1).collect();
            let opened = launch::handle_args(app, &paths, std::path::Path::new(&cwd));
            if opened == 0 {
                if let Some((_, w)) = app.webview_windows().into_iter().next() {
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                }
            }
        }))
        .register_uri_scheme_protocol("glade-img", |_ctx, request| {
            // Serves local images only (never other file types), so notes can
            // show images from anywhere on disk without broad file access.
            match links::read_image(request.uri().path()) {
                Some((mime, bytes)) => tauri::http::Response::builder()
                    .header("Content-Type", mime)
                    .body(bytes)
                    .unwrap(),
                None => tauri::http::Response::builder().status(404).body(Vec::new()).unwrap(),
            }
        })
        .setup(|app| {
            launch::startup(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                app.state::<workspace::Workspaces>().clear(window.label());
                watch::stop(app, window.label());
                // Keep the previous session when the last window goes away, so
                // quitting by closing windows still restores them next time.
                let others = app.webview_windows().keys().any(|l| l != window.label());
                if others {
                    launch::persist_session(app);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            initialize_app,
            list_vault,
            read_note,
            write_note,
            create_note,
            delete_entry,
            create_folder,
            search_notes,
            list_tags,
            update_tags,
            rename_tag,
            rename_folder,
            set_note_title,
            name_untitled_note,
            discard_empty_note,
            rename_note_file,
            title_file_name,
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
            write_file,
            move_entry,
            set_property,
            watch::check_external,
            commands::classify_links,
            commands::import_image_file,
            commands::save_pasted_image,
            commands::create_linked_note,
            commands::list_dir_markdown,
            commands::get_backlinks,
            commands::preview_link_updates,
            commands::apply_link_updates,
            set_frontmatter_text,
            remove_property,
            launch::open_path_cmd,
            launch::get_window_target,
            launch::close_target,
            commands::repo_root_of,
            commands::get_workspace_ui,
            commands::save_workspace_ui,
            commands::cleanup_legacy,
            commands::legacy_cleanup_pending,
            commands::dismiss_legacy_cleanup,
            record_file_opened,
            get_home_data,
            pin_folder,
            unpin_folder,
            remove_from_glade,
            locate_folder,
            updates::claim_update_check,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // macOS delivers file-association opens as an event, not as args.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        let _ = launch::open_path(_app, &path, None);
                    }
                }
            }
        });
}
