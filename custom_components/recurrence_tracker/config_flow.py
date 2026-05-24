"""Config flow for Recurrence Tracker."""

from __future__ import annotations

from datetime import date
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback

from .const import (
    CONF_FREQUENCY_DAYS,
    CONF_ICON,
    CONF_LAST_COMPLETED,
    CONF_TASK_NAME,
    DATA_ENTITIES_BY_ENTRY_ID,
    DOMAIN,
)

DEFAULT_ICON = "mdi:check-circle-outline"


class RecurrenceTrackerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for a recurring task."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Return the options flow."""
        return RecurrenceTrackerOptionsFlow(config_entry)

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Create a recurring task."""
        errors: dict[str, str] = {}

        if user_input is not None:
            task_name = user_input[CONF_TASK_NAME].strip()
            frequency_days = user_input[CONF_FREQUENCY_DAYS]

            if not task_name:
                errors[CONF_TASK_NAME] = "name_required"
            elif frequency_days < 1:
                errors[CONF_FREQUENCY_DAYS] = "frequency_required"
            else:
                return self.async_create_entry(
                    title=task_name,
                    data={
                        CONF_TASK_NAME: task_name,
                        CONF_ICON: user_input[CONF_ICON],
                        CONF_FREQUENCY_DAYS: frequency_days,
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_TASK_NAME): str,
                    vol.Required(CONF_ICON, default=DEFAULT_ICON): str,
                    vol.Required(CONF_FREQUENCY_DAYS, default=7): vol.All(
                        vol.Coerce(int), vol.Range(min=1)
                    ),
                }
            ),
            errors=errors,
        )


class RecurrenceTrackerOptionsFlow(config_entries.OptionsFlow):
    """Handle options for a recurring task."""

    def __init__(self, config_entry) -> None:
        """Initialize the options flow."""
        self._config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Manage task options."""
        errors: dict[str, str] = {}

        if user_input is not None:
            last_completed = user_input.get(CONF_LAST_COMPLETED, "").strip()

            if last_completed:
                try:
                    date.fromisoformat(last_completed)
                except ValueError:
                    errors[CONF_LAST_COMPLETED] = "invalid_date"

            if not errors:
                entity = self.hass.data.get(DOMAIN, {}).get(
                    DATA_ENTITIES_BY_ENTRY_ID, {}
                ).get(self._config_entry.entry_id)

                if entity is not None and last_completed:
                    await entity.async_set_last_completed(
                        date.fromisoformat(last_completed),
                        persist_options=False,
                    )

                return self.async_create_entry(
                    title="",
                    data={CONF_LAST_COMPLETED: last_completed}
                    if last_completed
                    else {},
                )

        current_last_completed = self._config_entry.options.get(CONF_LAST_COMPLETED, "")

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_LAST_COMPLETED,
                        default=current_last_completed,
                    ): str,
                }
            ),
            errors=errors,
        )
