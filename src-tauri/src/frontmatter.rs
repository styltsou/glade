//! Format-preserving frontmatter handling.
//!
//! Frontmatter is treated as text, never re-serialized as a whole. Reads parse
//! the YAML for display; writes locate the exact lines of one key and replace
//! only those, leaving every other byte (order, comments, quoting, unknown
//! keys) untouched.

use serde_yaml::{Mapping, Value};

/// A markdown file split into its frontmatter block and body.
#[derive(Debug, PartialEq, Eq)]
pub struct Parts<'a> {
    /// Opening fence through closing fence line, including its line ending.
    pub head: &'a str,
    /// Lines between the fences.
    pub yaml: &'a str,
    /// Everything after the closing fence line, verbatim.
    pub body: &'a str,
}

/// Split a file into frontmatter and body. Returns `None` when the file has no
/// frontmatter block (it must start at byte 0 with a `---` line).
pub fn split(content: &str) -> Option<Parts<'_>> {
    let first_end = content.find('\n')?;
    if content[..first_end].trim_end() != "---" {
        return None;
    }
    let yaml_start = first_end + 1;
    let mut pos = yaml_start;
    while pos < content.len() {
        let rest = &content[pos..];
        let len = rest.find('\n').map(|i| i + 1).unwrap_or(rest.len());
        let line = rest[..len].trim_end();
        if line == "---" || line == "..." {
            return Some(Parts {
                head: &content[..pos + len],
                yaml: &content[yaml_start..pos],
                body: &content[pos + len..],
            });
        }
        pos += len;
    }
    None
}

/// Body text of a file (everything after frontmatter, or the whole file).
pub fn body_of(content: &str) -> &str {
    split(content).map(|p| p.body).unwrap_or(content)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeySpan {
    pub key: String,
    /// Byte range within the yaml text, covering the key line and its
    /// continuation lines, including the final line ending.
    pub start: usize,
    pub end: usize,
}

/// Parse a top-level `key:` line. Returns the key and the byte offset in the
/// line where the value text begins (after the colon and following spaces).
fn parse_key(line: &str) -> Option<(String, usize)> {
    let first = line.chars().next()?;
    if first.is_whitespace() || matches!(first, '#' | '-' | '[' | '{' | '?' | '&' | '*' | '!' | '|' | '>' | '%' | '@' | '`') {
        // `-` only disqualifies list items; plain keys may not start with it here.
        return None;
    }
    let (key, colon_at) = if first == '"' || first == '\'' {
        let mut i = 1;
        let bytes = line.as_bytes();
        let mut end = None;
        while i < bytes.len() {
            if first == '"' && bytes[i] == b'\\' {
                i += 2;
                continue;
            }
            if bytes[i] == first as u8 {
                if first == '\'' && bytes.get(i + 1) == Some(&b'\'') {
                    i += 2;
                    continue;
                }
                end = Some(i);
                break;
            }
            i += 1;
        }
        let end = end?;
        let after = line[end + 1..].trim_start();
        if !after.starts_with(':') {
            return None;
        }
        let colon = line.len() - after.len();
        (line[1..end].to_string(), colon)
    } else {
        let mut found = None;
        for (i, c) in line.char_indices() {
            if c == ':' {
                let next = line[i + 1..].chars().next();
                if next.map_or(true, |n| n == ' ' || n == '\t' || n == '\r' || n == '\n') {
                    found = Some(i);
                    break;
                }
            }
        }
        let i = found?;
        (line[..i].trim_end().to_string(), i)
    };
    let mut value_at = colon_at + 1;
    while line[value_at..].starts_with(' ') || line[value_at..].starts_with('\t') {
        value_at += 1;
    }
    Some((key, value_at))
}

fn is_continuation(line: &str) -> bool {
    line.starts_with(' ') || line.starts_with('\t') || line.starts_with("- ") || line.trim_end() == "-"
}

/// Locate the lines of every top-level key.
pub fn key_spans(yaml: &str) -> Vec<KeySpan> {
    let mut spans: Vec<KeySpan> = Vec::new();
    let mut pos = 0;
    // End of the last line that belongs to the current key.
    let mut current: Option<(String, usize, usize)> = None;
    while pos < yaml.len() {
        let rest = &yaml[pos..];
        let len = rest.find('\n').map(|i| i + 1).unwrap_or(rest.len());
        let line = &rest[..len];
        let stripped = line.trim_end_matches(['\n', '\r']);
        if let Some((key, _)) = parse_key(stripped) {
            if let Some((k, s, e)) = current.take() {
                spans.push(KeySpan { key: k, start: s, end: e });
            }
            current = Some((key, pos, pos + len));
        } else if let Some((k, s, e)) = current.take() {
            if is_continuation(stripped) {
                current = Some((k, s, pos + len));
            } else if stripped.trim().is_empty() {
                // Blank: only part of the span if more continuation follows.
                current = Some((k, s, e));
            } else {
                spans.push(KeySpan { key: k, start: s, end: e });
            }
        }
        pos += len;
    }
    if let Some((k, s, e)) = current {
        spans.push(KeySpan { key: k, start: s, end: e });
    }
    spans
}

/// Frontmatter as sent to the Properties panel.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct Properties {
    /// "none" (no block), "invalid" (shown raw, never edited) or "ok".
    pub status: String,
    /// Text between the fences (for "Edit as text"); empty when there is no block.
    pub yaml: String,
    pub entries: Vec<Entry>,
}

