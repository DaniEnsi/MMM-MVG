Module.register("MMM-MVG", {
    defaults: {
        maxEntries: 5,
        stopId: "de:09162:6",
        destinationStopId: null,
        lineFilter: [],           // e.g., ["U3", "U6"] to show only these lines
        destinationFilter: [],    // e.g., ["Garching"] to show only trains going towards Garching
        walkingTime: 0,
        showDelay: true
    },

    start() {
        this.departures = [];
        // Create a unique identifier based on config to prevent cross-module data mixing
        this.customId = `${this.config.stopId}_${this.config.destinationStopId || "none"}_${this.config.header || ""}`;
        // Stagger initial load based on module index to avoid simultaneous requests
        const delay = Math.random() * 2000;
        setTimeout(() => this.loadDepartures(), delay);
        setInterval(() => this.loadDepartures(), 60000);
        setInterval(() => this.updateDom(), 10000);
    },

    socketNotificationReceived(notification, payload) {
        if (notification === "DEPARTURES" && payload.identifier === this.customId) {
            this.departures = payload.departures;
            this.updateDom();
        }
    },

    getStyles() {
        return ["MMM-MVG.css"];
    },

    getHeader() {
        return this.config.header || "MVG";
    },

    formatTime(timestamp) {
        const d = new Date(timestamp);
        return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    },

    getDom() {
        const wrapper = document.createElement("div");
        wrapper.className = "mvg-wrapper";

        if (!this.departures.length) {
            wrapper.innerHTML = "Laden...";
            return wrapper;
        }

        const now = Date.now();
        const walk = this.config.walkingTime || 0;
        const showDelay = this.config.showDelay;
        const hasDestination = !!this.config.destinationStopId;
        const table = document.createElement("table");
        table.className = "mvg-table";

        // Add header row
        const headerRow = document.createElement("tr");
        headerRow.className = "header-row";
        headerRow.innerHTML = `<th class="h-icon"></th><th class="h-line">Line</th><th class="h-dest">Destination</th><th class="h-time">Departure</th>` +
            (hasDestination ? `<th class="h-arrival">Arrival</th>` : "") +
            (walk > 0 ? `<th class="h-leave">Leave</th>` : "") +
            `<th class="h-countdown"></th>`;
        table.appendChild(headerRow);

        // Filter out past departures and those too late to catch, limit to maxEntries
        const entries = this.departures
            .filter(d => {
                const mins = Math.round((d.actualTime - now) / 60000);
                const leaveIn = mins - walk;
                return d.actualTime > now && leaveIn >= -1;
            })
            .slice(0, this.config.maxEntries);

        for (const dep of entries) {
            const mins = Math.max(0, Math.round((dep.actualTime - now) / 60000));
            const leaveIn = mins - walk;
            const leaveTime = new Date(dep.actualTime - walk * 60000);
            const leaveStr = this.formatTime(leaveTime);
            const actualStr = this.formatTime(dep.actualTime);

            const row = document.createElement("tr");

            // Icon
            const iconCell = document.createElement("td");
            iconCell.className = "icon";
            const img = document.createElement("img");
            img.src = this.file(`assets/${dep.type}.svg`);
            img.className = "line-icon";
            iconCell.appendChild(img);
            row.appendChild(iconCell);

            // Line
            const lineCell = document.createElement("td");
            lineCell.className = "line";
            lineCell.textContent = dep.line;
            row.appendChild(lineCell);

            // Destination
            const destCell = document.createElement("td");
            destCell.className = "dest";
            destCell.textContent = dep.destination;
            row.appendChild(destCell);

            // Departure time with delay indicator
            const timeCell = document.createElement("td");
            timeCell.className = "time";
            if (showDelay && dep.delay !== 0) {
                const delayClass = dep.delay > 0 ? "delay-late" : "delay-early";
                const delayStr = dep.delay > 0 ? `+${dep.delay}` : `${dep.delay}`;
                timeCell.innerHTML = `${actualStr} <span class="${delayClass}">${delayStr}</span>`;
            } else {
                timeCell.textContent = actualStr;
            }
            row.appendChild(timeCell);

            // Arrival time (if destination configured)
            if (hasDestination) {
                const arrivalCell = document.createElement("td");
                arrivalCell.className = "arrival";
                arrivalCell.textContent = dep.arrivalTime || "-";
                row.appendChild(arrivalCell);
            }

            // Leave time
            const leaveCell = document.createElement("td");
            leaveCell.className = "leave";
            if (walk > 0) {
                leaveCell.textContent = leaveStr;
            }
            row.appendChild(leaveCell);

            // Countdown
            const countdownCell = document.createElement("td");
            countdownCell.className = "countdown";
            if (walk > 0) {
                if (leaveIn <= 0) {
                    countdownCell.innerHTML = `<span class="urgent">Now</span>`;
                } else if (leaveIn <= 3) {
                    countdownCell.innerHTML = `<span class="soon">${leaveIn}m</span>`;
                } else {
                    countdownCell.textContent = `${leaveIn}m`;
                }
            } else {
                countdownCell.textContent = `${mins}m`;
            }
            row.appendChild(countdownCell);

            table.appendChild(row);
        }

        wrapper.appendChild(table);
        return wrapper;
    },

    loadDepartures() {
        this.sendSocketNotification("GET_DEPARTURES", {
            stopId: this.config.stopId,
            destinationStopId: this.config.destinationStopId,
            lineFilter: this.config.lineFilter,
            destinationFilter: this.config.destinationFilter,
            identifier: this.customId
        });
    }
});
