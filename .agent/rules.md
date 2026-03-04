# ShotKit Development Rules

## Platform Context
- **Primary development environment:** Linux
- **Target platforms:** Linux, macOS, Windows (all three major OSes)
- When implementing features, always consider cross-platform implications. If a feature doesn't work on Linux, check whether it works on macOS/Windows and document the gap.

## Linux Limitations Tracking
- Whenever a platform-specific limitation, workaround, or TODO arises — especially on Linux — **proactively document it** in `docs/LINUX_TODO.md`.
- Include: current status, workaround applied, root cause, and the proper long-term solution.
- This applies to both new features and bugs discovered during development.

## Platform-Specific Code
- Use `cfg!(target_os = "...")` guards for platform-specific behavior
- Always log a warning when a feature is skipped due to platform limitations
- Prefer runtime detection (e.g. frame format from first frame) over compile-time assumptions when the underlying library may behave differently per platform

## Testing & Verification
- **Never use browser tools** (`browser_subagent`, `read_browser_page`, etc.) for UI testing or verification. The user will perform all manual testing themselves in the actual app environment.

