# LTX Desktop — Local ComfyUI Edition

A fork of [LTX Desktop](https://github.com/Lightricks/LTX-Desktop) that replaces the cloud API and heavy local pipeline requirements with an in-built [ComfyUI](https://github.com/comfyanonymous/ComfyUI) backend, bridged via [ComfyKit](https://github.com/puke3615/ComfyKit). Packaged for one-click install via [Pinokio](https://pinokio.computer).

## What's Different

The original LTX Desktop requires either 32GB+ VRAM for local generation or cloud API keys. This fork removes both requirements by routing all inference through a bundled ComfyUI instance. This means:

- **No VRAM gate** — works with any GPU that can run ComfyUI
- **No API keys needed** — fully local, fully offline-capable
- **Shared model storage** — ComfyUI model folders are linked to Pinokio's shared drive, so models are shared across all your Pinokio apps
- **ComfyUI workflow flexibility** — swap workflows, add LoRAs, use GGUF quantized models, all through the familiar ComfyUI ecosystem
- **Self-contained** — everything (settings, logs, outputs) stays inside the install directory

## Status: Work in Progress

This is an active development fork. The core plumbing is in place but we're still building out workflows and UI features.

## Changelog

**Phase 1 — Foundation (current)**
- Pinokio launcher scripts: install, start, update, reset with ComfyUI lifecycle management
- In-built ComfyUI with ComfyUI-Manager and VideoHelperSuite custom nodes
- ComfyKit bridge: Python backend routes generation requests to ComfyUI via workflow execution
- Model selection UI: Settings → Models tab with dropdowns populated from ComfyUI model directories
- Model slots: checkpoint, text encoder, video VAE, audio VAE, distilled LoRA, latent upscale model
- Bypassed: VRAM check, API key requirements, first-run setup, model download gates
- Self-contained data directory (settings, logs, outputs all local to install dir)
- Shared Python venv between ComfyUI and the FastAPI backend
- Improved Electron logging (stderr no longer blanket-tagged as errors)

**Coming next**
- Production ComfyUI workflows for T2V, I2V, A2V with full parameter mapping
- LoRA selection and model preset system (quick-switch between model configurations)
- GGUF workflow support for quantized models
- Progress tracking from ComfyUI back to the frontend
- Image generation, Retake, and IC-LoRA tabs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend API | Python FastAPI |
| Inference engine | ComfyUI (in-built, headless) |
| ComfyUI bridge | [ComfyKit](https://github.com/puke3615/ComfyKit) Python SDK |
| Package manager | [Pinokio](https://pinokio.computer) |
| GPU libraries | PyTorch + SageAttention + Triton (via torch.js) |

## Installation

Install via Pinokio — click Install, then Start. ComfyUI, Python dependencies, and model folder links are set up automatically.

Models go in the standard ComfyUI model directories (linked to Pinokio's shared drive). If you have other Pinokio apps using ComfyUI, models are shared automatically.

## Credits

- [LTX Desktop](https://github.com/Lightricks/LTX-Desktop) by Lightricks — the original Electron app
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) by comfyanonymous — inference backend
- [ComfyKit](https://github.com/puke3615/ComfyKit) by Fan Wu — Python SDK for ComfyUI
- [Pinokio](https://pinokio.computer) by cocktailpeanut — app distribution platform

---

<details>
<summary><strong>Original LTX Desktop README</strong></summary>

# LTX Desktop

LTX Desktop is an open-source desktop app for generating videos with LTX models — locally on supported Windows/Linux NVIDIA GPUs, with an API mode for unsupported hardware and macOS.

> **Status: Beta.** Expect breaking changes.
> Frontend architecture is under active refactor; large UI PRs may be declined for now (see [`CONTRIBUTING.md`](docs/CONTRIBUTING.md)).

## Features

- Text-to-video generation
- Image-to-video generation
- Audio-to-video generation
- Video edit generation (Retake)
- Video Editor Interface
- Video Editing Projects

## Local vs API mode

| Platform / hardware | Generation mode | Notes |
| --- | --- | --- |
| Windows + CUDA GPU with **≥32GB VRAM** | Local generation | Downloads model weights locally |
| Windows (no CUDA, <32GB VRAM, or unknown VRAM) | API-only | **LTX API key required** |
| Linux + CUDA GPU with **≥32GB VRAM** | Local generation | Downloads model weights locally |
| Linux (no CUDA, <32GB VRAM, or unknown VRAM) | API-only | **LTX API key required** |
| macOS (Apple Silicon builds) | API-only | **LTX API key required** |

## System requirements

### Windows (local generation)

- Windows 10/11 (x64)
- NVIDIA GPU with CUDA support and **≥32GB VRAM**
- 16GB+ RAM (32GB recommended)
- **160GB+ free disk space**

### Linux (local generation)

- Ubuntu 22.04+ or similar distro (x64 or arm64)
- NVIDIA GPU with CUDA support and **≥32GB VRAM**
- NVIDIA driver installed
- 16GB+ RAM (32GB recommended)

### macOS (API-only)

- Apple Silicon (arm64)
- macOS 13+ (Ventura)

## Architecture

- **Renderer (`frontend/`)**: TypeScript + React UI
- **Electron (`electron/`)**: Main process + preload
- **Backend (`backend/`)**: Python + FastAPI local server

## Development

```bash
pnpm setup:dev   # One-time setup
pnpm dev          # Run in dev mode
pnpm typecheck    # Type checking
pnpm backend:test # Backend tests
```

## License

Apache-2.0 — see [`LICENSE.txt`](LICENSE.txt).

</details>
