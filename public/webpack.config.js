const fs = require('fs');
const path = require('path');

let webodmRoot = path.resolve(__dirname, "../../WebODM");
if (!fs.existsSync(path.join(webodmRoot, "webodm.sh"))){
  webodmRoot = path.resolve(__dirname, "../../../WebODM");
}
if (!fs.existsSync(path.join(webodmRoot, "webodm.sh"))){
  webodmRoot = path.resolve(__dirname, "../../../");
}
if (!fs.existsSync(path.join(webodmRoot, "webodm.sh"))){
  throw new Error("Cannot find WebODM root (webodm.sh). Set webodmRoot in webpack.config.js.");
}
process.env.NODE_PATH = path.join(webodmRoot, "node_modules");
require("module").Module._initPaths();

const MiniCssExtractPlugin = require(path.join(webodmRoot, "node_modules/mini-css-extract-plugin"));

module.exports = {
  mode: 'production',
  context: __dirname,

  entry: {"AltitudeFilterPanel": ["./AltitudeFilterPanel.jsx"]},

  output: {
    path: path.join(__dirname, './build'),
    filename: "[name].js",
    // Named AMD, empty deps array — SystemJS must not fetch React/PropTypes as /plugins/* URLs
    library: {
      type: 'amd',
      name: '[name]'
    }
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css"
    })
  ],

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          {
            loader: path.join(webodmRoot, 'node_modules/babel-loader'),
            options: {
              plugins: [
                 '@babel/syntax-class-properties',
                 '@babel/proposal-class-properties'
              ],
              presets: [
                '@babel/preset-env',
                '@babel/preset-react'
              ]
            }
          }
        ],
      },
      {
        test: /\.s?css$/,
        use: [
          MiniCssExtractPlugin.loader,
          path.join(webodmRoot, 'node_modules/css-loader'),
          path.join(webodmRoot, 'node_modules/sass-loader')
        ]
      }
    ]
  },

  resolve: {
    modules: [path.join(webodmRoot, 'node_modules'), 'node_modules', 'bower_components'],
    extensions: ['.js', '.jsx'],
    alias: {
        webodm: path.join(webodmRoot, 'app/static/app/js')
    }
  },

  resolveLoader: {
    modules: [path.join(webodmRoot, 'node_modules')]
  },

  // Use globals already on the page (WebODM main bundle). Do not use externalsType
  // 'amd' — that makes SystemJS fetch /plugins/React and /plugins/PropTypes (404).
  externalsType: 'var',
  externals: {
    "jquery": "jQuery",
    "SystemJS": "SystemJS",
    "PluginsAPI": "PluginsAPI",
    "react-dom": "ReactDOM",
    "react": "React"
  },

  watchOptions: {
    ignored: ['node_modules', './**/*.py'],
    aggregateTimeout: 300,
    poll: 1000
  }
};
