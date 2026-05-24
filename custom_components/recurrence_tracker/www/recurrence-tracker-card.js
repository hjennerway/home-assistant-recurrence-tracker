class RecurrenceTrackerCard extends HTMLElement {
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
    const hasCompletion = Number.isFinite(days);
    const isDue = hasCompletion && Number.isFinite(frequency) && days >= frequency;
    const daysLabel = hasCompletion
      ? `${days} ${days === 1 ? "day" : "days"}`
      : "Never";
    const statusLabel = hasCompletion
      ? isDue
        ? "Due"
        : `${Math.max(frequency - days, 0)} ${frequency - days === 1 ? "day" : "days"} left`
      : "Not completed";

    this._taskName = name;
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          cursor: pointer;
          outline: none;
          overflow: hidden;
        }

        ha-card:focus-visible {
          box-shadow: 0 0 0 2px var(--primary-color);
        }

        .content {
          align-items: center;
          display: grid;
          gap: 16px;
          grid-template-columns: auto 1fr auto;
          min-height: 84px;
          padding: 18px;
        }

        .icon {
          align-items: center;
          background: color-mix(in srgb, var(--primary-color) 14%, transparent);
          border-radius: 8px;
          color: var(--primary-color);
          display: flex;
          height: 48px;
          justify-content: center;
          width: 48px;
        }

        ha-icon {
          --mdc-icon-size: 28px;
        }

        .name {
          color: var(--primary-text-color);
          font-size: 1.05rem;
          font-weight: 600;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .meta {
          color: var(--secondary-text-color);
          font-size: 0.85rem;
          line-height: 1.35;
          margin-top: 4px;
        }

        .days {
          color: var(--primary-text-color);
          font-size: 1.55rem;
          font-weight: 700;
          line-height: 1;
          text-align: right;
          white-space: nowrap;
        }

        .status {
          color: ${isDue ? "var(--error-color)" : "var(--secondary-text-color)"};
          font-size: 0.78rem;
          font-weight: 600;
          line-height: 1.2;
          margin-top: 6px;
          text-align: right;
          white-space: nowrap;
        }

        @media (max-width: 360px) {
          .content {
            grid-template-columns: auto 1fr;
          }

          .count {
            grid-column: 1 / -1;
            justify-self: end;
          }
        }
      </style>
      <ha-card role="button" tabindex="0" aria-label="Mark ${this._escapeAttr(
        name
      )} complete">
        <div class="content">
          <div class="icon">
            <ha-icon icon="${this._escapeAttr(icon)}"></ha-icon>
          </div>
          <div>
            <div class="name">${this._escapeHtml(name)}</div>
            <div class="meta">Every ${this._escapeHtml(String(frequency))} ${
      frequency === 1 ? "day" : "days"
    }</div>
          </div>
          <div class="count">
            <div class="days">${this._escapeHtml(daysLabel)}</div>
            <div class="status">${this._escapeHtml(statusLabel)}</div>
          </div>
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

customElements.define("recurrence-tracker-card", RecurrenceTrackerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "recurrence-tracker-card",
  name: "Recurrence Tracker Card",
  description: "Show a recurring task and mark it complete.",
});
