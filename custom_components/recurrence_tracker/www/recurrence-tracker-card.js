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
    const renderSignature = [
      stateObj.state,
      attrs.task_name,
      attrs.friendly_name,
      attrs.icon,
      attrs.frequency_days,
      this.config.name,
      this.config.icon,
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
    const palette = this._getPalette(elapsedPercent);
    const isDue = hasCompletion && Number.isFinite(frequency) && days >= frequency;
    const daysLabel = hasCompletion
      ? `${days} ${days === 1 ? "day" : "days"} ago`
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
          --recurrence-tracker-accent: ${palette.accent};
          background: ${palette.background};
          border: 1px solid ${palette.border};
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
          gap: 12px;
          grid-template-columns: auto 1fr auto;
          min-height: 68px;
          padding: 8px 10px;
        }

        .icon {
          align-items: center;
          background: ${palette.iconBackground};
          border-radius: 8px;
          box-shadow: inset 0 1px 0 ${palette.iconHighlight};
          color: var(--recurrence-tracker-accent);
          display: flex;
          height: 48px;
          justify-content: center;
          width: 48px;
        }

        ha-icon {
          --mdc-icon-size: 28px;
        }

        .name {
          color: ${palette.text};
          font-size: 1.05rem;
          font-weight: 600;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .meta {
          color: ${palette.meta};
          font-size: 0.85rem;
          line-height: 1.35;
          margin-top: 4px;
        }

        .days {
          color: ${palette.text};
          font-size: 1.55rem;
          font-weight: 700;
          line-height: 1;
          text-align: right;
          white-space: nowrap;
        }

        .status {
          color: ${palette.status};
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

  _getPalette(elapsedPercent) {
    if (elapsedPercent < 40) {
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

    if (elapsedPercent <= 80) {
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

customElements.define("recurrence-tracker-card", RecurrenceTrackerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "recurrence-tracker-card",
  name: "Recurrence Tracker Card",
  description: "Show a recurring task and mark it complete.",
});
