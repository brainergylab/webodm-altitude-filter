const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const fs = require('fs');

// Try to find WebODM root relative to this plugin's location
let webodmRoot = path.resolve(__dirname, '../../WebODM');
if (!fs.existsSync(webodmRoot)) {
    // Fallback if symlinked into WebODM/app/media/plugins/<name>/public
    webodmRoot = path.resolve(__dirname, '../../../../');
}
if (!fs.existsSync(webodmRoot)) {
    // Fallback if symlinked into WebODM/coreplugins/<name>/public
    webodmRoot = path.resolve(__dirname, '../../../');
}

module.exports = {
  entry: './AltitudeFilterPanel.jsx',
  output: {
    filename: 'AltitudeFilterPanel.js',
    path: path.resolve(__dirname, 'build'),
    library: {
      type: 'window',
      name: 'AltitudeFilterPanel'
    },
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.(css|scss)$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader'
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      'webodm': path.resolve(webodmRoot, 'app/static/app/js')
    }
  },
  externalsType: 'var',
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM',
    'jquery': 'jQuery',
    'PluginsAPI': 'PluginsAPI'
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'AltitudeFilterPanel.css'
    })
  ]
};
