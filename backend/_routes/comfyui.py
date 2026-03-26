"""Route handlers for ComfyUI integration endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from state import get_state_service
from app_handler import AppHandler
from services.comfyui_client import ComfyUIClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/comfyui", tags=["comfyui"])


class ComfyUIStatusResponse(BaseModel):
    available: bool
    url: str


class ComfyUIModelsResponse(BaseModel):
    """Available models from ComfyUI, grouped by directory/type."""
    available: bool
    checkpoints: list[str] = []
    loras: list[str] = []
    upscale_models: list[str] = []
    text_encoders: list[str] = []
    vae: list[str] = []
    diffusion_models: list[str] = []
    latent_upscale_models: list[str] = []


@router.get("/status", response_model=ComfyUIStatusResponse)
def route_comfyui_status(handler: AppHandler = Depends(get_state_service)) -> ComfyUIStatusResponse:
    """GET /api/comfyui/status — check if ComfyUI is reachable."""
    url = handler.state.app_settings.comfyui_url or "http://127.0.0.1:8188"
    client = ComfyUIClient(comfyui_url=url)
    return ComfyUIStatusResponse(available=client.is_available(), url=url)


@router.get("/models", response_model=ComfyUIModelsResponse)
def route_comfyui_models(handler: AppHandler = Depends(get_state_service)) -> ComfyUIModelsResponse:
    """GET /api/comfyui/models — list available models from ComfyUI model directories."""
    url = handler.state.app_settings.comfyui_url or "http://127.0.0.1:8188"
    client = ComfyUIClient(comfyui_url=url)

    models = client.get_available_models()
    return ComfyUIModelsResponse(
        available=True,
        checkpoints=models.get("checkpoints", []),
        loras=models.get("loras", []),
        upscale_models=models.get("upscale_models", []),
        text_encoders=models.get("text_encoders", []),
        vae=models.get("vae", []),
        diffusion_models=models.get("diffusion_models", []),
        latent_upscale_models=models.get("latent_upscale_models", []),
    )
