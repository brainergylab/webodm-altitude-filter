(function(){
  function pluginPrefix(){
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++){
      const m = (scripts[i].src || '').match(/\/plugins\/([^/]+)\/main\.js(?:\?|$)/);
      if (m) return m[1] + '/';
    }
    return '';
  }

  const prefix = pluginPrefix();
  PluginsAPI.Dashboard.addNewTaskPanelItem([
    prefix + 'build/AltitudeFilterPanel.js',
    prefix + 'build/AltitudeFilterPanel.css'
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
      f.type && f.type.indexOf('image') === 0 && !f._altitudeExcluded
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
