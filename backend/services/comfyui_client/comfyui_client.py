"""ComfyUI client that executes workflows via ComfyKit.

This module bridges the LTX-Desktop backend to an external ComfyUI instance.
Workflows live in ``app/workflows/`` and use ComfyKit DSL markers for
dynamic parameter injection.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

import httpx
from comfykit import ComfyKit

logger = logging.getLogger(__name__)

# Default ComfyUI URL — override via COMFYUI_URL env var
DEFAULT_COMFYUI_URL = "http://127.0.0.1:8188"

# Resolve the workflows directory relative to this file
# services/comfyui_client/comfyui_client.py -> backend -> app -> workflows
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_WORKFLOWS_DIR = _BACKEND_DIR.parent / "workflows"


def _get_comfyui_url() -> str:
    return os.environ.get("COMFYUI_URL", DEFAULT_COMFYUI_URL)


class ComfyUIClient:
    """Thin wrapper around ComfyKit for executing ComfyUI workflows."""

    def __init__(self, comfyui_url: str | None = None) -> None:
        self._url = comfyui_url or _get_comfyui_url()
        self._kit = ComfyKit(comfyui_url=self._url)
        self._workflows_dir = _WORKFLOWS_DIR
        logger.info("ComfyUIClient initialized — server: %s, workflows: %s", self._url, self._workflows_dir)

    @property
    def comfyui_url(self) -> str:
        return self._url

    def is_available(self) -> bool:
        """Check if the ComfyUI server is reachable."""
        try:
            with httpx.Client(timeout=5) as client:
                resp = client.get(f"{self._url}/system_stats")
                return resp.status_code == 200
        except Exception:
            return False

    def get_available_models(self) -> dict[str, list[str]]:
        """Scan ComfyUI model directories for available model files.

        Returns a dict with keys: checkpoints, loras, vae, text_encoders,
        diffusion_models, latent_upscale_models, upscale_models.
        """
        comfyui_models_dir = _BACKEND_DIR.parent / "comfyui" / "models"

        if not comfyui_models_dir.exists():
            logger.warning("ComfyUI models directory not found: %s", comfyui_models_dir)
            return {}

        CATEGORY_DIRS: dict[str, list[str]] = {
            "checkpoints": ["checkpoints"],
            "diffusion_models": ["diffusion_models"],
            "loras": ["loras"],
            "vae": ["vae"],
            "text_encoders": ["text_encoders", "clip"],
            "latent_upscale_models": ["latent_upscale_models"],
            "upscale_models": ["upscale_models"],
        }

        MODEL_EXTENSIONS = {".safetensors", ".ckpt", ".pt", ".pth", ".bin", ".gguf"}

        result: dict[str, list[str]] = {}

        for category, dir_names in CATEGORY_DIRS.items():
            models: list[str] = []
            for dir_name in dir_names:
                scan_dir = comfyui_models_dir / dir_name
                if not scan_dir.exists():
                    continue
                for f in scan_dir.rglob("*"):
                    if f.is_file() and f.suffix.lower() in MODEL_EXTENSIONS:
                        rel = str(f.relative_to(scan_dir))
                        models.append(rel)
            result[category] = sorted(set(models))
            if models:
                logger.info("Found %d models in %s", len(models), "/".join(dir_names))

        return result

    async def execute_workflow(
        self,
        workflow_name: str,
        params: dict[str, Any],
    ) -> "WorkflowResult":
        """Execute a named workflow with the given parameters."""
        workflow_path = self._workflows_dir / workflow_name
        if not workflow_path.exists():
            raise FileNotFoundError(f"Workflow not found: {workflow_path}")

        logger.info("Executing workflow %s with params: %s", workflow_name,
                     {k: v for k, v in params.items() if k != "image"})

        result = await self._kit.execute(str(workflow_path), params)

        return WorkflowResult(
            status=result.status,
            videos=list(result.videos),
            images=list(result.images),
            videos_by_var=dict(result.videos_by_var),
            images_by_var=dict(result.images_by_var),
            duration=result.duration,
            error=result.msg,
            prompt_id=result.prompt_id,
        )

    def execute_workflow_sync(
        self,
        workflow_name: str,
        params: dict[str, Any],
    ) -> "WorkflowResult":
        """Synchronous wrapper for execute_workflow."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, self.execute_workflow(workflow_name, params))
                return future.result()
        else:
            return asyncio.run(self.execute_workflow(workflow_name, params))

    def download_video(self, video_url: str, output_path: Path) -> Path:
        """Download a video from ComfyUI's output to a local path."""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with httpx.Client(timeout=120) as client:
            with client.stream("GET", video_url) as resp:
                resp.raise_for_status()
                with open(output_path, "wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=8192):
                        f.write(chunk)

        logger.info("Downloaded video to %s (%.1f MB)", output_path, output_path.stat().st_size / 1024 / 1024)
        return output_path


class WorkflowResult:
    """Structured result from a ComfyKit workflow execution."""

    __slots__ = ("status", "videos", "images", "videos_by_var", "images_by_var", "duration", "error", "prompt_id")

    def __init__(
        self,
        status: str,
        videos: list[str],
        images: list[str],
        videos_by_var: dict[str, list[str]],
        images_by_var: dict[str, list[str]],
        duration: float | None,
        error: str | None,
        prompt_id: str | None,
    ) -> None:
        self.status = status
        self.videos = videos
        self.images = images
        self.videos_by_var = videos_by_var
        self.images_by_var = images_by_var
        self.duration = duration
        self.error = error
        self.prompt_id = prompt_id

    @property
    def is_success(self) -> bool:
        return self.status == "completed"

    @property
    def video_url(self) -> str | None:
        """Get the primary video output URL."""
        by_var = self.videos_by_var.get("video", [])
        if by_var:
            return by_var[0]
        return self.videos[0] if self.videos else None
