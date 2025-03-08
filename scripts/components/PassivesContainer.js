import { CONFIG } from '../utils/config.js';
import { Tooltip } from './Tooltip.js';

export class PassivesContainer {
    constructor(hotbarUI) {
        this.hotbarUI = hotbarUI;
        this.element = null;
        this.lastKnownActorId = null;
        // This set will hold the UUIDs of features to be displayed
        this.selectedPassives = new Set();
        this._createContainer();
        // Load saved selections (or default to all available passives)
        this.loadSelectedPassives();
    }

    _createContainer() {
        this.element = document.createElement("div");
        this.element.classList.add("passives-container");
        Object.assign(this.element.style, {
            position: "absolute",
            top: "-24px",
            left: "0",
            minWidth: "20px",
            maxWidth: "300px",
            background: CONFIG.COLORS.BACKGROUND,
            border: `1px solid ${CONFIG.COLORS.BORDER}`,
            borderRadius: "3px",
            display: "flex",
            alignItems: "center",
            padding: "2px 4px",
            boxSizing: "border-box",
            zIndex: CONFIG.Z_INDEX.OVERLAY.ABILITY_CARD - 1,
            cursor: "pointer",
            flexWrap: "wrap",
            gap: "2px"
        });
        // Show tooltip on hover
        this.element.title = "Right-click to configure passive features";
        // Right-click opens configuration dialog
        this.element.addEventListener("contextmenu", this._showPassivesDialog.bind(this));
    }

