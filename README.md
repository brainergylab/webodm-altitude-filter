# WebODM Altitude Filter Plugin

A WebODM plugin that filters drone images by GPS altitude before upload.

## Installation

### Method 1: Download ZIP (Recommended)
1. Download the ZIP file of this repository.
2. In WebODM, go to **Administration** -> **Plugins**.
3. Click **Load Plugin** and select the downloaded ZIP file.

### Method 2: Symlink / Media Plugins
For development, you can symlink this repository into your WebODM `app/media/plugins` or `coreplugins` directory:
```bash
ln -s /path/to/webodm-altitude-filter /path/to/WebODM/app/media/plugins/altitude-filter
```

## Usage
1. Enable the plugin in Administration -> Plugins.
2. Open a project and click "Select Images and GCP" to add images.
3. In the task options panel, an "Altitude" row will appear below "Resize Images".
4. If images have GPS altitude data, a histogram and sliders will appear.
5. Drag the sliders to set the minimum and maximum altitude bounds. Images outside this range will be excluded from the upload.
6. The Map Preview will update automatically to show only the included images.
7. Click "Start Processing". Excluded images will be safely removed from the upload queue.
Note: Radiometric calibration panel images (when "camera+panel" option is selected) are always included regardless of the altitude filter.

## Development Build
The plugin comes with pre-built assets, but if you modify the React components (`public/AltitudeFilterPanel.jsx`) or styles (`public/AltitudeFilterPanel.scss`), you must rebuild them:
```bash
cd public
npm install
npx webpack --config webpack.config.js
```

## Troubleshooting
- **404 Errors on Assets**: If you update the plugin but see 404 errors for `main.js` or `build/AltitudeFilterPanel.js` in the browser console, it is likely due to Cloudflare or reverse-proxy caching. Perform a hard refresh (Ctrl+F5 or Cmd+Shift+R) or temporarily bypass the cache.
- **Histogram Not Appearing**: The histogram requires at least 2 non-panel images with valid GPS altitude EXIF data. Images without altitude data are always uploaded but not filtered.
