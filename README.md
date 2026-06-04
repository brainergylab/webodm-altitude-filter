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

The plugin directory name must be `altitude-filter` (matching `manifest.json` / Python module path).

### Option 1: Load plugin ZIP (recommended)

1. Zip the `altitude-filter` folder so the archive root contains that folder (same layout as [WebODM’s test plugin fixture](https://github.com/OpenDroneMap/WebODM/tree/master/app/fixtures)).
2. In WebODM, go to **Administration → Plugins**.
3. Click **Load Plugin (.zip)** and upload the archive.
4. Enable **Altitude Filter** in the plugin list.

Prebuilt assets are in `altitude-filter/public/build/` so you do not need to run webpack before zipping.

### Option 2: Symlink into WebODM `coreplugins`

```bash
ln -s "$(pwd)/altitude-filter" /path/to/WebODM/coreplugins/altitude-filter
```

Restart WebODM (or let it rescan plugins). Enable the plugin under **Administration → Plugins**.

### Option 3: Persistent plugins directory

Copy or symlink into WebODM’s media plugins path (typically `app/media/plugins/altitude-filter` inside your WebODM data volume). See [WebODM plugin paths](https://github.com/OpenDroneMap/WebODM/tree/master/app/plugins).

## Usage

1. Enable the plugin (see above).
2. Open a project and start **New Task**.
3. Add images (drag-and-drop or file picker).
4. After EXIF is read, an **Altitude** row appears with a histogram and sliders.
5. Adjust the range; the summary shows how many images will be uploaded vs excluded.
6. Start processing — excluded files are removed from the upload queue before transfer.

## Development

From `altitude-filter/public/`:

```bash
npm install
npx webpack --config webpack.config.js
```

`webpack.config.js` looks for a WebODM root containing `webodm.sh` (sibling `WebODM/`, `../../../WebODM`, etc.). Adjust `webodmRoot` if your layout differs.

WebODM can also build JSX plugins on startup when `build_jsx_components()` is set in `plugin.py` and `public/package.json` exists.

### Layout

```
altitude-filter/
├── __init__.py
├── manifest.json
├── plugin.py              # PluginBase: main.js + AltitudeFilterPanel.jsx
└── public/
    ├── main.js            # Dashboard panel + Dropzone upload hook
    ├── AltitudeFilterPanel.jsx
    ├── AltitudeFilterPanel.scss
    ├── webpack.config.js
    ├── package.json
    └── build/             # Compiled JS/CSS (ship with releases)
```

## License

[GNU Affero General Public License v3.0](LICENSE) — same family as WebODM.
