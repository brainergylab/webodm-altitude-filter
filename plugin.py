from app.plugins import PluginBase

class Plugin(PluginBase):
    def include_js_files(self):
        return ['build/AltitudeFilterPanel.js', 'main.js']

    def include_css_files(self):
        return ['build/AltitudeFilterPanel.css']
