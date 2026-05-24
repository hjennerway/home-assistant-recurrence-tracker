"""Config flow for Recurrence Tracker."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_ICON
import homeassistant.helpers.config_validation as cv

from .const import CONF_FREQUENCY_DAYS, CONF_TASK_NAME, DOMAIN

DEFAULT_ICON = "mdi:check-circle-outline"


class RecurrenceTrackerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for a recurring task."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
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
                    vol.Required(CONF_ICON, default=DEFAULT_ICON): cv.icon,
                    vol.Required(CONF_FREQUENCY_DAYS, default=7): vol.All(
                        cv.positive_int, vol.Range(min=1)
                    ),
                }
            ),
            errors=errors,
        )
