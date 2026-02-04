# MMM-MVG

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MagicMirror²](https://img.shields.io/badge/MagicMirror²-Module-blueviolet)](https://magicmirror.builders/)
<img src="https://img.shields.io/badge/Maintained%3F-yes-green.svg"/>

A MagicMirror² module to display Munich public transport departures with real-time delay information, walking time countdowns, and destination arrival times.

> **Note:** This module is an improved fork of [MMM-MVVWiesty](https://github.com/wiesty/MMM-MVVWiesty) by [wiesty](https://github.com/wiesty). Many thanks to the original creator for the foundation!

<!-- TODO: Add screenshot -->
<img width="400" alt="Module Screenshot" src="https://via.placeholder.com/400x200?text=Screenshot+Coming+Soon" />

## Features

- **Real-time departures** from Munich MVV/MVG public transport
- **Delay indicators** showing +/- minutes with color coding (red for late, green for early)
- **Walking time countdown** - know when you need to leave, not just when the train departs
- **Destination arrival times** - see when you'll arrive at your destination station
- **Line & destination filtering** - show only relevant trains for your commute
- **Multi-instance support** - run multiple instances without API rate limiting
- **Clean, minimal UI** - matches MagicMirror aesthetic

## Requirements

- An instance of [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror)
- A Munich MVV stop ID (see Installation)

## Installation

1. Navigate to your MagicMirror modules directory:

```bash
cd ~/MagicMirror/modules
```

2. Clone this repository:

```bash
git clone https://github.com/daniensi/MMM-MVG.git
```

3. Find your stop ID:
   - Go to [mvv-muenchen.de](https://www.mvv-muenchen.de/fahrplanauskunft/fuer-entwickler/opendata/index.html)
   - Download "Haltestellenliste (CSV)"
   - Search for your station and note the stop ID (e.g., `de:09162:6`)

4. Add the configuration to your `config.js` (see below)

## Configuration

Add the module to your `config.js`:

```js
{
    module: "MMM-MVG",
    position: "bottom_left",
    header: "Marienplatz",
    config: {
        stopId: "de:09162:6",           // Your stop ID (required)
        maxEntries: 5,                   // Number of departures to show
        walkingTime: 5,                  // Minutes to walk to the station
        showDelay: true,                 // Show delay indicators
        lineFilter: [],                  // Filter by line (e.g., ["U3", "U6"])
        destinationFilter: [],           // Filter by destination keywords
        destinationStopId: null          // Optional: destination for arrival times
    }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stopId` | String | `"de:09162:6"` | **Required.** The MVV stop ID for your station |
| `maxEntries` | Number | `5` | Maximum number of departures to display |
| `walkingTime` | Number | `0` | Minutes needed to walk to the station. When set, shows "Leave" column with countdown |
| `showDelay` | Boolean | `true` | Show delay indicators (+2, -1, etc.) next to departure times |
| `lineFilter` | Array | `[]` | Filter to specific lines (e.g., `["U3", "S8"]`). Empty = all lines |
| `destinationFilter` | Array | `[]` | Filter by destination keywords (e.g., `["Garching"]`). Empty = all destinations |
| `destinationStopId` | String | `null` | If set, shows estimated arrival time at this destination station |

### Example: Commuter Setup

Show only relevant trains for your daily commute with walking time:

```js
{
    module: "MMM-MVG",
    position: "bottom_left",
    header: "To Work",
    config: {
        stopId: "de:09162:6",
        maxEntries: 4,
        walkingTime: 7,
        lineFilter: ["U6"],
        destinationFilter: ["Garching"],
        destinationStopId: "de:09184:460"
    }
}
```

### Example: Multiple Stations

You can run multiple instances for different stations:

```js
{
    module: "MMM-MVG",
    position: "bottom_left",
    header: "U-Bahn",
    config: {
        stopId: "de:09162:6",
        lineFilter: ["U3", "U6"]
    }
},
{
    module: "MMM-MVG",
    position: "bottom_left",
    header: "S-Bahn",
    config: {
        stopId: "de:09162:1",
        lineFilter: ["S1", "S8"]
    }
}
```

## Display Columns

| Column | Description |
|--------|-------------|
| Icon | Transport type icon (U-Bahn, S-Bahn, Tram, Bus) |
| Line | Line number (e.g., U6, S8, 100) |
| Destination | Final destination of the train |
| Departure | Actual departure time with delay indicator |
| Arrival | Estimated arrival at destination (if configured) |
| Leave | Time you need to leave home (if walkingTime > 0) |
| Countdown | Minutes until you need to leave / train departs |

### Color Indicators

- **Red (+X)** - Train is running late by X minutes
- **Green (-X)** - Train is running early by X minutes
- **Orange countdown** - Less than 3 minutes to leave
- **Red "Now"** - Leave immediately to catch the train

## Project Structure

```
MMM-MVG/
├── MMM-MVG.js          # Main module logic
├── MMM-MVG.css         # Styling
├── node_helper.js      # API fetching with queue system
├── package.json        # Module metadata
├── assets/             # Transport type icons
│   ├── ubahn.svg
│   ├── sbahn.svg
│   ├── tram.svg
│   └── bus.svg
└── README.md           # This file
```

## How It Works

1. **Data Fetching** - Uses the MVV departureFinder API to get real-time departures
2. **Queue System** - Prevents API rate limiting when running multiple instances
3. **Delay Calculation** - Compares planned vs actual departure times
4. **Arrival Enrichment** - Optionally queries trip planner API for destination arrival times
5. **Smart Filtering** - Shows only departures you can still catch based on walking time

## Improvements Over Original

This fork adds several enhancements over the original [MMM-MVVWiesty](https://github.com/wiesty/MMM-MVVWiesty):

- **Walking time countdown** - See when to leave, not just when trains depart
- **Delay indicators** - Visual +/- minute indicators with color coding
- **Destination arrival times** - Know when you'll arrive at work
- **Line & destination filtering** - Show only relevant trains
- **Multi-instance queue** - Prevents API rate limiting with multiple stations
- **Staggered startup** - Avoids simultaneous API requests on load
- **Cleaner UI** - Refined table layout with better column alignment

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**Original module by [wiesty](https://github.com/wiesty) • Enhanced with ❤️ for the MagicMirror community**
