mod git;

use git::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            git::open_repository,
            git::get_status,
            git::get_log,
            git::get_branches,
            git::get_remotes,
            git::get_tags,
            git::get_commit_diff,
            git::get_working_diff,
            git::stage_file,
            git::unstage_file,
            git::stage_all,
            git::unstage_all,
            git::discard_file_changes,
            git::commit,
            git::checkout_branch,
            git::create_branch,
            git::delete_branch,
            git::fetch,
            git::pull,
            git::push,
            git::stash_list,
            git::stash_save,
            git::stash_pop,
            git::stash_apply,
            git::stash_drop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
