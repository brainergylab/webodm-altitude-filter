(function() {
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
    if (!window.AltitudeFilterExcludedFiles) return true;
    
    const excluded = dz.files.filter(f => window.AltitudeFilterExcludedFiles.has(f.name));
    if (!excluded.length) return true;

    const imagesAfter = dz.files.filter(f => {
      const isImg = (f.type && f.type.indexOf('image') === 0) || /\.(jpe?g|png|tif{1,2}|dng|nef|raw)$/i.test(f.name);
      return isImg && !window.AltitudeFilterExcludedFiles.has(f.name);
    });

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

  window.AltitudeFilterApplyBeforeUpload = applyBeforeUpload;
  window.AltitudeFilterAbortUpload = abortUpload;

  // Hook Dropzone prototype to intercept the upload queue if it's global
  if (window.Dropzone) {
    const origProcessQueue = window.Dropzone.prototype.processQueue;
    window.Dropzone.prototype.processQueue = function(){
      if (this.options.autoProcessQueue === false && this._taskInfo && this._taskInfo.id){
        if (!applyBeforeUpload(this)){
          abortUpload(this);
          return;
        }
      }
      return origProcessQueue.apply(this, arguments);
    };
  }
})();
