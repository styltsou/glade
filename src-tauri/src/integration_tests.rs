//! End-to-end check on a real tree: browse, tag and rename inside a git copy
//! of this repository's docs, then confirm `git diff` shows only the intended
//! lines changed.

use std::fs;
use std::path::Path;
use std::process::Command;

use crate::{frontmatter, links, vault};

fn git(dir: &Path, args: &[&str]) -> String {
    let out = Command::new("git")
        .args(["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"])
        .args(args)
        .current_dir(dir)
        .output()
        .expect("git available");
    String::from_utf8_lossy(&out.stdout).to_string()
}

fn copy_dir(from: &Path, to: &Path) {
    fs::create_dir_all(to).unwrap();
    for e in fs::read_dir(from).unwrap().flatten() {
        let (src, dst) = (e.path(), to.join(e.file_name()));
        if src.is_dir() {
            copy_dir(&src, &dst);
        } else {
            fs::copy(&src, &dst).unwrap();
        }
    }
}

#[test]
fn browse_tag_and_rename_leave_a_minimal_diff() {
    let repo = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    copy_dir(&repo.join("docs"), &root.join("docs"));
    fs::copy(repo.join("README.md"), root.join("README.md")).unwrap();
    git(root, &["init", "-q"]);
    git(root, &["add", "-A"]);
    git(root, &["commit", "-q", "-m", "base"]);

    // Browse: scan, read titles/tags/properties of every note.
    let scan = vault::scan_root(root).unwrap();
    assert!(scan.files.len() >= 8, "expected the repo docs, got {}", scan.files.len());
    for rel in &scan.files {
        let content = fs::read_to_string(root.join(rel)).unwrap();
        let _ = vault::parse_frontmatter(&content);
        let _ = frontmatter::properties(&content);
    }
    assert_eq!(git(root, &["status", "--porcelain"]), "", "browsing must not modify any file");

    // Tag one doc that has no frontmatter: it gains only a 3-line block.
    let known = root.join("docs/known_issues.md");
    let before = fs::read_to_string(&known).unwrap();
    assert!(frontmatter::split(&before).is_none());
    let tagged = frontmatter::set_tags(&before, &["triage".to_string()]).unwrap();
    fs::write(&known, tagged).unwrap();
    let numstat = git(root, &["diff", "--numstat", "docs/known_issues.md"]);
    assert_eq!(numstat.split_whitespace().take(2).collect::<Vec<_>>(), ["3", "0"], "{numstat}");
    git(root, &["checkout", "-q", "--", "."]);

    // Move a doc that others link to, then update the links that point at it.
    let old = root.join("docs/feature-backlog.md");
    let new = root.join("docs/backlog.md");
    let (n_links, n_files) = links::inbound_counts(root, &old).unwrap();
    assert!(n_links >= 1 && n_files >= 1, "README links to the backlog");
    fs::rename(&old, &new).unwrap();
    links::apply_inbound(root, &old, &new).unwrap();

    let status = git(root, &["status", "--porcelain"]);
    for line in status.lines() {
        let path = line[3..].to_string();
        assert!(
            path == "README.md" || path.starts_with("docs/"),
            "unexpected change: {line}"
        );
    }
    // Only the link targets changed in the linking files.
    let diff = git(root, &["diff", "-U0", "README.md"]);
    let changed: Vec<&str> = diff.lines().filter(|l| l.starts_with('+') || l.starts_with('-')).filter(|l| !l.starts_with("+++") && !l.starts_with("---")).collect();
    assert_eq!(changed.len(), 2, "one line replaced: {diff}");
    assert!(changed[0].contains("feature-backlog.md") && changed[1].contains("backlog.md"));
    // The moved file itself is byte-identical.
    assert_eq!(
        fs::read(&new).unwrap(),
        Command::new("git").args(["show", "HEAD:docs/feature-backlog.md"]).current_dir(root).output().unwrap().stdout
    );
}
