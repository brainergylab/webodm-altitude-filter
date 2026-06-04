import React from 'react';
import PropTypes from 'prop-types';
import './AltitudeFilterPanel.scss';
import Histogram from 'webodm/components/Histogram';
import exifr from 'webodm/vendor/exifr';
import { _, interpolate } from 'webodm/classes/gettext';

const EXIF_OPTIONS = {
  ifd0: false,
  exif: [0x9003],
  gps: [0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006],
  interop: false,
  ifd1: false
};

function getActiveDropzone(){
  if (!window.Dropzone || !window.Dropzone.instances) return null;
  return window.Dropzone.instances.find(dz => (
    dz.options.autoProcessQueue === false &&
    dz.files.length > 0
  ));
}

function isImageFile(file){
  if (file.type && file.type.indexOf('image') === 0) return true;
  const name = (file.name || '').toLowerCase();
  return /\.(jpe?g|png|tif{1,2}|dng|nef|raw)$/.test(name);
}

function getImageFiles(getFiles){
  const dz = getActiveDropzone();
  const files = (dz && dz.files.length) ? dz.files : (getFiles ? getFiles() : []);
  return Array.from(files).filter(isImageFile);
}

function parseAltitude(exif){
  if (!exif) return null;
  if (exif.GPSAltitude !== undefined && exif.GPSAltitude !== null){
    let altitude = exif.GPSAltitude;
    if (exif.GPSAltitudeRef === 1) altitude = -altitude;
    return altitude;
  }
  if (exif.altitude !== undefined && exif.altitude !== null) return exif.altitude;
  return null;
}

function buildStatistics(altitudes){
  if (!altitudes.length) return null;

  let min = altitudes[0];
  let max = altitudes[0];
  altitudes.forEach(alt => {
    min = Math.min(min, alt);
    max = Math.max(max, alt);
  });

  if (min === max){
    max = min + 1;
  }

  const bins = Math.min(50, Math.max(10, Math.ceil(Math.sqrt(altitudes.length))));
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  const values = [];

  for (let i = 0; i < bins; i++){
    values.push(min + i * step);
  }

  altitudes.forEach(alt => {
    let idx = Math.floor((alt - min) / step);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  });

  return {
    "1": {
      min,
      max,
      histogram: [counts, values]
    }
  };
}

function applyExclusion(imageData, min, max){
  let excluded = 0;
  let included = 0;
  let noAltitude = 0;

  imageData.forEach(entry => {
    const { file, altitude } = entry;
    if (altitude === null){
      file._altitudeExcluded = false;
      noAltitude++;
      included++;
      return;
    }

    const exclude = altitude < min || altitude > max;
    file._altitudeExcluded = exclude;
    if (exclude) excluded++;
    else included++;
  });

  return { excluded, included, noAltitude };
}

export default class AltitudeFilterPanel extends React.Component {
  static propTypes = {
    taskInfo: PropTypes.object,
    getFiles: PropTypes.func.isRequired,
    filesCount: PropTypes.number.isRequired
  };

  constructor(props){
    super(props);

    this.state = {
      loading: true,
      error: "",
      statistics: null,
      imageData: [],
      rangeMin: null,
      rangeMax: null,
      excluded: 0,
      included: 0,
      noAltitude: 0
    };
  }

  componentDidMount(){
    this.loadAltitudes();
  }

  componentDidUpdate(prevProps){
    if (prevProps.filesCount !== this.props.filesCount){
      this.loadAltitudes();
    }
  }

  loadAltitudes = () => {
    const images = getImageFiles(this.props.getFiles);

    if (!images.length){
      this.setState({
        loading: false,
        statistics: null,
        imageData: [],
        error: this.props.filesCount > 0 ?
          _("No image files found in the selection (only images can be filtered by altitude).") :
          ""
      });
      return;
    }

    this.setState({ loading: true, error: "" });
    const imageData = [];
    let pending = images.length;

    const doneOne = () => {
      pending--;
      if (pending === 0) this.finishLoading(imageData);
    };

    images.forEach(file => {
      if (file._altitudeParsed !== undefined){
        imageData.push({ file, altitude: file._altitudeParsed });
        doneOne();
        return;
      }

      exifr.parse(file, EXIF_OPTIONS).then(exif => {
        const altitude = parseAltitude(exif);
        file._altitudeParsed = altitude;
        imageData.push({ file, altitude });
        doneOne();
      }).catch(() => {
        file._altitudeParsed = null;
        imageData.push({ file, altitude: null });
        doneOne();
      });
    });
  };

  finishLoading = imageData => {
    const withAltitude = imageData.filter(e => e.altitude !== null);
    if (withAltitude.length < 2){
      imageData.forEach(e => { e.file._altitudeExcluded = false; });
      this.setState({
        loading: false,
        statistics: null,
        imageData,
        error: withAltitude.length === 0 ?
          _("No GPS altitude found in image EXIF data.") :
          _("At least two images with GPS altitude are required for filtering.")
      });
      return;
    }

    const altitudes = withAltitude.map(e => e.altitude);
    const statistics = buildStatistics(altitudes);
    const band = statistics["1"];
    const rangeMin = band.min;
    const rangeMax = band.max;
    const counts = applyExclusion(imageData, rangeMin, rangeMax);

    this.setState({
      loading: false,
      error: "",
      statistics,
      imageData,
      rangeMin,
      rangeMax,
      ...counts
    });
  };

  handleHistogramUpdate = ({ min, max }) => {
    const counts = applyExclusion(this.state.imageData, min, max);
    this.setState({
      rangeMin: min,
      rangeMax: max,
      ...counts
    });
  };

  render(){
    const { loading, error, statistics, rangeMin, rangeMax, excluded, included, noAltitude, imageData } = this.state;

    if (loading){
      return (
        <div className="altitude-filter-panel">
          <label className="col-sm-2 control-label">{_("Altitude")}</label>
          <div className="col-sm-10">
            <i className="fa fa-circle-notch fa-spin fa-fw"></i> {_("Reading GPS altitude from images…")}
          </div>
        </div>
      );
    }

    if (!statistics){
      return (
        <div className="altitude-filter-panel">
          <label className="col-sm-2 control-label">{_("Altitude")}</label>
          <div className="col-sm-10">
            {error ? (
              <p className="text-muted altitude-filter-warning">{error}</p>
            ) : (
              <p className="text-muted">{_("Add drone images with GPS altitude in EXIF to use the altitude filter.")}</p>
            )}
          </div>
        </div>
      );
    }

    const totalImages = imageData.length;
    const noneIncluded = included === 0;

    return (
      <div className="altitude-filter-panel">
        <label className="col-sm-2 control-label">{_("Altitude")}</label>
        <div className="col-sm-10 panel-body">
          <p className="text-muted">{_("Drag the sliders on the histogram to exclude images outside the altitude range.")}</p>
          {noneIncluded ? (
            <div className="alert alert-warning altitude-filter-warning">
              {_("No images fall within the selected altitude range. Adjust the sliders before starting processing.")}
            </div>
          ) : ""}
          <Histogram
            width={274}
            statistics={statistics}
            min={rangeMin}
            max={rangeMax}
            onUpdate={this.handleHistogramUpdate}
          />
          <div className="altitude-filter-summary">
            {interpolate(_("%(included)s of %(total)s images will be uploaded (%(excluded)s excluded)."), {
              included,
              total: totalImages,
              excluded
            })}
            {noAltitude > 0 ? (
              <span> {" "}
                {interpolate(_("%(count)s without altitude are always included."), { count: noAltitude })}
              </span>
            ) : ""}
          </div>
        </div>
      </div>
    );
  }
}
