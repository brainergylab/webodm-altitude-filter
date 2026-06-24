import React from 'react';
import ReactDOM from 'react-dom';
import $ from 'jquery';
import './AltitudeFilterPanel.scss';
import exifr from 'webodm/vendor/exifr';
import Histogram from 'webodm/components/Histogram';

export default class AltitudeFilterPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      error: null,
      min: 0,
      max: 0,
      statistics: null,
      includedCount: 0,
      excludedCount: 0,
      panelCount: 0,
      totalCount: 0,
      needsExifParse: true,
    };
    
    this.parsedFiles = new Map(); // file.name -> metadata object
    this.dzOriginalProcessQueue = null;
    this.dzInstance = null;
    this.projectListItemInstance = null;
    this.newTaskPanelInstance = null;
    this.isParsing = false;
  }

  componentDidMount() {
    this.findReactInstances();
    this.hookDropzone();
    this.parseFilesIfNecessary();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.filesCount !== this.props.filesCount) {
      // Re-parse when new files are added
      this.setState({ needsExifParse: true }, () => this.parseFilesIfNecessary());
    } else if (
      this.props.taskInfo && prevProps.taskInfo && 
      this.props.taskInfo.options && prevProps.taskInfo.options &&
      this.props.taskInfo.options['radiometric-calibration'] !== prevProps.taskInfo.options['radiometric-calibration']
    ) {
      // Re-calculate counts when radiometric-calibration changes
      this.updateCountsAndMap();
    }
  }

  componentWillUnmount() {
    if (this.updateTimeout) clearTimeout(this.updateTimeout);
    if (this.hookTimeout) clearTimeout(this.hookTimeout);
    
    // We intentionally DO NOT restore this.dzInstance.processQueue here!
    // WebODM sets editing:false (unmounting this component) BEFORE the AJAX
    // request finishes and calls processQueue. If we restore it, we lose the hook!
  }

  findReactInstances() {
    const domNode = ReactDOM.findDOMNode(this);
    if (!domNode) return;

    // Helper to find fiber
    const getFiber = (node) => {
      const key = Object.keys(node).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      return key ? node[key] : null;
    };

    let fiber = getFiber(domNode);
    let parent = fiber ? fiber.return : null;
    
    while (parent) {
      const stateNode = parent.stateNode;
      if (stateNode) {
        if (stateNode.setUploadState && !this.projectListItemInstance) {
          this.projectListItemInstance = stateNode;
        }
        if (stateNode.mapPreview !== undefined && stateNode.taskForm !== undefined && !this.newTaskPanelInstance) {
          this.newTaskPanelInstance = stateNode;
        }
      }
      parent = parent.return;
    }
  }

  hookDropzone() {
    if (!this.projectListItemInstance) {
      this.findReactInstances();
    }
    
    if (this.projectListItemInstance && this.projectListItemInstance.dz) {
      const dz = this.projectListItemInstance.dz;
      if (dz._altitudeFilterHooked) return;

      const origProcessQueue = dz.processQueue;
      dz._altitudeFilterHooked = true;
      
      const projectId = this.props.projectId || this.projectListItemInstance.state?.data?.id;
      
      dz.processQueue = function() {
        if (this.options.autoProcessQueue === false && this._taskInfo && this._taskInfo.id) {
          // Task has been created and we are about to upload files
          if (window.AltitudeFilterApplyBeforeUpload && window.AltitudeFilterAbortUpload) {
            if (!window.AltitudeFilterApplyBeforeUpload(this, projectId)) {
              window.AltitudeFilterAbortUpload(this);
              return;
            }
          }
        }
        return origProcessQueue.apply(this, arguments);
      };
      return;
    }

    // If dz is not yet initialized (due to React bottom-up mounting), retry shortly
    if (!this.hookTimeout) {
      this.hookTimeout = setTimeout(() => {
        this.hookTimeout = null;
        this.hookDropzone();
      }, 100);
    }
  }

  isFileIncluded(file) {
    if (file.type && file.type.indexOf("image") !== 0) return true; // Keep non-images
    
    const parsed = this.parsedFiles.get(file.name);
    if (!parsed) return true; // Keep unparsed images
    
    if (parsed.isPanel) return true; // Always keep panel/calibration images

    if (parsed.altitude === null || parsed.altitude === undefined) return true; // Keep images without altitude

    // Apply bounds filter
    return parsed.altitude >= this.state.min && parsed.altitude <= this.state.max;
  }

  isRadiometricCalibrationEnabled() {
    if (!this.props.taskInfo || !this.props.taskInfo.options) return false;
    return this.props.taskInfo.options['radiometric-calibration'] === 'camera+panel';
  }

  async parseFilesIfNecessary() {
    if (!this.state.needsExifParse || this.isParsing) return;
    this.isParsing = true;
    this.setState({ loading: true, error: null });

    try {
      let files = this.props.getFiles ? this.props.getFiles() : [];
      if (files && !Array.isArray(files)) files = Array.from(files);
      const imageFiles = files.filter(f => f.type && f.type.indexOf("image") === 0);
      
      // Limit concurrent parsing
      const limit = 8;
      let active = 0;
      let index = 0;
      
      const processNext = async () => {
        if (index >= imageFiles.length) return;
        const file = imageFiles[index++];
        active++;
        
        if (!this.parsedFiles.has(file.name)) {
          const metadata = await this.parseSingleFile(file);
          this.parsedFiles.set(file.name, metadata);
        }
        
        active--;
        if (index < imageFiles.length) {
          await processNext();
        }
      };
      
      const workers = [];
      for (let i = 0; i < limit; i++) {
        workers.push(processNext());
      }
      await Promise.all(workers);
      
      this.buildHistogramData();
    } catch (e) {
      console.error(e);
      this.setState({ error: "Failed to parse EXIF data." });
    } finally {
      this.isParsing = false;
      this.setState({ loading: false, needsExifParse: false });
    }
  }

  async parseSingleFile(file) {
    let metadata = { altitude: null, isPanel: false, hasExif: false };
    
    // First, try fast regex on first 256KB for XMP tags
    try {
        const sliceStart = file.slice(0, 256 * 1024);
        const sliceEnd = file.size > 256 * 1024 ? file.slice(file.size - 256 * 1024) : new Blob([]);

        const readSlice = (s) => new Promise(resolve => {
          if (s.size === 0) return resolve("");
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = () => resolve("");
          reader.readAsText(s);
        });

        const [textStart, textEnd] = await Promise.all([readSlice(sliceStart), readSlice(sliceEnd)]);
        const text = textStart + " " + textEnd;
        
        if (text) {
          const relAltMatch = text.match(/drone-dji:RelativeAltitude=["']?([+-]?\d+\.?\d*)/i) || 
                              text.match(/<drone-dji:RelativeAltitude>([+-]?\d+\.?\d*)<\/drone-dji:RelativeAltitude>/i);
          if (relAltMatch) metadata.altitude = parseFloat(relAltMatch[1]);
          
          const calPicMatch = text.match(/Camera:CalibrationPicture=["']?(\d+)/i) || 
                              text.match(/<Camera:CalibrationPicture>(\d+)<\/Camera:CalibrationPicture>/i);
          const hasPanelSerial = /Camera:PanelSerial/i.test(text);
          
          if ((calPicMatch && parseInt(calPicMatch[1], 10) === 2) || hasPanelSerial) {
            metadata.isPanel = true;
          }
        }
      } catch (e) {
        console.warn("Fast XMP parse failed", e);
      }

      // If the fast text regex successfully got everything we needed, skip exifr completely!
      if (metadata.altitude !== null || metadata.isPanel) {
        metadata.hasExif = true;
        return metadata;
      }

      // Next, run exifr fallback for standard GPS IFD tags
      try {
        const exif = await exifr.parse(file, {
          gps: true,
          xmp: true,
          makerNote: true,
          ifd0: true,
          ifd1: false,
          interop: false
        });

      if (exif) {
        metadata.hasExif = true;

        if (metadata.altitude === null) {
          const getProp = (obj, keys) => {
            for (let k of keys) {
              if (obj[k] !== undefined && obj[k] !== null) return obj[k];
            }
            for (let prop in obj) {
              if (typeof obj[prop] === 'object' && obj[prop] !== null) {
                for (let k of keys) {
                  if (obj[prop][k] !== undefined && obj[prop][k] !== null) return obj[prop][k];
                }
              }
            }
            return null;
          };

          // Try GPSAltitude first
          let gpsAlt = getProp(exif, ['GPSAltitude', 'gpsAltitude', 'altitude']);
          if (gpsAlt !== null) {
            let ref = getProp(exif, ['GPSAltitudeRef', 'gpsAltitudeRef']);
            if (ref === 1 || ref === '\u0001') gpsAlt = -Math.abs(gpsAlt);
            metadata.altitude = gpsAlt;
          } else {
            let relAlt = getProp(exif, ['RelativeAltitude', 'relativeAltitude', 'drone-dji:RelativeAltitude', 'SensorRelativeAltitude']);
            if (relAlt !== null) metadata.altitude = parseFloat(relAlt);
          }
        }
        
        if (!metadata.isPanel) {
          const getProp = (obj, keys) => { /* Same as above */
            for (let k of keys) {
              if (obj[k] !== undefined && obj[k] !== null) return obj[k];
            }
            for (let prop in obj) {
              if (typeof obj[prop] === 'object' && obj[prop] !== null) {
                for (let k of keys) {
                  if (obj[prop][k] !== undefined && obj[prop][k] !== null) return obj[prop][k];
                }
              }
            }
            return null;
          };
          
          let calPic = getProp(exif, ['CalibrationPicture', 'calibrationPicture', 'Camera:CalibrationPicture']);
          let serial = getProp(exif, ['PanelSerial', 'panelSerial', 'Camera:PanelSerial']);
          
          if ((calPic !== null && parseInt(calPic, 10) === 2) || (serial !== null && serial.toString().trim() !== "")) {
            metadata.isPanel = true;
          }
        }
      }
    } catch (e) {
      // Exifr can fail for invalid images
    }

    return metadata;
  }

  buildHistogramData() {
    let altitudes = [];
    for (let metadata of this.parsedFiles.values()) {
      if (metadata.altitude !== null && !metadata.isPanel) {
        altitudes.push(metadata.altitude);
      }
    }

    if (altitudes.length < 2) {
      this.setState({ statistics: null });
      this.updateCountsAndMap();
      return;
    }

    let min = Math.min(...altitudes);
    let max = Math.max(...altitudes);
    
    // Add 10% padding to bounds initially
    let padding = (max - min) * 0.1;
    if (padding === 0) padding = 1.0;
    
    let histMin = min - padding;
    let histMax = max + padding;
    
    const binCount = 100;
    const counts = Array(binCount).fill(0);
    const bins = [];
    let step = (histMax - histMin) / binCount;
    if (step <= 0) step = 1;
    
    for (let i = 0; i < binCount; i++) {
      bins.push(histMin + i * step);
    }
    
    altitudes.forEach(alt => {
      let binIdx = Math.floor((alt - histMin) / step);
      if (binIdx >= binCount) binIdx = binCount - 1;
      if (binIdx < 0) binIdx = 0;
      counts[binIdx]++;
    });

    const statistics = {
      'altitude': {
        min: histMin,
        max: histMax,
        histogram: [counts, bins]
      }
    };

    this.setState({ 
      statistics, 
      min: histMin, 
      max: histMax 
    }, () => {
      this.updateCountsAndMap();
    });
  }

  handleUpdate = ({ min, max }) => {
    this.setState({ min, max });
    
    if (this.updateTimeout) clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      this.updateCountsAndMap();
    }, 400);
  }

  updateCountsAndMap() {
    let files = this.props.getFiles ? this.props.getFiles() : [];
    if (files && !Array.isArray(files)) files = Array.from(files);
    
    let includedCount = 0;
    let excludedCount = 0;
    let panelCount = 0;
    const includedFileNames = new Set();
    
    const excludedFileNames = new Set();
    
    files.forEach(file => {
      if (file.type && file.type.indexOf("image") !== 0) {
        includedCount++;
        includedFileNames.add(file.name);
        return;
      }
      
      const parsed = this.parsedFiles.get(file.name);
      const isPanel = parsed && parsed.isPanel;
      if (isPanel) panelCount++;
      
      if (this.isFileIncluded(file)) {
        includedCount++;
        includedFileNames.add(file.name);
      } else {
        excludedCount++;
        excludedFileNames.add(file.name);
      }
    });

    const projectId = this.props.projectId || this.projectListItemInstance?.state?.data?.id;
    if (projectId) {
      if (!window.AltitudeFilterExcludedFiles) window.AltitudeFilterExcludedFiles = {};
      window.AltitudeFilterExcludedFiles[projectId] = excludedFileNames;
    } else {
      window.AltitudeFilterExcludedFiles = excludedFileNames;
    }

    this.setState({
      includedCount,
      excludedCount,
      panelCount,
      totalCount: files.length
    });

    // Sync MapPreview
    if (this.newTaskPanelInstance && this.newTaskPanelInstance.mapPreview) {
      this.syncMapPreview(this.newTaskPanelInstance.mapPreview, includedFileNames);
    }
  }

  syncMapPreview(mapPreview, includedFileNames) {
    if (!window.L || !mapPreview.map || !mapPreview.exifData) return;
    
    if (mapPreview.imagesGroup) {
      mapPreview.map.removeLayer(mapPreview.imagesGroup);
      mapPreview.imagesGroup = null;
    }
    if (mapPreview.capturePath) {
      mapPreview.map.removeLayer(mapPreview.capturePath);
      mapPreview.capturePath = null;
    }
    
    const filteredExif = mapPreview.exifData.filter(exif => includedFileNames.has(exif.image.name));
    
    let images = mapPreview.sampled(filteredExif, mapPreview.MaxImagesPlot).map(exif => {
      let layer = window.L.circleMarker([exif.gps.latitude, exif.gps.longitude], {
        radius: 8,
        fillOpacity: 1,
        color: "#fcfcff",
        fillColor: "#4b96f3",
        weight: 1.5,
      }).bindPopup(exif.image.name);
      layer.feature = layer.feature || {};
      layer.feature.type = "Feature";
      layer.feature.properties = layer.feature.properties || {};
      layer.feature.properties["Filename"] = exif.image.name;
      if (mapPreview.hasTimestamp) layer.feature.properties["Timestamp"] = exif.timestamp;
      return layer;
    });
    
    if (mapPreview.hasTimestamp) {
      let coords = filteredExif.map(exif => [exif.gps.latitude, exif.gps.longitude]);
      mapPreview.capturePath = window.L.polyline(coords, {
        color: "#4b96f3",
        weight: 3
      });
      mapPreview.capturePath.addTo(mapPreview.map);
    }
    
    if (images.length > 0) {
      mapPreview.imagesGroup = window.L.featureGroup(images).addTo(mapPreview.map);
      mapPreview.map.fitBounds(mapPreview.imagesGroup.getBounds());
    }
    
    if (typeof mapPreview.props.onImagesBboxChanged === 'function') {
      mapPreview.props.onImagesBboxChanged(mapPreview.computeBbox(filteredExif));
    }
  }

  render() {
    return (
      <div className="form-group">
        <label className="col-sm-2 control-label">Altitude Filter</label>
        <div className="col-sm-10">
          <div className="altitude-filter-panel">
            <div className="filter-summary">
              {this.state.includedCount} of {this.state.totalCount} files will be uploaded ({this.state.excludedCount} excluded).
              {this.state.panelCount > 0 && (
                <div style={{ color: '#28a745', fontWeight: 'bold' }}>
                  {this.state.panelCount} calibration panel image(s) found and excluded from the filter.
                </div>
              )}
            </div>
            
            {this.state.loading && (
              <div className="text-muted"><i className="fa fa-spinner fa-spin"></i> Parsing altitudes...</div>
            )}
            
            {this.state.error && (
              <div className="text-danger"><i className="fa fa-exclamation-triangle"></i> {this.state.error}</div>
            )}
            
            {!this.state.loading && !this.state.error && !this.state.statistics && (
              <div className="text-muted">Not enough images with GPS altitude to display filter (minimum 2 non-panel images).</div>
            )}

            {this.state.statistics && (
              <div className="histogram-wrapper">
                <Histogram
                  statistics={this.state.statistics}
                  min={this.state.min}
                  max={this.state.max}
                  onUpdate={this.handleUpdate}
                  unitForward={v => v}
                  unitBackward={v => v}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
