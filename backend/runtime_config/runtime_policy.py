"""Runtime policy decisions for forced API mode."""

from __future__ import annotations


def decide_force_api_generations(system: str, cuda_available: bool, vram_gb: int | None) -> bool:
    """Return whether API-only generation must be forced for this runtime.

    Always returns False — local generation is handled by an external ComfyUI
    instance via ComfyKit, so there is no local VRAM requirement.
    """
    return False
