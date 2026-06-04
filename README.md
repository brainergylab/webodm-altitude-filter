# Altitude Filter — WebODM Plugin

Filter drone images by GPS altitude before processing. When you create a new task and add images, the plugin reads EXIF GPS altitude, shows an interactive histogram with min/max sliders, and excludes images outside the selected range when upload starts.

Compatible with [WebODM](https://github.com/OpenDroneMap/WebODM) **2.9.4** and later.

## Features

- Histogram of GPS altitudes across selected images
- Drag sliders to set min/max altitude range
- Images without altitude metadata are always included
- Warns if no images remain in range before processing starts
- Integrates with the standard **New Task** upload panel via `PluginsAPI.Dashboard.addNewTaskPanelItem`

## Requirements

- WebODM 2.9.4+
- For development rebuilds: Node.js/npm and a local WebODM checkout (webpack resolves `webodm` imports from WebODM’s `app/static/app/js`)

## Installation

### Option 1: GitHub ZIP → WebODM upload (recommended)

1. Download this repository as a ZIP from GitHub (**Code → Download ZIP**).
2. In WebODM, go to **Administration → Plugins**.
3. Click **Load Plugin (.zip)** and upload that file unchanged.

WebODM requires the archive to contain **exactly one** top-level folder with `manifest.json`, `plugin.py`, and `__init__.py` at its root — which matches the GitHub ZIP layout.

4. Enable **Altitude Filter** in the plugin list.

Prebuilt assets are in `public/build/`; you do not need to run webpack before uploading.

### Option 2: Symlink into WebODM `coreplugins`

Use a folder name without spaces (e.g. `altitude-filter`):

```bash
ln -s "$(pwd)" /path/to/WebODM/coreplugins/altitude-filter
```

Restart WebODM if needed, then enable the plugin under **Administration → Plugins**.

### Option 3: Copy into WebODM media plugins

Copy this directory into WebODM’s persistent plugins path (typically `app/media/plugins/<folder-name>/` inside your WebODM data volume).

## Usage

1. Enable the plugin under **Administration → Plugins** (it does nothing if disabled).
2. Open a project and click **Select Images and GCP**, then choose your images.
3. After files are added, the **New Task** options panel opens. Wait a moment for processing options to load.
4. Scroll to the **Resize Images** section — the **Altitude** row appears **directly below** it (this is where WebODM renders upload plugins).
5. After EXIF is read, you should see either a histogram with sliders or a short message (e.g. missing GPS altitude).
6. Adjust the range, then click **Review** → **Start Processing**. Excluded images are removed from the upload queue before transfer.

**Requirements for the histogram:** at least **two** images with **GPS altitude** in EXIF. Images without altitude are always kept. If you only see a text message, your images may lack GPS altitude metadata (common with some cameras or stripped EXIF).

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Console: `define is not a function` when loading `AltitudeFilterPanel.js` | Rebuild `public/build/` with the repo’s `webpack.config.js` (named AMD output). Do not use anonymous `define(() => …)` bundles from older webpack settings. |
| No **Altitude** row at all | Enable the plugin, hard-refresh the page, confirm `main.js` loads under `/plugins/<folder>/main.js`. |
| Message instead of histogram | Need ≥2 images with GPS altitude in EXIF. |

## Development

From `public/`:

```bash
npm install
npx webpack --config webpack.config.js
```

`webpack.config.js` looks for a WebODM root containing `webodm.sh` (`../../WebODM`, `../../../WebODM`, etc.). Adjust paths if your layout differs.

WebODM can also build JSX plugins on startup when `build_jsx_components()` is set in `plugin.py` and `public/package.json` exists.

### Layout

```
├── __init__.py            # exports Plugin from plugin.py (required for upload installs)
├── manifest.json
├── plugin.py
├── LICENSE
├── README.md
└── public/
    ├── main.js
    ├── AltitudeFilterPanel.jsx
    ├── AltitudeFilterPanel.scss
    ├── webpack.config.js
    ├── package.json
    └── build/             # Compiled JS/CSS (ship with releases)
```

## License

[GNU Affero General Public License v3.0](LICENSE) — same family as WebODM.
