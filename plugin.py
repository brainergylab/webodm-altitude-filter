from app.plugins import PluginBase


class Plugin(PluginBase):
    def include_js_files(self):
        return ['main.js']

    def include_css_files(self):
        return ['build/AltitudeFilterPanel.css']

    def build_jsx_components(self):
        return ['AltitudeFilterPanel.jsx']
