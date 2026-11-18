//! One-time upgrade from app-owned vaults (`~/.glade/vaults/*`) to the
//! file-first model. Files are never moved; vaults become pinned folders.

use std::fs;
use std::path::Path;

use crate::error::AppError;
use crate::frontmatter;
use crate::types::AppConfig;
use crate::vault;
use crate::workspace_state;

pub const SCHEMA_VERSION: u32 = 2;

/// Keys older Glade versions wrote into notes.
const LEGACY_KEYS: [&str; 2] = ["id", "pinned"];

/// Pin each legacy vault in place and carry `pinned: true` notes into app
/// state. Returns whether the config changed.
pub fn migrate(cfg: &mut AppConfig, vaults_root: &Path, state_base: &Path) -> Result<bool, AppError> {
    if cfg.schema_version >= SCHEMA_VERSION {
        return Ok(false);
    }

    for v in cfg.vaults.clone() {
        let dir = vaults_root.join(&v.slug);
        if !dir.is_dir() {
            continue;
        }
        let canon = fs::canonicalize(&dir).unwrap_or(dir.clone());
        let canon_str = canon.to_string_lossy().to_string();
        if !cfg.pinned_folders.contains(&canon_str) {
            cfg.pinned_folders.push(canon_str.clone());
        }

        let mut state = workspace_state::load_in(state_base, &canon);
        let mut has_legacy = false;
        for rel in vault::scan_root(&canon)?.files {
            let Ok(content) = fs::read_to_string(canon.join(&rel)) else { continue };
            let rel_str = rel.to_string_lossy().to_string();
            if frontmatter::get_scalar_string(&content, &["pinned"]).as_deref() == Some("true")
                && !state.pinned.contains(&rel_str)
            {
                state.pinned.push(rel_str);
            }
            has_legacy |= LEGACY_KEYS.iter().any(|k| frontmatter::has_key(&content, k));
        }
        workspace_state::save_in(state_base, &canon, &state)?;
        if has_legacy && !cfg.legacy_cleanup_roots.contains(&canon_str) {
            cfg.legacy_cleanup_roots.push(canon_str);
        }
    }

    cfg.schema_version = SCHEMA_VERSION;
    Ok(true)
}

/// Remove the legacy `id` and `pinned` keys from every note under `root`,
/// touching only those lines. Returns how many files changed.
pub fn cleanup_legacy_keys(root: &Path) -> Result<usize, AppError> {
    let mut changed = 0;
    for rel in vault::scan_root(root)?.files {
        let path = root.join(&rel);
        let Ok(original) = fs::read_to_string(&path) else { continue };
        let mut content = original.clone();
        for key in LEGACY_KEYS {
            if frontmatter::has_key(&content, key) {
                if let Ok(next) = frontmatter::remove_key(&content, key) {
                    content = next;
                }
            }
        }
        if content != original {
            crate::watch::write_file(&path, content)?;
            changed += 1;
        }
    }
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Vault;

    fn vault_entry(slug: &str) -> Vault {
        Vault {
            id: slug.into(),
            name: slug.into(),
            slug: slug.into(),
            git_remote: None,
            created_at: String::new(),
            last_opened: String::new(),
        }
    }

    #[test]
    fn pins_vaults_in_place_and_carries_pinned_notes() {
        let vaults = tempfile::tempdir().unwrap();
        let base = tempfile::tempdir().unwrap();
        let work = vaults.path().join("work");
        fs::create_dir_all(&work).unwrap();
        fs::write(work.join("a.md"), "---\nid: x\npinned: true\ntitle: A\n---\nbody\n").unwrap();
        fs::write(work.join("b.md"), "plain\n").unwrap();

        let mut cfg = AppConfig { vaults: vec![vault_entry("work"), vault_entry("gone")], ..Default::default() };
        assert!(migrate(&mut cfg, vaults.path(), base.path()).unwrap());

        let canon = fs::canonicalize(&work).unwrap();
        assert_eq!(cfg.pinned_folders, vec![canon.to_string_lossy().to_string()]);
        assert_eq!(cfg.legacy_cleanup_roots.len(), 1);
        assert_eq!(workspace_state::load_in(base.path(), &canon).pinned, vec!["a.md"]);
        // Files untouched.
        assert!(fs::read_to_string(work.join("a.md")).unwrap().contains("pinned: true"));

        // Second run is a no-op, even if the user removed the pinned folder.
        cfg.pinned_folders.clear();
        assert!(!migrate(&mut cfg, vaults.path(), base.path()).unwrap());
        assert!(cfg.pinned_folders.is_empty());
    }

    #[test]
    fn cleanup_removes_only_legacy_lines() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "---\n# keep\nid: x\ntitle: T\npinned: true\n---\nbody\n").unwrap();
        fs::write(dir.path().join("b.md"), "---\nid: y\n---\nonly id\n").unwrap();
        fs::write(dir.path().join("c.md"), "untouched\n").unwrap();

        assert_eq!(cleanup_legacy_keys(dir.path()).unwrap(), 2);
        assert_eq!(
            fs::read_to_string(dir.path().join("a.md")).unwrap(),
            "---\n# keep\ntitle: T\n---\nbody\n"
        );
        assert_eq!(fs::read_to_string(dir.path().join("b.md")).unwrap(), "only id\n");
        assert_eq!(fs::read_to_string(dir.path().join("c.md")).unwrap(), "untouched\n");
    }
}
