const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { buildManifest } = require('./scripts/manifest');

/**
 * Build for one browser:  webpack --env browser=chrome|firefox
 * Output goes to dist/<browser>/ (Chrome is the default).
 */
module.exports = (env = {}) => {
  const browser = env.browser === 'firefox' ? 'firefox' : 'chrome';

  return {
    entry: {
      background: './src/background/service-worker.ts',
      content: './src/content/content.tsx',
      popup: './src/popup/index.tsx',
      settings: './src/settings/index.tsx',
    },
    output: {
      path: path.resolve(__dirname, 'dist', browser),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    plugins: [
      // Lets browser-only code be compiled out of the other browser's bundle
      new webpack.DefinePlugin({ __BROWSER__: JSON.stringify(browser) }),
      new HtmlWebpackPlugin({
        template: './src/popup/index.html',
        filename: 'popup.html',
        chunks: ['popup'],
      }),
      new HtmlWebpackPlugin({
        template: './src/settings/index.html',
        filename: 'settings.html',
        chunks: ['settings'],
      }),
      new CopyPlugin({
        patterns: [
          {
            from: 'manifest.json',
            to: 'manifest.json',
            transform: (content) => buildManifest(content.toString(), browser),
          },
          { from: 'public/icons', to: 'icons' },
        ],
      }),
    ],
  };
};
