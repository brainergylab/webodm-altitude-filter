(function(){
  function getPluginPrefix(){
    const script = document.currentScript;
    if (script && script.src){
      const m = script.src.match(/\/plugins\/([^/]+)\/main\.js(?:\?|#|$)/);
      if (m) return m[1] + '/';
    }
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--){
      const m = (scripts[i].src || '').match(/\/plugins\/([^/]+)\/main\.js(?:\?|#|$)/);
      if (m) return m[1] + '/';
    }
    return '';
  }

  const prefix = getPluginPrefix();
  if (!prefix){
    console.error('[Altitude Filter] Could not detect plugin install path from main.js URL. The altitude panel will not load.');
    return;
  }

  // CSS is loaded via plugin.py include_css_files() (<link> in page head).
  // Do not load .css through SystemJS — it often 404s or fails for uploaded plugins.
  PluginsAPI.Dashboard.addNewTaskPanelItem([
    prefix + 'build/AltitudeFilterPanel.js'
  ], function(args, AltitudeFilterPanel){
    return AltitudeFilterPanel;
  });
})();

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

  window.AltitudeFilter = { applyBeforeUpload };
})();
