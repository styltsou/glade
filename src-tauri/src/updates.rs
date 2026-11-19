//! Whether this copy of Glade should look for a newer release.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::utils::{config::BundleType, platform::bundle_type};

static CLAIMED: AtomicBool = AtomicBool::new(false);

/// True only for the release bundles the updater knows how to install in
/// place (the AppImage on Linux, the Windows installers), and only for the
/// first window that asks, so several windows don't each download the update.
/// Dev builds and the plain binary from `bun run install:local` have no bundle
/// type; the updater would otherwise overwrite that binary with an AppImage.
#[tauri::command]
pub fn claim_update_check() -> bool {
    let supported = matches!(
        bundle_type(),
        Some(BundleType::AppImage | BundleType::Nsis | BundleType::Msi)
    );
    supported && !CLAIMED.swap(true, Ordering::SeqCst)
}
