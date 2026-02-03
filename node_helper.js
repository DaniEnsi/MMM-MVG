const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
    start() {
        console.log("[MMM-MVG] Node helper started");
        this.queue = [];
        this.processing = false;
    },

    socketNotificationReceived(notification, payload) {
        if (notification === "GET_DEPARTURES") {
            console.log("[MMM-MVG] Received GET_DEPARTURES for", payload.stopId);
            this.queue.push(payload);
            this.processQueue();
        }
    },

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const payload = this.queue.shift();
            await this.fetchDepartures(payload);
            // Small delay between requests to avoid rate limiting
            if (this.queue.length > 0) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        this.processing = false;
    },

    parseTime(timeStr, now) {
        const [h, m] = timeStr.split(":").map(Number);
        const t = new Date();
        t.setHours(h, m, 0, 0);
        if (t.getTime() < now) t.setDate(t.getDate() + 1);
        return t.getTime();
    },

    calcDelay(plannedStr, actualStr) {
        // Calculate delay in minutes by comparing time strings directly
        const [ph, pm] = plannedStr.split(":").map(Number);
        const [ah, am] = actualStr.split(":").map(Number);
        const plannedMins = ph * 60 + pm;
        const actualMins = ah * 60 + am;
        let diff = actualMins - plannedMins;
        // Handle midnight wrap (e.g., planned 23:55, actual 00:05 = +10 not -1430)
        if (diff > 720) diff -= 1440;  // More than 12h late = probably early
        if (diff < -720) diff += 1440; // More than 12h early = probably late
        return diff;
    },

    async fetchDepartures({ stopId, destinationStopId, lineFilter, destinationFilter, identifier }) {
        try {
            const url = `https://www.mvv-muenchen.de/?eID=departuresFinder&action=get_departures&stop_id=${stopId}&requested_timestamp=${Math.floor(Date.now()/1000)}&lines=all`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const json = await res.json();
            const now = Date.now();
            
            let departures = (json.departures || [])
                .filter(d => d.departureLive && !d.departureLive.includes("entf"))
                .map(d => {
                    const actualTime = this.parseTime(d.departureLive || d.departurePlanned, now);
                    const delay = this.calcDelay(d.departurePlanned, d.departureLive || d.departurePlanned);
                    const name = (d.line?.name || "").toLowerCase();
                    return {
                        type: name.includes("u-bahn") ? "ubahn" : name.includes("s-bahn") ? "sbahn" : name.includes("tram") ? "tram" : "bus",
                        line: d.line?.number || "",
                        destination: d.direction || "",
                        actualTime,
                        delay,
                        inTime: d.inTime !== false
                    };
                })
                .filter(d => d.actualTime - now >= 0 && d.actualTime - now <= 7200000)
                .sort((a, b) => a.actualTime - b.actualTime);

            // Apply line filter if specified
            if (lineFilter && lineFilter.length > 0) {
                departures = departures.filter(d => lineFilter.includes(d.line));
            }

            // Apply destination filter if specified (filters by destination text containing any of the keywords)
            if (destinationFilter && destinationFilter.length > 0) {
                departures = departures.filter(d => 
                    destinationFilter.some(keyword => 
                        d.destination.toLowerCase().includes(keyword.toLowerCase())
                    )
                );
            }

            // If destination is configured, fetch trip data for arrival times
            if (destinationStopId && departures.length > 0) {
                departures = await this.enrichWithArrivalTimes(departures, stopId, destinationStopId);
            }
            
            console.log("[MMM-MVG] Sending", departures.length, "departures for", stopId);
            this.sendSocketNotification("DEPARTURES", { identifier, departures });
        } catch (e) {
            console.error("[MMM-MVG]", stopId, e.message);
            this.sendSocketNotification("DEPARTURES", { identifier, departures: [] });
        }
    },

    async enrichWithArrivalTimes(departures, originStopId, destinationStopId) {
        try {
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
            const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
            
            const url = `https://efa.mvv-muenchen.de/ng/XSLT_TRIP_REQUEST2?outputFormat=JSON&language=en&type_origin=stopID&name_origin=${originStopId}&type_destination=stopID&name_destination=${destinationStopId}&itdDate=${dateStr}&itdTime=${timeStr}&itdTripDateTimeDepArr=dep`;
            
            const res = await fetch(url);
            if (!res.ok) {
                console.error("[MMM-MVG] Trip API error:", res.status);
                return departures;
            }
            
            const json = await res.json();
            const trips = json.trips || [];
            
            // Build a map of line -> journey duration in minutes
            const journeyDurations = new Map();
            for (const trip of trips) {
                if (!trip.legs || trip.legs.length === 0) continue;
                const leg = trip.legs[0];
                if (!leg.points || leg.points.length < 2) continue;
                
                const depPoint = leg.points[0];
                const arrPoint = leg.points[leg.points.length - 1];
                const line = leg.mode?.number || "";
                const depTimeStr = depPoint.dateTime?.time;
                const arrTimeStr = arrPoint.dateTime?.time;
                
                if (depTimeStr && arrTimeStr && line && !journeyDurations.has(line)) {
                    // Calculate journey duration in minutes
                    const [dh, dm] = depTimeStr.split(":").map(Number);
                    const [ah, am] = arrTimeStr.split(":").map(Number);
                    const duration = (ah * 60 + am) - (dh * 60 + dm);
                    if (duration > 0 && duration < 120) { // Sanity check: 0-2 hours
                        journeyDurations.set(line, duration);
                    }
                }
            }
            
            // Calculate average duration as fallback for lines not in the trip results
            let defaultDuration = 0;
            if (journeyDurations.size > 0) {
                const durations = Array.from(journeyDurations.values());
                defaultDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
            }
            
            // Enrich departures with arrival times based on journey duration
            for (const dep of departures) {
                const duration = journeyDurations.get(dep.line) || defaultDuration;
                if (duration > 0) {
                    const arrivalTimestamp = dep.actualTime + duration * 60000;
                    const arrTime = new Date(arrivalTimestamp);
                    dep.arrivalTime = `${arrTime.getHours()}:${String(arrTime.getMinutes()).padStart(2, "0")}`;
                }
            }
            
            return departures;
        } catch (e) {
            console.error("[MMM-MVG] Trip enrichment error:", e.message);
            return departures;
        }
    }
});
