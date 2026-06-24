(function() {
  console.log("WebODM Altitude Filter plugin: main.js loaded");

  PluginsAPI.Dashboard.addNewTaskPanelItem(function(args) {
    if (window.AltitudeFilterPanel && window.AltitudeFilterPanel.default) {
      return window.AltitudeFilterPanel.default;
    } else if (window.AltitudeFilterPanel) {
      return window.AltitudeFilterPanel;
    } else {
      console.error("AltitudeFilterPanel not found on window object.");
      return null;
    }
  });
})();
