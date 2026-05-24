"""Sensor platform for recurring tasks."""

from __future__ import annotations

from datetime import date

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_FREQUENCY_DAYS,
    ATTR_LAST_COMPLETED,
    ATTR_TASK_NAME,
    CONF_FREQUENCY_DAYS,
    CONF_ICON,
    CONF_LAST_COMPLETED,
    CONF_TASK_NAME,
    DATA_ENTITIES,
    DOMAIN,
    STORAGE_VERSION,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up a task sensor from a config entry."""
    async_add_entities([RecurrenceTaskSensor(hass, entry)], True)


class RecurrenceTaskSensor(SensorEntity, RestoreEntity):
    """Represent a recurring task."""

    _attr_has_entity_name = False

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the task sensor."""
        self._hass = hass
        self._entry = entry
        self._task_name = entry.data[CONF_TASK_NAME]
        self._frequency_days = entry.data[CONF_FREQUENCY_DAYS]
        self._last_completed: date | None = None
        self._store = Store(
            hass,
            STORAGE_VERSION,
            f"{DOMAIN}.{entry.entry_id}.json",
        )

        self._attr_name = self._task_name
        self._attr_icon = entry.data[CONF_ICON]
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}"

    @property
    def native_value(self) -> int | None:
        """Return days since the task was last completed."""
        if self._last_completed is None:
            return None

        return (dt_util.now().date() - self._last_completed).days

    @property
    def extra_state_attributes(self) -> dict[str, str | int | None]:
        """Return task metadata."""
        return {
            ATTR_TASK_NAME: self._task_name,
            ATTR_FREQUENCY_DAYS: self._frequency_days,
            ATTR_LAST_COMPLETED: self._last_completed.isoformat()
            if self._last_completed
            else None,
        }

    async def async_added_to_hass(self) -> None:
        """Restore the stored completion date."""
        configured_last_completed = self._entry.options.get(CONF_LAST_COMPLETED)

        if CONF_LAST_COMPLETED in self._entry.options:
            self._last_completed = (
                self._parse_date(configured_last_completed)
                if configured_last_completed
                else None
            )
        else:
            data = await self._store.async_load()
            if data and data.get(ATTR_LAST_COMPLETED):
                self._last_completed = self._parse_date(data[ATTR_LAST_COMPLETED])
            else:
                last_state = await self.async_get_last_state()
                last_completed = (
                    last_state.attributes.get(ATTR_LAST_COMPLETED)
                    if last_state is not None
                    else None
                )
                if last_completed:
                    self._last_completed = self._parse_date(last_completed)

        if self._last_completed:
            await self._save_last_completed()

        if self.entity_id is not None:
            self._hass.data[DOMAIN][DATA_ENTITIES][self.entity_id] = self

        self.async_on_remove(
            async_track_time_change(
                self._hass,
                self._async_handle_midnight,
                hour=0,
                minute=0,
                second=0,
            )
        )

    async def async_will_remove_from_hass(self) -> None:
        """Unregister this entity from the service lookup."""
        if self.entity_id is not None:
            self._hass.data[DOMAIN][DATA_ENTITIES].pop(self.entity_id, None)

    async def async_mark_complete(self) -> None:
        """Mark the task complete today."""
        self._last_completed = dt_util.now().date()
        await self._save_last_completed()
        self.async_write_ha_state()

    async def _save_last_completed(self) -> None:
        """Persist the completion date."""
        last_completed = self._last_completed.isoformat()
        options = dict(self._entry.options)
        options[CONF_LAST_COMPLETED] = last_completed

        if (
            self._entry.options.get(CONF_LAST_COMPLETED) != last_completed
            and hasattr(self._hass.config_entries, "async_update_entry")
        ):
            self._hass.config_entries.async_update_entry(
                self._entry,
                options=options,
            )

        await self._store.async_save({ATTR_LAST_COMPLETED: last_completed})

    @callback
    def _async_handle_midnight(self, now) -> None:
        """Refresh the calculated days-since value at midnight."""
        self.async_write_ha_state()

    def _parse_date(self, value: str) -> date | None:
        """Parse a stored date, ignoring invalid stale data."""
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
