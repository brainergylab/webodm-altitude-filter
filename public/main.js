// Panel bundle is a plain <script> (plugin.py include_js_files), not SystemJS.
// SystemJS fetch often 404s for uploaded plugins even when the same URL works in the browser.
PluginsAPI.Dashboard.addNewTaskPanelItem(function(args){
  const exp = window.AltitudeFilterPanel;
  if (!exp){
    console.error('[Altitude Filter] window.AltitudeFilterPanel is missing. Check that build/AltitudeFilterPanel.js is deployed and listed before main.js in include_js_files().');
    return null;
  }
  return exp.default || exp;
});

(function(){
  if (!window.Dropzone) return;

  function findProjectListItem(dropzoneEl){
    let el = dropzoneEl;
    while (el){
      const key = Object.keys(el).find(k => (
        k.startsWith('__reactFiber$') ||
        k.startsWith('__reactInternalInstance$')
      ));
      if (key){
        let fiber = el[key];
        while (fiber){
          const node = fiber.stateNode;
          if (node && node.dz && node.setUploadState){
            return node;
          }
          fiber = fiber.return;
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  function applyBeforeUpload(dz){
    const excluded = dz.files.filter(f => f._altitudeExcluded);
    if (!excluded.length) return true;

    const imagesAfter = dz.files.filter(f => (
      isImageFile(f) && !f._altitudeExcluded
    ));
    if (imagesAfter.length === 0){
      window.alert("No images fall within the selected altitude range. Adjust the altitude sliders before starting processing.");
      return false;
    }

    excluded.forEach(f => {
      dz.removeFile(f);
    });

    const pli = findProjectListItem(dz.element);
    if (pli){
      const remaining = dz.files.slice();
      const totalBytes = remaining.reduce((sum, f) => sum + f.size, 0);
      pli.setUploadState({
        files: remaining,
        totalCount: remaining.length,
        totalBytes,
        totalBytesSent: 0,
        progress: 0,
        uploadedCount: 0
      });
    }

    return true;
  }

  function abortUpload(dz){
    const pli = findProjectListItem(dz.element);
    if (pli){
      pli.setUploadState({
        uploading: false,
        editing: true,
        error: "No images fall within the selected altitude range. Adjust the altitude sliders."
      });
      if (dz._taskInfo && dz._taskInfo.id !== undefined){
        $.ajax({
          url: `/api/projects/${pli.state.data.id}/tasks/${dz._taskInfo.id}/remove/`,
          type: 'POST',
          contentType: 'application/json',
          dataType: 'json'
        });
        delete dz._taskInfo.id;
      }
    }
  }

  function isImageFile(file){
    if (file.type && file.type.indexOf('image') === 0) return true;
    const name = (file.name || '').toLowerCase();
    return /\.(jpe?g|png|tif{1,2}|dng|nef|raw)$/.test(name);
  }

  const origProcessQueue = Dropzone.prototype.processQueue;
  Dropzone.prototype.processQueue = function(){
    if (this.options.autoProcessQueue === false && this._taskInfo && this._taskInfo.id){
      if (!applyBeforeUpload(this)){
        abortUpload(this);
        return;
      }
    }
    return origProcessQueue.apply(this, arguments);
  };

  function findMapPreview(){
    const dz = window.Dropzone && window.Dropzone.instances &&
      window.Dropzone.instances.find(d => (
        d.options.autoProcessQueue === false && d.files.length > 0
      ));
    if (!dz || !dz.element) return null;

    const stack = [];
    let el = dz.element;
    while (el){
      const key = Object.keys(el).find(k => (
        k.startsWith('__reactFiber$') ||
        k.startsWith('__reactInternalInstance$')
      ));
      if (key) stack.push(el[key]);
      el = el.parentElement;
    }

    while (stack.length){
      const fiber = stack.pop();
      if (!fiber) continue;
      const node = fiber.stateNode;
      if (node && typeof node.loadNewFiles === 'function' && node.map){
        return node;
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    return null;
  }

  function applyMapAltitudeFilter(mapPreview){
    if (!mapPreview || !mapPreview.imagesGroup) return;

    mapPreview.imagesGroup.eachLayer(layer => {
      const name = layer.feature &&
        layer.feature.properties &&
        layer.feature.properties.Filename;
      const file = name && mapPreview.exifData &&
        mapPreview.exifData.find(ed => ed.image && ed.image.name === name);
      if (file && file.image && file.image._altitudeExcluded){
        mapPreview.imagesGroup.removeLayer(layer);
      }
    });

    if (mapPreview.capturePath && mapPreview.hasTimestamp && window.L){
      mapPreview.map.removeLayer(mapPreview.capturePath);
      const included = (mapPreview.exifData || []).filter(ed => (
        ed.image && !ed.image._altitudeExcluded
      ));
      const coords = included.map(ed => [ed.gps.latitude, ed.gps.longitude]);
      mapPreview.capturePath = coords.length > 1 ?
        window.L.polyline(coords, { color: '#4b96f3', weight: 3 }) :
        null;
      if (mapPreview.capturePath) mapPreview.capturePath.addTo(mapPreview.map);
    }

    const layers = mapPreview.imagesGroup.getLayers();
    if (layers.length) mapPreview.map.fitBounds(mapPreview.imagesGroup.getBounds());
  }

  let mapRefreshTimer = null;
  function refreshMapPreview(){
    if (mapRefreshTimer) clearTimeout(mapRefreshTimer);
    mapRefreshTimer = setTimeout(() => {
      mapRefreshTimer = null;
      const mapPreview = findMapPreview();
      if (!mapPreview) return;
      const result = mapPreview.loadNewFiles();
      if (result && typeof result.then === 'function'){
        result.then(() => applyMapAltitudeFilter(mapPreview));
      } else {
        applyMapAltitudeFilter(mapPreview);
      }
    }, 200);
  }

  window.AltitudeFilter = { applyBeforeUpload, refreshMapPreview };
})();
