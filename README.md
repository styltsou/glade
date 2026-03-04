# ShotKit

A cross-platform screen recording app built with [Tauri v2](https://tauri.app/), [React](https://react.dev/), and [Rust](https://www.rust-lang.org/).

> **Status**: MVP — works on Linux (PipeWire), macOS, and Windows.

## Features

- 🎥 Screen & window recording (via [scap](https://crates.io/crates/scap))
- 🎙️ **Microphone capture** — choose device or disable (via [cpal](https://crates.io/crates/cpal))
- 🔊 **System audio capture** — record loopback audio (PulseAudio/PipeWire monitor on Linux, WASAPI loopback on Windows, BlackHole on macOS)
- 🎛️ **Mix mic + system audio** — captured independently, mixed with FFmpeg `amix` at export
- 🖱️ Click highlight compositing (circle overlay on each click)
- ⌨️ Keystroke compositing (text bar at bottom of frame)
- 🔍 Zoom effect (magnify around cursor)
- ✂️ **Region Selection** (drag to record specific area)
- 🎞️ **GIF Export** (high-quality palette-based optimization)
- 🚀 **Hardware Encoding** (NVENC/VideoToolbox auto-detection)
- ⚡ Configurable FPS, quality (CRF), and effect settings

## Quick Start

```bash
# Prerequisites: Rust, Node.js (or Bun), FFmpeg installed

# Install frontend dependencies
bun install      # or: npm install

# Run in dev mode (launches Tauri window + Vite HMR)
bun tauri dev    # or: npm run tauri dev

# Build for production
bun tauri build  # or: npm run tauri build

# Run Rust tests
cd src-tauri && cargo test
```

## Documentation

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Architecture, module guide, and how-to for new contributors
- **[docs/mvp_prd.md](./docs/mvp_prd.md)** — Original product requirements
- **[docs/LINUX_TODO.md](./docs/LINUX_TODO.md)** — Linux-specific notes and known issues
- **[docs/CHANGELOG.md](./docs/CHANGELOG.md)** — Version history and feature log

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri v2 |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + Shadcn/ui |
| State | Zustand |
| Backend | Rust (2021 edition) |
| Capture | scap (PipeWire / macOS / Windows) |
| Audio | cpal + hound (WAV) |
| Encoding | FFmpeg (spawned process) |
| Input | rdev (global keyboard/mouse listener) |

## License

MIT