pub fn properties(content: &str) -> Properties {
    let yaml = split(content).map(|p| p.yaml.to_string()).unwrap_or_default();
    match parse(content) {
        Parsed::None => Properties { status: "none".into(), ..Default::default() },
        Parsed::Invalid(_) => Properties { status: "invalid".into(), yaml, entries: vec![] },
        Parsed::Entries(entries) => Properties { status: "ok".into(), yaml, entries },
    }
}

/// How the frontmatter of a file reads.
#[derive(Debug, Clone, PartialEq)]
pub enum Parsed {
    /// No frontmatter block.
    None,
    /// A block exists but is not valid YAML mapping; shown raw, never edited.
    Invalid(String),
    Entries(Vec<Entry>),
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Entry {
    pub key: String,
    pub value: serde_json::Value,
    /// Original text of this key's lines.
    pub raw: String,
    /// Whether the panel may edit this value in place.
    pub editable: bool,
}

fn is_plain_scalar(v: &Value) -> bool {
    match v {
        Value::Null | Value::Bool(_) | Value::Number(_) => true,
        Value::String(s) => !s.contains('\n'),
        _ => false,
    }
}

fn value_text_has_markers(text: &str) -> bool {
    let t = text.trim_start();
    t.starts_with('&') || t.starts_with('*') || t.starts_with('!') || t.starts_with('|') || t.starts_with('>')
}

fn classify_editable(value: &Value, raw: &str) -> bool {
    let mut lines = raw.lines();
    let first = lines.next().unwrap_or("");
    let value_at = parse_key(first).map(|(_, i)| i).unwrap_or(first.len());
    let first_value = &first[value_at..];
    if value_text_has_markers(first_value) {
        return false;
    }
    match value {
        v if is_plain_scalar(v) => raw.lines().filter(|l| !l.trim().is_empty()).count() == 1,
        Value::Sequence(items) => {
            if !items.iter().all(is_plain_scalar) {
                return false;
            }
            let rest: Vec<&str> = lines.filter(|l| !l.trim().is_empty()).collect();
            if rest.is_empty() {
                return first_value.trim_start().starts_with('[');
            }
            first_value.trim().is_empty()
                && rest.iter().all(|l| {
                    let t = l.trim_start();
                    (t.starts_with("- ") || t == "-") && !value_text_has_markers(&t[1..])
                })
        }
        _ => false,
    }
}

fn parse_mapping(yaml: &str) -> Result<Mapping, ()> {
    if yaml.trim().is_empty() {
        return Ok(Mapping::new());
    }
    match serde_yaml::from_str::<Value>(yaml) {
        Ok(Value::Mapping(m)) => Ok(m),
        Ok(Value::Null) => Ok(Mapping::new()),
        _ => Err(()),
    }
}

/// Read a file's frontmatter for display.
pub fn parse(content: &str) -> Parsed {
    let Some(parts) = split(content) else {
        return Parsed::None;
    };
    let Ok(map) = parse_mapping(parts.yaml) else {
        return Parsed::Invalid(parts.head.to_string());
    };
    let spans = key_spans(parts.yaml);
    let aligned = spans.len() == map.len()
        && map
            .keys()
            .zip(spans.iter())
            .all(|(k, s)| k.as_str().map_or(false, |k| k == s.key));
    let entries = map
        .iter()
        .enumerate()
        .map(|(i, (k, v))| {
            let key = k.as_str().map(str::to_string).unwrap_or_else(|| format!("{:?}", k));
            let raw = if aligned {
                parts.yaml[spans[i].start..spans[i].end].to_string()
            } else {
                String::new()
            };
            let editable = aligned && classify_editable(v, &raw);
            let value = serde_json::to_value(v).unwrap_or(serde_json::Value::Null);
            Entry { key, value, raw, editable }
        })
        .collect();
    Parsed::Entries(entries)
}

/// A new value to write for a key.
#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "lowercase")]
pub enum NewValue {
    Scalar(String),
    List(Vec<String>),
}

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum FmError {
    #[error("frontmatter is not valid YAML")]
    Invalid,
    #[error("value cannot be edited in place")]
    NotEditable,
    #[error("key not found")]
    NotFound,
}

fn eol_of(text: &str) -> &'static str {
    if text.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Quote {
    Plain,
    Double,
    Single,
}

fn quote_of(value_text: &str) -> Quote {
    match value_text.trim_start().chars().next() {
        Some('"') => Quote::Double,
        Some('\'') => Quote::Single,
        _ => Quote::Plain,
    }
}

fn needs_quotes(s: &str, in_flow: bool) -> bool {
    if s.is_empty() || s != s.trim() {
        return true;
    }
    let first = s.chars().next().unwrap();
    if matches!(first, '-' | '?' | ':' | ',' | '[' | ']' | '{' | '}' | '#' | '&' | '*' | '!' | '|' | '>' | '\'' | '"' | '%' | '@' | '`') {
        // A leading '-' is fine when not followed by a space (e.g. "-5" would be a number, still ok).
        if !(first == '-' && s.len() > 1 && !s[1..].starts_with(' ')) {
            return true;
        }
    }
    if s.contains(": ") || s.contains(" #") || s.ends_with(':') || s.contains('\n') {
        return true;
    }
    if in_flow && s.contains([',', '[', ']', '{', '}']) {
        return true;
    }
    false
}

fn render_scalar(s: &str, preferred: Quote, in_flow: bool) -> String {
    let needs = needs_quotes(s, in_flow) || s.contains('\n');
    let style = match (preferred, needs) {
        (Quote::Plain, false) => Quote::Plain,
        (Quote::Single, false) if !s.contains('\n') => Quote::Single,
        (Quote::Single, true) if !s.contains('\n') && !s.contains('\\') => Quote::Single,
        _ => Quote::Double,
    };
    match style {
        Quote::Plain => s.to_string(),
        Quote::Single => format!("'{}'", s.replace('\'', "''")),
        Quote::Double => {
            let mut out = String::from("\"");
            for c in s.chars() {
                match c {
                    '"' => out.push_str("\\\""),
                    '\\' => out.push_str("\\\\"),
                    '\n' => out.push_str("\\n"),
                    '\t' => out.push_str("\\t"),
                    _ => out.push(c),
                }
            }
            out.push('"');
            out
        }
    }
}

/// Split trailing ` # comment` from a single-line value. Returns (value, comment)
/// where the comment keeps its leading whitespace.
fn split_comment(value_text: &str) -> (&str, &str) {
    let mut quote: Option<char> = None;
    let mut prev_ws = true;
    let chars: Vec<(usize, char)> = value_text.char_indices().collect();
    let mut idx = 0;
    while idx < chars.len() {
        let (i, c) = chars[idx];
        match quote {
            Some(q) => {
                if q == '"' && c == '\\' {
                    idx += 1;
                } else if c == q {
                    if q == '\'' && chars.get(idx + 1).map(|x| x.1) == Some('\'') {
                        idx += 1;
                    } else {
                        quote = None;
                    }
                }
            }
            None => {
                if (c == '"' || c == '\'') && prev_ws && i == 0 {
                    quote = Some(c);
                } else if c == '#' && prev_ws && i > 0 {
                    let value = value_text[..i].trim_end();
                    return (value, &value_text[value.len()..]);
                }
            }
        }
        prev_ws = c == ' ' || c == '\t';
        idx += 1;
    }
    (value_text.trim_end(), "")
}

fn render_entry(existing: Option<(&str, &str)>, key: &str, value: &NewValue) -> String {
    // `existing` = (original span text, eol) when replacing.
    let eol = existing.map(|(_, e)| e).unwrap_or("\n");
    let (key_prefix, old_value_text, old_comment, was_flow, indent): (String, String, String, bool, String) =
        if let Some((raw, _)) = existing {
            let first = raw.lines().next().unwrap_or("");
            let value_at = parse_key(first).map(|(_, i)| i).unwrap_or(first.len());
            let (v, c) = split_comment(&first[value_at..]);
            let indent = raw
                .lines()
                .skip(1)
                .find(|l| l.trim_start().starts_with('-'))
                .map(|l| l[..l.len() - l.trim_start().len()].to_string())
                .unwrap_or_else(|| "  ".to_string());
            (
                first[..value_at].to_string(),
                v.to_string(),
                c.to_string(),
                v.trim_start().starts_with('['),
                indent,
            )
        } else {
            (format!("{}: ", render_key(key)), String::new(), String::new(), true, "  ".to_string())
        };

    match value {
        NewValue::Scalar(s) => {
            let quote = quote_of(&old_value_text);
            format!("{}{}{}{}", key_prefix, render_scalar(s, quote, false), old_comment, eol)
        }
        NewValue::List(items) => {
            // Existing flow lists stay flow; block lists stay block; new keys use flow.
            let flow = if existing.is_some() { was_flow } else { true };
            if flow {
                let rendered: Vec<String> = items.iter().map(|i| render_scalar(i, Quote::Plain, true)).collect();
                let prefix = if key_prefix.ends_with(' ') || key_prefix.ends_with('\t') {
                    key_prefix.clone()
                } else {
                    format!("{} ", key_prefix)
                };
                format!("{}[{}]{}{}", prefix, rendered.join(", "), old_comment, eol)
            } else {
                let mut out = format!("{}{}{}", key_prefix.trim_end(), old_comment, eol);
                for item in items {
                    out.push_str(&format!("{}- {}{}", indent, render_scalar(item, Quote::Plain, false), eol));
                }
                out
            }
        }
    }
}

fn render_key(key: &str) -> String {
    if needs_quotes(key, true) || key.contains(':') {
        render_scalar(key, Quote::Double, false)
    } else {
        key.to_string()
    }
}

/// Create or update one key, leaving every other line byte-for-byte unchanged.
pub fn set_key(content: &str, key: &str, value: &NewValue) -> Result<String, FmError> {
    let Some(parts) = split(content) else {
        // No frontmatter: create a block holding only this key.
        let eol = eol_of(content);
        let entry = render_entry(None, key, value).replace('\n', eol);
        return Ok(format!("---{eol}{entry}---{eol}{content}"));
    };
    parse_mapping(parts.yaml).map_err(|_| FmError::Invalid)?;
    let eol = eol_of(parts.head);
    let yaml_off = parts.head.len() - parts.yaml.len() - closing_fence_len(parts.head);
    let spans = key_spans(parts.yaml);

    if let Some(span) = spans.iter().find(|s| s.key == key) {
        let raw = &parts.yaml[span.start..span.end];
        let entries = match parse(content) {
            Parsed::Entries(e) => e,
            _ => return Err(FmError::Invalid),
        };
        let entry = entries.iter().find(|e| e.key == key).ok_or(FmError::NotFound)?;
        if !entry.editable {
            return Err(FmError::NotEditable);
        }
        // Preserve the original line ending of the span's last line.
        let span_eol = if raw.ends_with("\r\n") {
            "\r\n"
        } else if raw.ends_with('\n') {
            "\n"
        } else {
            ""
        };
        let mut rendered = render_entry(Some((raw, if span_eol.is_empty() { eol } else { span_eol })), key, value);
        if span_eol.is_empty() {
            rendered = rendered.trim_end_matches(['\n', '\r']).to_string();
        }
        let abs_start = yaml_off + span.start;
        let abs_end = yaml_off + span.end;
        Ok(format!("{}{}{}", &content[..abs_start], rendered, &content[abs_end..]))
    } else {
        let entry = render_entry(None, key, value).replace('\n', eol);
        let insert_at = yaml_off + parts.yaml.len();
        let mut prefix = content[..insert_at].to_string();
        if !parts.yaml.is_empty() && !parts.yaml.ends_with('\n') {
            prefix.push_str(eol);
        }
        Ok(format!("{}{}{}", prefix, entry, &content[insert_at..]))
    }
}

fn closing_fence_len(head: &str) -> usize {
    // Length of the last line of `head` (the closing fence with its line ending).
    let trimmed = head.trim_end_matches(['\n', '\r']);
    head.len() - trimmed.rfind('\n').map(|i| i + 1).unwrap_or(0)
}

/// Replace the whole text between the fences. The new text must be valid YAML
/// (this is also how a broken block gets fixed); empty text removes the block.
pub fn replace_yaml(content: &str, new_yaml: &str) -> Result<String, FmError> {
    let parts = split(content).ok_or(FmError::NotFound)?;
    parse_mapping(new_yaml).map_err(|_| FmError::Invalid)?;
    if new_yaml.trim().is_empty() {
        return Ok(parts.body.to_string());
    }
    let eol = eol_of(parts.head);
    let open_len = parts.head.find('\n').map(|i| i + 1).unwrap_or(0);
    let close_len = closing_fence_len(parts.head);
    let mut text = new_yaml.to_string();
    if !text.ends_with('\n') {
        text.push_str(eol);
    }
    Ok(format!(
        "{}{}{}{}",
        &parts.head[..open_len],
        text,
        &parts.head[parts.head.len() - close_len..],
        parts.body
    ))
}

/// Remove one key's lines. Removing the last key removes the whole block
/// (unless comments remain in it).
pub fn remove_key(content: &str, key: &str) -> Result<String, FmError> {
    let parts = split(content).ok_or(FmError::NotFound)?;
    parse_mapping(parts.yaml).map_err(|_| FmError::Invalid)?;
    let spans = key_spans(parts.yaml);
    let span = spans.iter().find(|s| s.key == key).ok_or(FmError::NotFound)?;
    let yaml_off = parts.head.len() - parts.yaml.len() - closing_fence_len(parts.head);
    let mut new_yaml = String::new();
    new_yaml.push_str(&parts.yaml[..span.start]);
    new_yaml.push_str(&parts.yaml[span.end..]);
    if spans.len() == 1 && new_yaml.trim().is_empty() {
        return Ok(parts.body.to_string());
    }
    Ok(format!(
        "{}{}{}",
        &content[..yaml_off + span.start],
        "",
        &content[yaml_off + span.end..]
    ))
}

fn scalar_to_string(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

/// Whether a top-level key exists in the frontmatter.
pub fn has_key(content: &str, key: &str) -> bool {
    split(content).map_or(false, |p| key_spans(p.yaml).iter().any(|s| s.key == key))
}

/// First present scalar value among `keys`, as a string.
pub fn get_scalar_string(content: &str, keys: &[&str]) -> Option<String> {
    let parts = split(content)?;
    let map = parse_mapping(parts.yaml).ok()?;
    keys.iter()
        .find_map(|k| map.get(*k).and_then(scalar_to_string))
        .filter(|s| !s.is_empty())
}

/// Tags from frontmatter (`tags` or `tag`; list or comma/space separated string).
pub fn get_tags(content: &str) -> Vec<String> {
    let Some(parts) = split(content) else {
        return Vec::new();
    };
    let Ok(map) = parse_mapping(parts.yaml) else {
        return Vec::new();
    };
    let value = map.get("tags").or_else(|| map.get("tag"));
    match value {
        Some(Value::Sequence(items)) => items.iter().filter_map(scalar_to_string).collect(),
        Some(Value::String(s)) => s
            .split(|c: char| c == ',' || c.is_whitespace())
            .map(|t| t.trim().trim_start_matches('#').to_string())
            .filter(|t| !t.is_empty())
            .collect(),
        _ => Vec::new(),
    }
}

/// Write tags, touching only the tag key. Never creates frontmatter for an
/// empty tag list.
pub fn set_tags(content: &str, tags: &[String]) -> Result<String, FmError> {
    let existing_key = split(content).and_then(|p| {
        key_spans(p.yaml)
            .into_iter()
            .map(|s| s.key)
            .find(|k| k == "tags" || k == "tag")
    });
    match (existing_key, tags.is_empty()) {
        (None, true) => Ok(content.to_string()),
        (Some(k), true) => remove_key(content, &k),
        (k, false) => set_key(content, k.as_deref().unwrap_or("tags"), &NewValue::List(tags.to_vec())),
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum TitleSource {
    Heading,
    Filename,
}

fn first_h1(body: &str) -> Option<(usize, usize, String)> {
    use pulldown_cmark::{Event, HeadingLevel, Parser, Tag, TagEnd};
    let mut depth = 0usize;
    let mut heading = None;
    let mut text = String::new();
    for (event, range) in Parser::new(body).into_offset_iter() {
        match event {
            Event::Start(Tag::Heading { level: HeadingLevel::H1, .. }) if depth == 0 => {
                heading = Some(range);
                text.clear();
                depth += 1;
            }
            Event::Start(_) => depth += 1,
            Event::End(tag) => {
                depth = depth.saturating_sub(1);
                if tag == TagEnd::Heading(HeadingLevel::H1) && depth == 0 {
                    if let Some(range) = heading.take() {
                        let title = text.trim();
                        if !title.is_empty() {
                            let raw = body[range.clone()].trim_end_matches(['\n', '\r']);
                            return Some((range.start, range.start + raw.len(), title.to_string()));
                        }
                    }
                }
            }
            Event::Text(value) | Event::Code(value) if heading.is_some() => text.push_str(&value),
            Event::SoftBreak | Event::HardBreak if heading.is_some() => text.push(' '),
            _ => {}
        }
    }
    None
}

pub fn title_source(content: &str) -> TitleSource {
    if first_h1(body_of(content)).is_some() {
        TitleSource::Heading
    } else {
        TitleSource::Filename
    }
}

/// Displayed title: first H1, else the file name.
pub fn derive_title(content: &str, filename_stem: &str) -> String {
    first_h1(body_of(content)).map(|(_, _, t)| t)
        .unwrap_or_else(|| filename_stem.to_string())
}

/// A `# ` line that reads back as exactly `title`. The title field is plain
/// text, so markdown is escaped, but only where it would change what is read.
fn heading_line(title: &str) -> String {
    let title = title.replace(['\r', '\n'], " ");
    let title = title.trim();
    let plain = format!("# {title}");
    if first_h1(&plain).map_or(false, |(_, _, read)| read == title) {
        return plain;
    }
    let mut line = String::from("# ");
    for c in title.chars() {
        if r"\`*_[]<>&!~#".contains(c) {
            line.push('\\');
        }
        line.push(c);
    }
    line
}

/// Set the title: replace the first H1, or add one at the top of the body.
/// The title field is a view of that heading, so nothing else changes.
pub fn set_title(content: &str, new_title: &str) -> String {
    let body = body_of(content);
    let body_off = content.len() - body.len();
    let line = heading_line(new_title);
    if let Some((start, end, _)) = first_h1(body) {
        return format!("{}{}{}", &content[..body_off + start], line, &content[body_off + end..]);
    }

    let eol = if content.contains("\r\n") { "\r\n" } else { "\n" };
    // After the frontmatter, a byte order mark and any leading blank lines.
    let mut at = body_off;
    if at == 0 && content.starts_with('\u{feff}') {
        at = '\u{feff}'.len_utf8();
    }
    for part in content[at..].split_inclusive('\n') {
        if !part.trim().is_empty() {
            break;
        }
        at += part.len();
    }
    let (before, after) = content.split_at(at);
    // A closing fence, or blank spaces, at the end of a file with no newline.
    let break_before = if before.is_empty() || before == "\u{feff}" || before.ends_with('\n') { "" } else { eol };
    let gap = if after.is_empty() { "" } else { eol };
    format!("{before}{break_before}{line}{eol}{gap}{after}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_frontmatter() {
        let c = "---\ntitle: A\n---\n\nbody\n";
        let p = split(c).unwrap();
        assert_eq!(p.yaml, "title: A\n");
        assert_eq!(p.body, "\nbody\n");
        assert_eq!(p.head, "---\ntitle: A\n---\n");
    }

    #[test]
    fn no_frontmatter() {
        assert!(split("# hi\n---\nx").is_none());
        assert!(split("---\nnever closed\n").is_none());
        assert_eq!(parse("plain"), Parsed::None);
    }

    #[test]
    fn dots_terminator_and_empty_block() {
        assert!(split("---\na: 1\n...\nbody").is_some());
        let p = split("---\n---\nbody").unwrap();
        assert_eq!(p.yaml, "");
    }

    #[test]
    fn add_a_tag_keeps_other_lines() {
        let c = "---\n# draft\ntitle: \"Plan\"\nauthor: me\ntags: [a]\n---\nbody\n";
        let out = set_tags(c, &["a".into(), "b".into()]).unwrap();
        assert_eq!(out, "---\n# draft\ntitle: \"Plan\"\nauthor: me\ntags: [a, b]\n---\nbody\n");
    }

    #[test]
    fn block_list_stays_block() {
        let c = "---\ntags:\n  - a\n  - b\nother: 1\n---\n";
        let out = set_tags(c, &["a".into(), "c".into()]).unwrap();
        assert_eq!(out, "---\ntags:\n  - a\n  - c\nother: 1\n---\n");
    }

    #[test]
    fn column_zero_block_list() {
        let c = "---\ntags:\n- a\n- b\nz: 1\n---\n";
        let out = set_tags(c, &["x".into()]).unwrap();
        assert_eq!(out, "---\ntags:\n- x\nz: 1\n---\n");
    }

    #[test]
    fn new_tags_key_appended_flow() {
        let c = "---\ntitle: T\n---\nbody";
        let out = set_tags(c, &["a".into(), "b c".into()]).unwrap();
        assert_eq!(out, "---\ntitle: T\ntags: [a, b c]\n---\nbody");
    }

    #[test]
    fn empty_tags_never_create_frontmatter() {
        assert_eq!(set_tags("body", &[]).unwrap(), "body");
        let c = "---\ntitle: T\n---\n";
        assert_eq!(set_tags(c, &[]).unwrap(), c);
    }

    #[test]
    fn tags_created_when_no_frontmatter_leave_body() {
        let out = set_tags("# hi\n", &["a".into()]).unwrap();
        assert_eq!(out, "---\ntags: [a]\n---\n# hi\n");
    }

    #[test]
    fn removing_all_tags_removes_key_only() {
        let c = "---\ntitle: T\ntags: [a]\nx: 1\n---\n";
        assert_eq!(set_tags(c, &[]).unwrap(), "---\ntitle: T\nx: 1\n---\n");
    }

    #[test]
    fn set_scalar_preserves_quote_style_and_comment() {
        let c = "---\nstatus:   'draft' # wip\nz: 1\n---\n";
        let out = set_key(c, "status", &NewValue::Scalar("done".into())).unwrap();
        assert_eq!(out, "---\nstatus:   'done' # wip\nz: 1\n---\n");
        let c2 = "---\nstatus: draft\n---\n";
        assert_eq!(
            set_key(c2, "status", &NewValue::Scalar("a: b".into())).unwrap(),
            "---\nstatus: \"a: b\"\n---\n"
        );
    }

    #[test]
    fn crlf_is_preserved() {
        let c = "---\r\ntitle: A\r\nz: 1\r\n---\r\nbody\r\n";
        let out = set_key(c, "title", &NewValue::Scalar("B".into())).unwrap();
        assert_eq!(out, "---\r\ntitle: B\r\nz: 1\r\n---\r\nbody\r\n");
        let out = set_key(c, "new", &NewValue::Scalar("1".into())).unwrap();
        assert_eq!(out, "---\r\ntitle: A\r\nz: 1\r\nnew: 1\r\n---\r\nbody\r\n");
    }

    #[test]
    fn invalid_yaml_is_never_modified() {
        let c = "---\ntitle: \"unclosed\n---\nbody\n";
        assert!(matches!(parse(c), Parsed::Invalid(_)));
        assert_eq!(set_key(c, "title", &NewValue::Scalar("x".into())), Err(FmError::Invalid));
        assert_eq!(set_tags(c, &["a".into()]), Err(FmError::Invalid));
        assert!(get_tags(c).is_empty());
    }

    #[test]
    fn complex_values_are_read_only() {
        let c = "---\nauthor: {name: A, url: B}\nnote: |\n  multi\n  line\nbase: &b x\ntitle: T\n---\n";
        let Parsed::Entries(e) = parse(c) else { panic!() };
        let by = |k: &str| e.iter().find(|x| x.key == k).unwrap();
        assert!(!by("author").editable);
        assert!(!by("note").editable);
        assert!(!by("base").editable);
        assert!(by("title").editable);
        assert_eq!(set_key(c, "author", &NewValue::Scalar("x".into())), Err(FmError::NotEditable));
    }

    #[test]
    fn entries_keep_original_order() {
        let c = "---\nz: 1\na: 2\nm: [x, y]\n---\n";
        let Parsed::Entries(e) = parse(c) else { panic!() };
        let keys: Vec<_> = e.iter().map(|x| x.key.as_str()).collect();
        assert_eq!(keys, ["z", "a", "m"]);
        assert!(e[2].editable);
    }

    #[test]
    fn remove_key_and_last_key() {
        let c = "---\na: 1\nb: 2\n---\nbody\n";
        assert_eq!(remove_key(c, "a").unwrap(), "---\nb: 2\n---\nbody\n");
        assert_eq!(remove_key("---\na: 1\n---\nbody\n", "a").unwrap(), "body\n");
        assert_eq!(remove_key(c, "nope"), Err(FmError::NotFound));
    }

    #[test]
    fn removing_last_key_keeps_block_with_comments() {
        let c = "---\n# keep me\na: 1\n---\nbody\n";
        assert_eq!(remove_key(c, "a").unwrap(), "---\n# keep me\n---\nbody\n");
    }

    #[test]
    fn add_property_to_file_without_frontmatter() {
        let out = set_key("body\n", "status", &NewValue::Scalar("draft".into())).unwrap();
        assert_eq!(out, "---\nstatus: draft\n---\nbody\n");
    }

    #[test]
    fn tags_as_string_and_alias() {
        assert_eq!(get_tags("---\ntags: a, b\n---\n"), ["a", "b"]);
        assert_eq!(get_tags("---\ntag: [x]\n---\n"), ["x"]);
        assert_eq!(get_tags("---\ntags: [1, two]\n---\n"), ["1", "two"]);
    }

    #[test]
    fn title_fallbacks() {
        assert_eq!(derive_title("---\ntitle: Key\n---\n# H\n", "file"), "H");
        assert_eq!(derive_title("# Getting set up\n\ntext", "setup"), "Getting set up");
        assert_eq!(derive_title("text only", "setup"), "setup");
        assert_eq!(derive_title("---\ntitle: Metadata\n---\ntext", "setup"), "setup");
        assert_eq!(derive_title("A *formatted* `title`\n=====\n\nbody", "setup"), "A formatted title");
        assert_eq!(derive_title("> # Quote\n\n    # Code\n\n   # Real title\n", "file"), "Real title");
        assert_eq!(derive_title("```\n# not a title\n```\n", "f"), "f");
        assert_eq!(derive_title("---\ntitle: \"\"\n---\n# H\n", "f"), "H");
    }

    #[test]
    fn title_edit_by_source() {
        let c = "---\ntitle: Old\nx: 1\n---\n# Heading\n";
        assert_eq!(set_title(c, "New"), "---\ntitle: Old\nx: 1\n---\n# New\n");
        let h = "intro\n\n# Old head\n\nbody\n";
        assert_eq!(set_title(h, "New"), "intro\n\n# New\n\nbody\n");
        assert_eq!(set_title("Title\n=====\r\n\r\nbody\r\n", "New"), "# New\r\n\r\nbody\r\n");
        assert_eq!(title_source("no heading"), TitleSource::Filename);
    }

    #[test]
    fn title_without_a_heading_adds_one_at_the_top_of_the_body() {
        let t = |c: &str| set_title(c, "T");
        assert_eq!(t(""), "# T\n");
        assert_eq!(t("body\n"), "# T\n\nbody\n");
        assert_eq!(t("body"), "# T\n\nbody");
        assert_eq!(t("---\ntitle: Meta\n---\nbody\n"), "---\ntitle: Meta\n---\n# T\n\nbody\n");
        assert_eq!(t("---\nx: 1\n---\n\nbody\n"), "---\nx: 1\n---\n\n# T\n\nbody\n");
        assert_eq!(t("---\nx: 1\n---"), "---\nx: 1\n---\n# T\n");
        assert_eq!(t("body\r\n"), "# T\r\n\r\nbody\r\n");
        assert_eq!(t("\u{feff}body\n"), "\u{feff}# T\n\nbody\n");
        assert_eq!(t("## Sub\n"), "# T\n\n## Sub\n");
        for c in ["", "body", "---\nx: 1\n---\n\nbody\n", "    code\n"] {
            assert_eq!(derive_title(&t(c), "file"), "T", "{c:?}");
            assert_eq!(t(&t(c)), t(c), "repeating changes nothing: {c:?}");
        }
    }

    #[test]
    fn titles_read_back_as_typed() {
        for title in [
            "Plain", "C#", "Issue #", "#", "2*3*4", "*stars*", "a <b> tag", "Tom &amp; Jerry",
            "[link](x.md)", "`tick", "back\\slash", "__init__", "1. First", "- dash", "Σημειώσεις", "![img](x)",
        ] {
            let out = set_title("body\n", title);
            assert_eq!(derive_title(&out, "file"), title, "{out:?}");
        }
        assert_eq!(set_title("", "C# and my_var"), "# C# and my_var\n");
    }

    #[test]
    fn replace_yaml_swaps_only_the_block_interior() {
        let c = "---\na: 1\n---\nbody\n";
        assert_eq!(replace_yaml(c, "a: 2\nb: x").unwrap(), "---\na: 2\nb: x\n---\nbody\n");
        assert_eq!(replace_yaml(c, "  \n").unwrap(), "body\n");
        assert_eq!(replace_yaml(c, "a: [unclosed"), Err(FmError::Invalid));
        // Fixing a broken block works.
        let bad = "---\ntitle: \"x\n---\nbody\n";
        assert_eq!(replace_yaml(bad, "title: x").unwrap(), "---\ntitle: x\n---\nbody\n");
        assert_eq!(properties(bad).status, "invalid");
        assert_eq!(properties(bad).yaml, "title: \"x\n");
    }

    #[test]
    fn untouched_bytes_stay_identical() {
        let c = "---\n# c1\nzeta:    1\n\nalpha: \"q\"   # note\ntags: [a]\n# trailing comment\n---\nbody\n";
        let out = set_tags(c, &["a".into(), "b".into()]).unwrap();
        assert_eq!(
            out,
            "---\n# c1\nzeta:    1\n\nalpha: \"q\"   # note\ntags: [a, b]\n# trailing comment\n---\nbody\n"
        );
    }
}
