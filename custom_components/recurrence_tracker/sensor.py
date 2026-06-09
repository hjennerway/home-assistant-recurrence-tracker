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
    DATA_ENTITIES_BY_ENTRY_ID,
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
        self._task_name = entry.options.get(CONF_TASK_NAME, entry.data[CONF_TASK_NAME])
        self._frequency_days = entry.options.get(
            CONF_FREQUENCY_DAYS,
            entry.data[CONF_FREQUENCY_DAYS],
        )
        self._last_completed: date | None = None
        self._store = Store(
            hass,
            STORAGE_VERSION,
            f"{DOMAIN}.{entry.entry_id}.json",
        )

        self._attr_name = self._task_name
        self._attr_icon = entry.options.get(CONF_ICON, entry.data[CONF_ICON])
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
        data = await self._store.async_load()
        stored_last_completed = (
            self._parse_date(data[ATTR_LAST_COMPLETED])
            if data and data.get(ATTR_LAST_COMPLETED)
            else None
        )

        if CONF_LAST_COMPLETED in self._entry.options:
            parsed_configured_last_completed = (
                self._parse_date(configured_last_completed)
                if configured_last_completed
                else None
            )
            self._last_completed = self._resolve_last_completed(
                parsed_configured_last_completed,
                stored_last_completed,
            )
            self._sync_last_completed_option()
        else:
            if stored_last_completed:
                self._last_completed = stored_last_completed
            else:
                last_state = await self.async_get_last_state()
                last_completed = (
                    last_state.attributes.get(ATTR_LAST_COMPLETED)
                    if last_state is not None
                    else None
                )
                if last_completed:
                    self._last_completed = self._parse_date(last_completed)

        if self.entity_id is not None:
            self._hass.data[DOMAIN][DATA_ENTITIES][self.entity_id] = self
        self._hass.data[DOMAIN][DATA_ENTITIES_BY_ENTRY_ID][
            self._entry.entry_id
        ] = self

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
        self._hass.data[DOMAIN][DATA_ENTITIES_BY_ENTRY_ID].pop(
            self._entry.entry_id, None
        )

    async def async_mark_complete(self) -> None:
        """Mark the task complete today."""
        await self.async_set_last_completed(dt_util.now().date())

    async def async_set_last_completed(
        self,
        last_completed: date,
    ) -> None:
        """Set and persist the task completion date."""
        self._last_completed = last_completed
        self._sync_last_completed_option()
        await self._save_last_completed()
        self.async_write_ha_state()

    async def async_clear_last_completed(self) -> None:
        """Clear the task completion date."""
        self._last_completed = None
        self._sync_last_completed_option()
        await self._store.async_save({ATTR_LAST_COMPLETED: None})
        self.async_write_ha_state()

    @callback
    def async_update_task_options(
        self,
        *,
        task_name: str,
        frequency_days: int,
        icon: str,
    ) -> None:
        """Apply editable task options without recreating the entity."""
        self._task_name = task_name
        self._frequency_days = frequency_days
        self._attr_name = task_name
        self._attr_icon = icon
        self.async_write_ha_state()

    async def _save_last_completed(self) -> None:
        """Persist the completion date."""
        last_completed = self._last_completed.isoformat()
        await self._store.async_save({ATTR_LAST_COMPLETED: last_completed})

    @callback
    def _async_handle_midnight(self, now) -> None:
        """Refresh the calculated days-since value at midnight."""
        self.async_write_ha_state()

    def _resolve_last_completed(
        self,
        configured_last_completed: date | None,
        stored_last_completed: date | None,
    ) -> date | None:
        """Resolve stale persisted dates left by older service calls."""
        if configured_last_completed is None:
            return None
        if stored_last_completed is None:
            return configured_last_completed

        return max(configured_last_completed, stored_last_completed)

    def _sync_last_completed_option(self) -> None:
        """Keep the editable config option aligned with service updates."""
        last_completed = (
            self._last_completed.isoformat() if self._last_completed else ""
        )
        if self._entry.options.get(CONF_LAST_COMPLETED) == last_completed:
            return

        self._hass.config_entries.async_update_entry(
            self._entry,
            options={
                **self._entry.options,
                CONF_LAST_COMPLETED: last_completed,
            },
        )

    def _parse_date(self, value: str) -> date | None:
        """Parse a stored date, ignoring invalid stale data."""
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
