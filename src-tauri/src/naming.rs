//! File names Glade makes up. Names the user types are used as typed.

use regex::Regex;

/// The stem of a new note, until its first title names the file.
pub const UNTITLED: &str = "untitled";

const MAX_CHARS: usize = 80;
/// File systems cap names at 255 bytes; this leaves room for `-copy-12.markdown`.
const MAX_BYTES: usize = 200;

/// `untitled`, `untitled-2` or `Untitled 3`: a file still waiting for its name.
pub fn is_untitled(stem: &str) -> bool {
    Regex::new(r"(?i)^untitled(?:[- ][0-9]+)?$").unwrap().is_match(stem)
}

/// A kebab-case file stem for a title, in the title's own script. None when the
/// title has nothing to make a name from.
pub fn slug(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    // Apostrophes don't split words; variation selectors are invisible.
    let joined = Regex::new(r"['’\x{FE00}-\x{FE0F}]").unwrap().replace_all(&lower, "");
    let dashed = Regex::new(r"[^\p{L}\p{M}\p{N}]+").unwrap().replace_all(&joined, "-");
    let full = dashed.trim_matches('-');
    if !full.chars().any(char::is_alphanumeric) {
        return None;
    }

    let mut end = 0;
    for (count, (at, c)) in full.char_indices().enumerate() {
        if count == MAX_CHARS || at + c.len_utf8() > MAX_BYTES {
            break;
        }
        end = at + c.len_utf8();
    }
    let mut cut = &full[..end];
    if end < full.len() && !full[end..].starts_with('-') {
        // Don't end on half a word, unless it is all one word.
        if let Some(dash) = cut.rfind('-') {
            cut = &cut[..dash];
        }
    }
    let name = cut.trim_matches('-').to_string();
    // Device names, which Windows can't use as file names.
    let reserved = Regex::new(r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])$").unwrap().is_match(&name);
    Some(if reserved { format!("{name}-note") } else { name })
}

/// What a copy of `stem` is based on: `plan-copy-2` is another copy of `plan`.
pub fn without_copy_suffix(stem: &str) -> String {
    Regex::new(r"(?:-copy(?:-[0-9]+)?|\s*\(copy(?: [0-9]+)?\))$").unwrap().replace(stem, "").to_string()
}

/// Check a file name the user typed (without the extension) and return it as
/// it will be used. Typing the file's own extension too is harmless.
pub fn checked_stem(typed: &str, ext: &str) -> Result<String, String> {
    let typed = typed.trim();
    let suffix = format!(".{ext}").to_lowercase();
    let stem = if typed.to_lowercase().ends_with(&suffix) && typed.is_char_boundary(typed.len() - suffix.len()) {
        typed[..typed.len() - suffix.len()].trim_end()
    } else {
        typed
    };
    if stem.is_empty() {
        return Err("Enter a file name".into());
    }
    if stem.starts_with('.') {
        return Err("A name starting with a dot would hide the note".into());
    }
    if let Some(bad) = stem.chars().find(|c| c.is_control() || r#"/\:*?"<>|"#.contains(*c)) {
        return Err(if bad.is_control() {
            "A file name can't contain line breaks or control characters".into()
        } else {
            format!("A file name can't contain {bad}")
        });
    }
    if stem.len() + suffix.len() > 255 {
        return Err("That name is too long".into());
    }
    Ok(stem.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn untitled_names() {
        for name in ["untitled", "untitled-2", "Untitled", "Untitled 13"] {
            assert!(is_untitled(name), "{name}");
        }
        for name in ["untitled-draft", "untitled-copy", "my untitled", "untitled2", "README"] {
            assert!(!is_untitled(name), "{name}");
        }
    }

    #[test]
    fn slugs() {
        let s = |t: &str| slug(t).unwrap();
        assert_eq!(s("Meeting Notes"), "meeting-notes");
        assert_eq!(s("  What's new: v2.1 / beta?  "), "whats-new-v2-1-beta");
        assert_eq!(s("snake_case and CamelCase"), "snake-case-and-camelcase");
        assert_eq!(s("🚀 Launch ☀\u{FE0F} day"), "launch-day");
        assert_eq!(s("../../etc"), "etc");
        assert_eq!(s("CON"), "con-note");
    }

    #[test]
    fn slugs_keep_their_script() {
        let s = |t: &str| slug(t).unwrap();
        assert_eq!(s("Σημειώσεις Έργου"), "σημειώσεις-έργου");
        assert_eq!(s("ΣΧΕΔΙΟΣ"), "σχεδιος");
        assert_eq!(s("会議 メモ"), "会議-メモ");
        assert_eq!(s("हिन्दी नोट"), "हिन्दी-नोट");
        assert_eq!(s("Cafe\u{301} list"), "cafe\u{301}-list");
    }

    #[test]
    fn titles_without_a_name_in_them() {
        for title in ["", "   ", "?!", "🚀", "☀\u{FE0F}"] {
            assert_eq!(slug(title), None, "{title:?}");
        }
    }

    #[test]
    fn long_titles_are_cut_between_words_and_within_the_byte_limit() {
        let words = slug(&"word ".repeat(40)).unwrap();
        assert!(words.chars().count() <= MAX_CHARS && words.ends_with("word"));
        let cjk = slug(&"会".repeat(120)).unwrap();
        assert!(!cjk.is_empty() && cjk.len() <= MAX_BYTES);
    }

    #[test]
    fn typed_names_are_respected_or_refused() {
        assert_eq!(checked_stem(" My File ", "md"), Ok("My File".into()));
        assert_eq!(checked_stem("plan.MD", "md"), Ok("plan".into()));
        assert_eq!(checked_stem("v1.2", "md"), Ok("v1.2".into()));
        for bad in ["", " ", ".md", ".hidden", "a/b", "a\\b", "what?", "two\nlines"] {
            assert!(checked_stem(bad, "md").is_err(), "{bad:?}");
        }
    }
}
