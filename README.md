# Home Assistant Recurrence Tracker

Track recurring tasks in Home Assistant and mark them complete from a Lovelace card.

## What it provides

- A config flow for adding recurring tasks.
- One sensor entity per task.
- Task fields for name, icon, and frequency in days.
- A `recurrence_tracker.mark_complete` service that sets the task completion date to today.
- A bundled custom card that shows the task name, icon, and days since it was last completed.

## Install

Copy `custom_components/recurrence_tracker` into your Home Assistant `custom_components` directory, then restart Home Assistant.

If Home Assistant logs `ImportError: cannot import name 'DATA_ENTITIES_BY_ENTRY_ID'`,
the deployed integration files are from mixed versions. Replace the whole
`custom_components/recurrence_tracker` directory with this repository's copy,
then restart Home Assistant.

Add tasks from **Settings > Devices & services > Add integration > Recurrence Tracker**. Repeat the flow for each task you want to track.

To override a task's last reset date, open the task's Recurrence Tracker integration entry, choose **Configure**, and enter a date in `YYYY-MM-DD` format.

## Add the card

Add this Lovelace resource:

```yaml
url: /recurrence_tracker/recurrence-tracker-card.js
type: module
```

Then add a card for a task entity:

```yaml
type: custom:recurrence-tracker-card
entity: sensor.water_plants
```

Optional overrides:

```yaml
type: custom:recurrence-tracker-card
entity: sensor.water_plants
name: Water plants
icon: mdi:watering-can
```

Tapping anywhere on the card asks:

```text
Confirm <taskname> has been completed?
```

Confirming calls `recurrence_tracker.mark_complete` and updates the task's last completed date to today.
