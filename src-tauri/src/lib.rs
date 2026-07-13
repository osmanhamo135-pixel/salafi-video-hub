pub mod commands;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database before app starts
    let db_state = match db::init_database() {
        Ok(db) => db,
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            // Remember only size/position/maximized. The default flags also
            // restore DECORATIONS, which re-applied the old native title bar
            // saved by previous versions on top of the custom themed one.
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .manage(db_state)
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(e) = utils::paths::ensure_app_data_dirs(&handle) {
                    eprintln!("Failed to create app data directories: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::video::import_folder,
            commands::video::import_single_video,
            commands::video::get_video,
            commands::video::get_all_videos,
            commands::video::get_videos_by_ids,
            commands::video::get_videos_by_playlist,
            commands::video::update_video_progress,
            commands::video::update_video_favorite,
            commands::video::update_video_watch_later,
            commands::video::update_video_metadata,
            commands::video::search_videos,
            commands::video::delete_video_from_library,
            commands::playlist::get_all_playlists,
            commands::playlist::get_playlist,
            commands::playlist::update_playlist_name,
            commands::playlist::update_playlist_category,
            commands::playlist::remove_playlist_from_library,
            commands::playlist::delete_playlist_and_files,
            commands::playlist::rescan_playlist,
            commands::playlist::get_playlist_stats,
            commands::reminder::create_reminder,
            commands::reminder::get_all_reminders,
            commands::reminder::update_reminder,
            commands::reminder::delete_reminder,
            commands::reminder::toggle_reminder,
            commands::reminder::mark_reminder_triggered,
            commands::reminder::allow_reminder_sound_path,
            commands::reminder::test_reminder_sound,
            commands::downloader::download_youtube_video,
            commands::youtube::youtube_search,
            commands::youtube::youtube_resolve,
            commands::radio::get_radio_stations,
            commands::diagnostics::get_diagnostics,
            commands::quran::get_quran_surahs,
            commands::quran::get_quran_surah,
            commands::quran::get_quran_reciters,
            commands::quran::get_quran_timing_reads,
            commands::quran::get_quran_ayah_timings,
            commands::quran::get_quran_word_timing_reads,
            commands::quran::get_quran_synced_audio,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::add_imported_folder,
            commands::settings::remove_imported_folder,
            commands::settings::get_ffmpeg_status,
            commands::settings::set_ffmpeg_path,
            commands::settings::get_app_data_path,
            commands::settings::export_backup,
            commands::settings::import_backup,
            commands::settings::rescan_all,
            commands::settings::repair_database,
            commands::settings::remove_orphaned_entries,
            commands::settings::play_sound,
            commands::settings::open_app_data_folder,
            commands::playback::save_progress,
            commands::playback::get_progress,
            commands::playback::get_continue_watching,
            commands::playback::get_recently_added,
            commands::ffmpeg::detect_ffmpeg,
            commands::ffmpeg::install_ffmpeg_helper,
            commands::ffmpeg::generate_thumbnail,
            commands::ffmpeg::get_video_metadata,
            commands::ffmpeg::clear_thumbnail_cache,
            commands::ffmpeg::regenerate_missing_thumbnails,
            commands::ffmpeg::set_thumbnail_generation_paused,
            commands::file_ops::convert_file_src,
            commands::file_ops::allow_video_asset_path,
            commands::file_ops::open_file_location,
            commands::file_ops::open_file_externally,
            commands::file_ops::check_file_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
