from app.plugins import PluginBase


class Plugin(PluginBase):
    def include_js_files(self):
        # Panel first (sets window.AltitudeFilterPanel), then main.js registers it
        return ['build/AltitudeFilterPanel.js', 'main.js']

    def include_css_files(self):
        return ['build/AltitudeFilterPanel.css']

    def build_jsx_components(self):
        return ['AltitudeFilterPanel.jsx']
