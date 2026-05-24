"""Recurring task tracker integration."""

from __future__ import annotations

from pathlib import Path

import voluptuous as vol

try:
    from homeassistant.components.http import StaticPathConfig
except ImportError:
    StaticPathConfig = None
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
import homeassistant.helpers.config_validation as cv

from .const import (
    DATA_ENTITIES,
    DATA_ENTITIES_BY_ENTRY_ID,
    DOMAIN,
    SERVICE_MARK_COMPLETE,
)

PLATFORMS: list[str] = ["sensor"]

SERVICE_SCHEMA = vol.Schema({vol.Required(ATTR_ENTITY_ID): cv.entity_id})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the integration domain."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    domain_data.setdefault(DATA_ENTITIES, {})
    domain_data.setdefault(DATA_ENTITIES_BY_ENTRY_ID, {})

    await _async_register_static_path(hass)

    async def async_handle_mark_complete(call: ServiceCall) -> None:
        entity_id = call.data[ATTR_ENTITY_ID]
        entity = hass.data[DOMAIN][DATA_ENTITIES].get(entity_id)

        if entity is None:
            raise HomeAssistantError(f"{entity_id} is not a recurrence tracker task")

        await entity.async_mark_complete()

    hass.services.async_register(
        DOMAIN,
        SERVICE_MARK_COMPLETE,
        async_handle_mark_complete,
        schema=SERVICE_SCHEMA,
    )

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up a task config entry."""
    if hasattr(hass.config_entries, "async_forward_entry_setups"):
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        return True

    await hass.config_entries.async_forward_entry_setup(entry, "sensor")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a task config entry."""
    if hasattr(hass.config_entries, "async_unload_platforms"):
        return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    return await hass.config_entries.async_forward_entry_unload(entry, "sensor")


async def _async_register_static_path(hass: HomeAssistant) -> None:
    """Expose the bundled Lovelace card JavaScript."""
    path = Path(__file__).parent / "www"
    url_path = f"/{DOMAIN}"

    if (
        StaticPathConfig is not None
        and hasattr(hass.http, "async_register_static_paths")
    ):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(url_path, str(path), cache_headers=True)]
        )
        return

    hass.http.register_static_path(url_path, str(path), cache_headers=True)
