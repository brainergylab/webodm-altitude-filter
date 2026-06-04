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

1. Enable the plugin (see above).
2. Open a project and start **New Task**.
3. Add images (drag-and-drop or file picker).
4. After EXIF is read, an **Altitude** row appears with a histogram and sliders.
5. Adjust the range; the summary shows how many images will be uploaded vs excluded.
6. Start processing — excluded files are removed from the upload queue before transfer.

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
