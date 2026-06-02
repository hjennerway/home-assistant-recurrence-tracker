const RECURRENCE_TRACKER_CARD_VERSION = "0.1.6";
const RECURRENCE_TRACKER_CARD_ORIENTATIONS = ["default", "stacked"];
const RECURRENCE_TRACKER_CARD_SHOW_OPTIONS = [
  "show_days_ago",
  "show_frequency",
  "show_name",
  "show_days_until_due",
  "show_icon",
];
const RECURRENCE_TRACKER_CARD_THRESHOLD_DEFAULTS = {
  warning_threshold: 40,
  due_threshold: 80,
};
const RECURRENCE_TRACKER_CARD_FONT_SIZE_OPTIONS = [
  "name_font_size",
  "frequency_font_size",
  "days_ago_font_size",
  "days_until_due_font_size",
  "icon_size",
];
const RECURRENCE_TRACKER_CARD_DEFAULT_CONFIG = {
  orientation: "default",
  show_days_ago: true,
  show_frequency: true,
  show_name: true,
  show_days_until_due: true,
  show_icon: true,
  ...RECURRENCE_TRACKER_CARD_THRESHOLD_DEFAULTS,
};
const RECURRENCE_TRACKER_CARD_EDITOR_SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "sensor" } } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  {
    name: "orientation",
    selector: {
      select: {
        options: [
          { value: "default", label: "Default" },
          { value: "stacked", label: "Stacked" },
        ],
      },
    },
  },
  { name: "show_name", selector: { boolean: {} } },
  { name: "show_icon", selector: { boolean: {} } },
  { name: "show_days_ago", selector: { boolean: {} } },
  { name: "show_days_until_due", selector: { boolean: {} } },
  { name: "show_frequency", selector: { boolean: {} } },
  {
    name: "warning_threshold",
    selector: { number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } },
  },
  {
    name: "due_threshold",
    selector: { number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } },
  },
  { name: "name_font_size", selector: { text: {} } },
  { name: "frequency_font_size", selector: { text: {} } },
  { name: "days_ago_font_size", selector: { text: {} } },
  { name: "days_until_due_font_size", selector: { text: {} } },
  { name: "icon_size", selector: { text: {} } },
];
const RECURRENCE_TRACKER_CARD_EDITOR_LABELS = {
  entity: "Entity",
  name: "Name override",
  icon: "Icon override",
  orientation: "Orientation",
  show_name: "Show name",
  show_icon: "Show icon",
  show_days_ago: "Show days ago",
  show_days_until_due: "Show days until due",
  show_frequency: "Show frequency",
  warning_threshold: "Warning threshold",
  due_threshold: "Due threshold",
  name_font_size: "Name font size",
  frequency_font_size: "Frequency font size",
  days_ago_font_size: "Days ago font size",
  days_until_due_font_size: "Days until due font size",
  icon_size: "Icon size",
};

console.info(
  `%cRECURRENCE TRACKER CARD%c v${RECURRENCE_TRACKER_CARD_VERSION}`,
  "color: #ffffff; background: #166534; font-weight: 700; padding: 2px 6px; border-radius: 4px;",
  "color: #166534; font-weight: 700;"
);

class RecurrenceTrackerCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement("recurrence-tracker-card-editor");
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass.states).find(
      (entityId) =>
        entityId.startsWith("sensor.") &&
        hass.states[entityId].attributes.frequency_days !== undefined
    );

    return {
      type: "custom:recurrence-tracker-card",
      entity: entity || "",
      ...RECURRENCE_TRACKER_CARD_DEFAULT_CONFIG,
    };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Entity is required");
    }

    this.config = config;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
  }

  set hass(hass) {
    this._hass = hass;
    const stateObj = hass.states[this.config.entity];

    if (!stateObj) {
      this._renderUnavailable();
      return;
    }

    const attrs = stateObj.attributes;
    const name =
      this.config.name || attrs.task_name || attrs.friendly_name || this.config.entity;
    const icon = this.config.icon || attrs.icon || "mdi:check-circle-outline";
    const frequency = Number(attrs.frequency_days);
    const days = Number(stateObj.state);
    const showDaysAgo = this._shouldShow("show_days_ago");
    const showFrequency = this._shouldShow("show_frequency");
    const showName = this._shouldShow("show_name");
    const showDaysUntilDue = this._shouldShow("show_days_until_due");
    const showIcon = this._shouldShow("show_icon");
    const showDetails = showName || showFrequency;
    const showCount = showDaysAgo || showDaysUntilDue;
    const orientation = this._getOrientation();
    const isStacked = orientation === "stacked";
    const { warningThreshold, dueThreshold } = this._getColorThresholds();
    const nameFontSize = this._getCssSize("name_font_size", "1.05rem");
    const frequencyFontSize = this._getCssSize("frequency_font_size", "0.85rem");
    const daysAgoFontSize = this._getCssSize("days_ago_font_size", "1.55rem");
    const mobileDaysAgoFontSize = this.config.days_ago_font_size
      ? daysAgoFontSize
      : "1.35rem";
    const daysUntilDueFontSize = this._getCssSize(
      "days_until_due_font_size",
      "0.78rem"
    );
    const iconSize = this._getCssSize("icon_size", "28px");
    const narrowIconSize = this.config.icon_size ? iconSize : "24px";
    const renderSignature = [
      stateObj.state,
      attrs.task_name,
      attrs.friendly_name,
      attrs.icon,
      attrs.frequency_days,
      this.config.name,
      this.config.icon,
      showDaysAgo,
      showFrequency,
      showName,
      showDaysUntilDue,
      showIcon,
      orientation,
      warningThreshold,
      dueThreshold,
      nameFontSize,
      frequencyFontSize,
      daysAgoFontSize,
      daysUntilDueFontSize,
      iconSize,
    ].join("|");

    if (renderSignature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = renderSignature;

    const hasCompletion = Number.isFinite(days);
    const elapsedPercent =
      hasCompletion && Number.isFinite(frequency) && frequency > 0
        ? (days / frequency) * 100
        : 100;
    const palette = this._getPalette(elapsedPercent, warningThreshold, dueThreshold);
    const isDue = hasCompletion && Number.isFinite(frequency) && days >= frequency;
    const daysLabel = hasCompletion
      ? `${days} ${days === 1 ? "day" : "days"} ago`
      : "Never";
    const statusLabel = hasCompletion
      ? isDue
        ? "Due"
        : `${Math.max(frequency - days, 0)} ${frequency - days === 1 ? "day" : "days"} left`
      : "Not completed";
    const stackedLabelsHtml = isStacked
      ? `<div class="stack">
            ${showName ? `<div class="name">${this._escapeHtml(name)}</div>` : ""}
            ${
              showFrequency
                ? `<div class="meta">Every ${this._escapeHtml(String(frequency))} ${
                    frequency === 1 ? "day" : "days"
                  }</div>`
                : ""
            }
            ${
              showDaysAgo
                ? `<div class="days">${this._escapeHtml(daysLabel)}</div>`
                : ""
            }
            ${
              showDaysUntilDue
                ? `<div class="status">${this._escapeHtml(statusLabel)}</div>`
                : ""
            }
          </div>`
      : "";
    const detailsHtml = !isStacked && showDetails
      ? `<div class="details">
            ${showName ? `<div class="name">${this._escapeHtml(name)}</div>` : ""}
            ${
              showFrequency
                ? `<div class="meta">Every ${this._escapeHtml(String(frequency))} ${
                    frequency === 1 ? "day" : "days"
                  }</div>`
                : ""
            }
          </div>`
      : "";
    const countHtml = !isStacked && showCount
      ? `<div class="count">
            ${
              showDaysAgo
                ? `<div class="days">${this._escapeHtml(daysLabel)}</div>`
                : ""
            }
            ${
              showDaysUntilDue
                ? `<div class="status">${this._escapeHtml(statusLabel)}</div>`
                : ""
            }
          </div>`
      : "";
    const labelsHtml = isStacked
      ? stackedLabelsHtml
      : `${detailsHtml}${countHtml}`;

    this._taskName = name;
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          --recurrence-tracker-accent: ${palette.accent};
          --recurrence-tracker-days-font-size: ${daysAgoFontSize};
          --recurrence-tracker-days-font-size-mobile: ${mobileDaysAgoFontSize};
          --recurrence-tracker-frequency-font-size: ${frequencyFontSize};
          --recurrence-tracker-icon-size: ${iconSize};
          --recurrence-tracker-icon-size-narrow: ${narrowIconSize};
          --recurrence-tracker-name-font-size: ${nameFontSize};
          --recurrence-tracker-status-font-size: ${daysUntilDueFontSize};
          background: ${palette.background};
          border: 1px solid ${palette.border};
          container-type: inline-size;
          cursor: pointer;
          outline: none;
          overflow: hidden;
        }

        ha-card:focus-visible {
          box-shadow: 0 0 0 2px var(--primary-color);
        }

        .content {
          align-items: center;
          box-sizing: border-box;
          display: flex;
          gap: 12px;
          min-height: 68px;
          padding: 8px 10px;
        }

        .content-stacked {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-areas: "icon stack";
          justify-items: stretch;
        }

        .content-stacked.content-no-icon {
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas: "stack";
        }

        .icon {
          align-items: center;
          background: ${palette.iconBackground};
          border-radius: 8px;
          box-shadow: inset 0 1px 0 ${palette.iconHighlight};
          color: var(--recurrence-tracker-accent);
          display: flex;
          flex: 0 0 48px;
          height: 48px;
          justify-content: center;
          width: 48px;
        }

        .content-stacked .icon {
          grid-area: icon;
        }

        ha-icon {
          --mdc-icon-size: var(--recurrence-tracker-icon-size);
        }

        .details {
          flex: 1 1 auto;
          min-width: 0;
        }

        .stack {
          align-items: flex-start;
          display: flex;
          flex-direction: column;
          grid-area: stack;
          min-width: 0;
          text-align: left;
        }

        .name {
          color: ${palette.text};
          font-size: var(--recurrence-tracker-name-font-size);
          font-weight: 600;
          line-height: 1.25;
          overflow-wrap: break-word;
        }

        .meta {
          color: ${palette.meta};
          font-size: var(--recurrence-tracker-frequency-font-size);
          line-height: 1.35;
          margin-top: 4px;
        }

        .details > :first-child,
        .count > :first-child {
          margin-top: 0;
        }

        .count {
          flex: 0 0 auto;
          margin-left: auto;
          min-width: 0;
          max-width: 45%;
        }

        .days {
          color: ${palette.text};
          font-size: var(--recurrence-tracker-days-font-size);
          font-weight: 700;
          line-height: 1;
          text-align: right;
          white-space: nowrap;
        }

        .status {
          color: ${palette.status};
          font-size: var(--recurrence-tracker-status-font-size);
          font-weight: 600;
          line-height: 1.2;
          margin-top: 6px;
          text-align: right;
          white-space: nowrap;
        }

        .content-stacked .stack > :first-child {
          margin-top: 0;
        }

        .content-stacked .name,
        .content-stacked .meta,
        .content-stacked .days,
        .content-stacked .status {
          text-align: left;
        }

        @container (max-width: 420px) {
          .content {
            align-items: center;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            grid-template-areas:
              "icon count"
              "details details";
            gap: 10px 12px;
            min-height: auto;
            padding: 10px 12px;
          }

          .content-stacked {
            grid-template-areas: "icon stack";
            grid-template-columns: auto minmax(0, 1fr);
          }

          .content-stacked.content-no-icon {
            grid-template-areas: "stack";
            grid-template-columns: minmax(0, 1fr);
          }

          .icon {
            grid-area: icon;
          }

          .details {
            grid-area: details;
          }

          .count {
            grid-area: count;
            justify-self: end;
            margin-left: 0;
            max-width: 100%;
          }

          .days {
            font-size: var(--recurrence-tracker-days-font-size-mobile);
            text-align: right;
          }

          .status {
            margin-top: 0;
            text-align: right;
          }

          .content-stacked .status {
            margin-top: 6px;
            text-align: left;
          }
          .content-stacked .days {
            text-align: left;
          }
        }

        @container (max-width: 240px) {
          .content:not(.content-stacked) {
            grid-template-areas:
              "icon"
              "details"
              "count";
            grid-template-columns: minmax(0, 1fr);
          }

          .icon {
            height: 40px;
            width: 40px;
          }

          ha-icon {
            --mdc-icon-size: var(--recurrence-tracker-icon-size-narrow);
          }

          .count {
            justify-self: stretch;
          }

          .days,
          .status {
            text-align: left;
          }
        }
      </style>
      <ha-card role="button" tabindex="0" aria-label="Mark ${this._escapeAttr(
        name
      )} complete">
        <div class="${
          isStacked
            ? `content content-stacked${showIcon ? "" : " content-no-icon"}`
            : "content"
        }">
          ${
            showIcon
              ? `<div class="icon">
            <ha-icon icon="${this._escapeAttr(icon)}"></ha-icon>
          </div>`
              : ""
          }
          ${labelsHtml}
        </div>
      </ha-card>
    `;

    const card = this.shadowRoot.querySelector("ha-card");
    card.addEventListener("click", () => this._confirmComplete());
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this._confirmComplete();
      }
    });
  }

  getCardSize() {
    return 2;
  }

  _shouldShow(option) {
    const value = this.config[option];

    if (typeof value === "string") {
      return !["false", "0", "off", "no"].includes(value.trim().toLowerCase());
    }

    return value !== false && value !== 0;
  }

  _getOrientation() {
    const orientation = String(this.config.orientation || "default")
      .trim()
      .toLowerCase();

    return RECURRENCE_TRACKER_CARD_ORIENTATIONS.includes(orientation)
      ? orientation
      : "default";
  }

  _getColorThresholds() {
    const warningThreshold = this._getNumberConfig("warning_threshold", 40, 0, 100);
    const dueThreshold = this._getNumberConfig(
      "due_threshold",
      80,
      warningThreshold,
      100
    );

    return { warningThreshold, dueThreshold };
  }

  _getNumberConfig(option, fallback, min, max) {
    const value = Number(this.config[option]);

    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(Math.max(value, min), max);
  }

  _getCssSize(option, fallback) {
    const value = this.config[option];

    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return `${value}px`;
    }

    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    const normalized = String(value).trim();

    if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
      return `${normalized}px`;
    }

    if (/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%)$/.test(normalized)) {
      return normalized;
    }

    return fallback;
  }

  _getPalette(elapsedPercent, warningThreshold, dueThreshold) {
    if (elapsedPercent < warningThreshold) {
      return {
        accent: "#86efac",
        background: "linear-gradient(135deg, #123524 0%, #166534 56%, #15803d 100%)",
        border: "rgba(134, 239, 172, 0.45)",
        iconBackground: "rgba(255, 255, 255, 0.12)",
        iconHighlight: "rgba(255, 255, 255, 0.18)",
        meta: "rgba(240, 253, 244, 0.82)",
        status: "#bbf7d0",
        text: "#ffffff",
      };
    }

    if (elapsedPercent <= dueThreshold) {
      return {
        accent: "#fcd34d",
        background: "linear-gradient(135deg, #3b2f0b 0%, #854d0e 56%, #b45309 100%)",
        border: "rgba(252, 211, 77, 0.48)",
        iconBackground: "rgba(255, 255, 255, 0.12)",
        iconHighlight: "rgba(255, 255, 255, 0.18)",
        meta: "rgba(255, 251, 235, 0.82)",
        status: "#fde68a",
        text: "#ffffff",
      };
    }

    return {
      accent: "#fca5a5",
      background: "linear-gradient(135deg, #3f1515 0%, #7f1d1d 56%, #b91c1c 100%)",
      border: "rgba(252, 165, 165, 0.5)",
      iconBackground: "rgba(255, 255, 255, 0.12)",
      iconHighlight: "rgba(255, 255, 255, 0.18)",
      meta: "rgba(254, 242, 242, 0.82)",
      status: "#fecaca",
      text: "#ffffff",
    };
  }

  _renderUnavailable() {
    this.shadowRoot.innerHTML = `
      <ha-card>
        <div style="padding: 16px; color: var(--error-color);">
          Entity ${this._escapeHtml(this.config.entity)} not found
        </div>
      </ha-card>
    `;
  }

  _confirmComplete() {
    if (!window.confirm(`Confirm ${this._taskName} has been completed?`)) {
      return;
    }

    this._hass.callService("recurrence_tracker", "mark_complete", {
      entity_id: this.config.entity,
    });
  }

  _escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  _escapeAttr(value) {
    return this._escapeHtml(value).replace(/`/g, "&#096;");
  }
}

class RecurrenceTrackerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      ...RECURRENCE_TRACKER_CARD_DEFAULT_CONFIG,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) {
      return;
    }

    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    this.shadowRoot.innerHTML = `
      <style>
        ha-form {
          display: block;
        }
      </style>
      <ha-form></ha-form>
    `;

    const form = this.shadowRoot.querySelector("ha-form");
    form.hass = this._hass;
    form.data = this._config;
    form.schema = RECURRENCE_TRACKER_CARD_EDITOR_SCHEMA;
    form.computeLabel = (schema) =>
      RECURRENCE_TRACKER_CARD_EDITOR_LABELS[schema.name] || schema.name;
    form.addEventListener("value-changed", (event) => {
      const config = this._cleanConfig({
        ...RECURRENCE_TRACKER_CARD_DEFAULT_CONFIG,
        ...event.detail.value,
      });

      this._config = config;
      this._fireConfigChanged(config);
    });
  }

  _cleanConfig(config) {
    const cleanedConfig = { ...config };

    cleanedConfig.orientation = this._normalizeOrientation(cleanedConfig.orientation);

    for (const option of RECURRENCE_TRACKER_CARD_SHOW_OPTIONS) {
      cleanedConfig[option] = this._normalizeBoolean(cleanedConfig[option]);
    }

    for (const [option, fallback] of Object.entries(
      RECURRENCE_TRACKER_CARD_THRESHOLD_DEFAULTS
    )) {
      cleanedConfig[option] = this._normalizeNumber(cleanedConfig[option], fallback);
    }

    if (cleanedConfig.due_threshold < cleanedConfig.warning_threshold) {
      cleanedConfig.due_threshold = cleanedConfig.warning_threshold;
    }

    for (const option of RECURRENCE_TRACKER_CARD_FONT_SIZE_OPTIONS) {
      if (!cleanedConfig[option]) {
        delete cleanedConfig[option];
        continue;
      }

      cleanedConfig[option] = String(cleanedConfig[option]).trim();
    }

    if (!cleanedConfig.name) {
      delete cleanedConfig.name;
    }

    if (!cleanedConfig.icon) {
      delete cleanedConfig.icon;
    }

    return cleanedConfig;
  }

  _normalizeBoolean(value) {
    if (typeof value === "string") {
      return !["false", "0", "off", "no"].includes(value.trim().toLowerCase());
    }

    return value !== false && value !== 0;
  }

  _normalizeOrientation(value) {
    const orientation = String(value || "default").trim().toLowerCase();

    return RECURRENCE_TRACKER_CARD_ORIENTATIONS.includes(orientation)
      ? orientation
      : "default";
  }

  _normalizeNumber(value, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return Math.min(Math.max(number, 0), 100);
  }

  _fireConfigChanged(config) {
    const event = new Event("config-changed", {
      bubbles: true,
      composed: true,
    });
    event.detail = { config };
    this.dispatchEvent(event);
  }
}

if (!customElements.get("recurrence-tracker-card")) {
  customElements.define("recurrence-tracker-card", RecurrenceTrackerCard);
}

if (!customElements.get("recurrence-tracker-card-editor")) {
  customElements.define("recurrence-tracker-card-editor", RecurrenceTrackerCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "recurrence-tracker-card")) {
  window.customCards.push({
    type: "recurrence-tracker-card",
    name: "Recurrence Tracker Card",
    description: "Show a recurring task and mark it complete.",
    preview: true,
  });
}