    _createFeatureIcon(feature) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("passive-feature-icon");
        Object.assign(wrapper.style, {
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2px",
            borderRadius: "2px"
        });
        // Store feature reference for later use if needed
        wrapper.dataset.uuid = feature.uuid;
        const img = document.createElement("img");
        img.src = feature.img;
        Object.assign(img.style, {
            width: "16px",
            height: "16px",
            display: "block",
            cursor: "pointer"
        });
        // Optional: Add hover effects for the icon
        wrapper.addEventListener("mouseenter", () => {
            img.style.filter = "brightness(1.2)";
            wrapper.style.background = CONFIG.COLORS.BACKGROUND_HIGHLIGHT;
        });
        wrapper.addEventListener("mouseleave", () => {
            img.style.filter = "none";
            wrapper.style.background = "transparent";
        });
        // Clicking the icon uses the feature if defined
        wrapper.addEventListener("click", async () => {
            if (feature.use) await feature.use();
        });
        // Attach a tooltip if needed
        wrapper.addEventListener("mouseenter", (evt) => {
            const tooltip = new Tooltip();
            tooltip.attach(wrapper, { uuid: feature.uuid, name: feature.name, icon: feature.img }, evt);
            wrapper._hotbarTooltip = tooltip;
        });
        wrapper.addEventListener("mouseleave", () => {
            if (wrapper._hotbarTooltip && !wrapper._hotbarTooltip._pinned) {
                wrapper._hotbarTooltip.remove();
                wrapper._hotbarTooltip = null;
            }
        });
        wrapper.appendChild(img);
        return wrapper;
    }

    // Loads the saved flag; if none, default to all available passive features.
    async loadSelectedPassives() {
        let actor = null;

        // Try to get the actor from lastKnownActorId
        if (this.lastKnownActorId) {
            actor = game.actors.get(this.lastKnownActorId);
        }

        // If not, then get it from the current token
        if (!actor) {
            const token = canvas.tokens.get(this.hotbarUI.manager.currentTokenId);
            if (token?.actor) {
                actor = game.actors.get(token.actor.id);
                this.lastKnownActorId = actor.id;
            }
        }

        if (!actor) return;
        
        // Get all available passive features from the actor
        const availablePassives = actor.items
            .filter(item => item.type === "feat" && (!item.system.activation?.type || item.system.activation.type === "passive"))
            .map(item => item.uuid);
        
        // Try to get saved configuration
        const saved = actor.getFlag(CONFIG.MODULE_NAME, "selectedPassives");
        
        if (saved && Array.isArray(saved)) {
            this.selectedPassives = new Set(saved);
        } else {
            // Default: show all features
            this.selectedPassives = new Set(availablePassives);
            // Save default selection for future loads
            await actor.setFlag(CONFIG.MODULE_NAME, "selectedPassives", availablePassives);
        }
        
        this._updatePassiveDisplay();
    }

    // Saves the current selectedPassives to the actor flag
    async saveSelectedPassives() {
        const token = canvas.tokens.get(this.hotbarUI.manager.currentTokenId);
        if (!token?.actor) return;
        await token.actor.setFlag(CONFIG.MODULE_NAME, "selectedPassives", Array.from(this.selectedPassives));
    }

    // Update the container display: show icons for passives that are selected
    _updatePassiveDisplay() {
        let actor = null;

        // Try to get the actor from lastKnownActorId
        if (this.lastKnownActorId) {
            actor = game.actors.get(this.lastKnownActorId);
        }

        // If not, then get it from the current token
        if (!actor) {
            const token = canvas.tokens.get(this.hotbarUI.manager.currentTokenId);
            if (token?.actor) {
                actor = game.actors.get(token.actor.id);
                this.lastKnownActorId = actor.id;
            }
        }

        if (!actor) {
            this.element.style.display = 'none';
            return;
        }
        
        // Get all available passive features from the actor
        const availablePassives = actor.items.filter(item => 
            item.type === "feat" && (!item.system.activation?.type || item.system.activation.type === "passive")
        );

        // If there are no passives at all, hide the container completely
        if (availablePassives.length === 0) {
            this.element.style.display = 'none';
            return;
        }

        // Clear current icons
        this.element.innerHTML = "";
        
        // Filter actor items to only include those passives marked as selected
        const featuresToShow = availablePassives.filter(item => this.selectedPassives.has(item.uuid));
        
        // If no passives are selected to show, display minimal container
        if (featuresToShow.length === 0) {
            this.element.style.display = 'flex';
            this.element.style.minWidth = '20px';
            this.element.style.width = '20px';
            this.element.style.height = '20px';
            return;
        }

        // Show container normally with selected passives
        this.element.style.display = 'flex';
        this.element.style.minWidth = '20px';
        this.element.style.width = 'auto';
        this.element.style.height = 'auto';
        
        featuresToShow.forEach(feature => {
            const iconEl = this._createFeatureIcon(feature);
            this.element.appendChild(iconEl);
        });
    }

    // Show dialog to configure passives
    _showPassivesDialog(event) {
        event.preventDefault();
        
        let actor = null;

        // Try to get the actor from lastKnownActorId
        if (this.lastKnownActorId) {
            actor = game.actors.get(this.lastKnownActorId);
        }

        // If not, then get it from the current token
        if (!actor) {
            const token = canvas.tokens.get(this.hotbarUI.manager.currentTokenId);
            if (token?.actor) {
                actor = game.actors.get(token.actor.id);
                this.lastKnownActorId = actor.id;
            }
        }

        if (!actor) return;
        
        // Get all available passive features from the actor
        const availableFeatures = actor.items.filter(item =>
            item.type === "feat" && (!item.system.activation?.type || item.system.activation.type === "passive")
        );
        
        // Build HTML content using a template string:
        let contentHTML = `<div style="padding: 8px; width: 400px;">
            <p>Select which passive features should be displayed in the passives bar.</p>
            <div id="passives-list" style="display: flex; flex-direction: column; gap: 8px;">`;
        
        availableFeatures.forEach(feature => {
            // Each row gets a data-feature attribute with its UUID.
            contentHTML += `
                <div class="passives-row" style="display: flex; align-items: center; gap: 8px; padding: 4px; cursor: pointer; border-radius: 3px;"
                     data-feature="${feature.uuid}">
                    <input type="checkbox" class="passives-checkbox" value="${feature.uuid}" style="cursor: pointer;" 
                        ${this.selectedPassives.has(feature.uuid) ? "checked" : ""}>
                    <img src="${feature.img}" style="width: 16px; height: 16px; display: block;" alt="${feature.name}">
                    <span>${feature.name}</span>
                </div>`;
        });
        
        contentHTML += `</div></div>`;
        
        // Create and show dialog using the HTML string:
        const dialog = new Dialog({
            title: "Configure Passive Features",
            content: contentHTML,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: "Save",
                    callback: async (html) => {
                        // Use jQuery to query within the dialog's content container
                        const $dialogContent = $(html);
                        // Find all checkboxes and build a new set based on their checked state
                        const newSelection = new Set();
                        $dialogContent.find("input.passives-checkbox").each(function() {
                            if ($(this).is(":checked")) {
                                newSelection.add($(this).val());
                            }
                        });
                        // Update our selection and persist it
                        this.selectedPassives = newSelection;
                        await this.saveSelectedPassives();
                        this._updatePassiveDisplay();
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "save"
        }, {
            classes: ["configure-passives"],
            width: 400,
            resizable: true
        });
        
        dialog.render(true);

        // Add click handlers after dialog is rendered
        setTimeout(() => {
            const $rows = $('.passives-row');
            
            // Click handlers for rows
            $rows.on('click', function(e) {
                if (!$(e.target).is('input')) {
                    const checkbox = $(this).find('input[type="checkbox"]');
                    checkbox.prop('checked', !checkbox.prop('checked'));
                }
            });
        }, 100);
    }

    // Clean up container when needed
    destroy() {
        if (this.element?.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.hotbarUI = null;
    }

    // Update method for HotbarUI to call
    async update() {
        await this.loadSelectedPassives();
    }
} 