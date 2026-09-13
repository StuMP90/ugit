mod git;
mod github;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Without this, a stalled network connection (e.g. SSH's port 22 being
    // silently dropped by a firewall/sandbox instead of refused) leaves any
    // push/fetch/pull hanging on the OS's own TCP timeout — often a minute or
    // more — during which the whole window appears frozen. Capping it here
    // makes that fail fast with a clear error instead.
    unsafe {
        let _ = git2::opts::set_server_connect_timeout_in_milliseconds(10_000);
        let _ = git2::opts::set_server_timeout_in_milliseconds(30_000);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            git::open_repository,
            git::init_repository,
            git::add_remote,
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
            git::get_repo_state,
            git::merge_branch,
            git::merge_abort,
            git::start_rebase,
            git::rebase_continue,
            git::rebase_abort,
            git::read_working_file,
            git::write_working_file,
            git::resolve_conflict,
            git::reset_to_commit,
            git::clone_repository,
            github::github_start_device_flow,
            github::github_poll_device_flow,
            github::github_is_signed_in,
            github::github_sign_out,
            github::github_get_username,
            github::github_list_repos,
            github::github_create_repo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
