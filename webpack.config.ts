import path = require('path');
import webpack = require('webpack');
import HtmlWebpackPlugin = require('html-webpack-plugin');
import MiniCssExtractPlugin = require('mini-css-extract-plugin');
import fs = require('fs');

const WebpackShellPlugin = require('webpack-shell-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');

const _DEV_ = (process.env.NODE_ENV || '').toLowerCase().startsWith('dev');

const PUBLIC_PATH = path.join(__dirname, 'docs');
const WEB_SRC_PATH = path.join(__dirname, 'src/web');

const plugins = [
  new HtmlWebpackPlugin({
    template: path.join(WEB_SRC_PATH, 'index.html'),
    inlineSource: '.(js|css)$',
    filename: 'beta.html'
  }),
  new HtmlWebpackInlineSourcePlugin(),

  // Generate TypeScript types for css modules
  new WebpackShellPlugin({
    onBuildStart: ['npm run cssd']
  }),
  {
    apply(compiler: webpack.Compiler) {
      compiler.hooks.afterEmit.tap('CleanInlinedFile', () => {
        let files = ['main.css', 'main.js'].map(f => path.join(PUBLIC_PATH, f));
        for (let f of files) {
          try {
            fs.unlinkSync(f);
          } catch (e) {}
        }
      });
    }
  },

  new webpack.WatchIgnorePlugin([/css\.d\.ts$/]),

  new MiniCssExtractPlugin({
    filename: '[name].css'
  })
];

if (!_DEV_) {
  plugins.push(
    new OptimizeCssAssetsPlugin({
      assetNameRegExp: /\.css$/g,
      cssProcessor: require('cssnano'),
      cssProcessorPluginOptions: {
        preset: ['default', {discardComments: {removeAll: true}}]
      },
      canPrint: true
    })
  );
}

const config: webpack.Configuration = {
  mode: _DEV_ ? 'development' : 'production',
  entry: path.join(WEB_SRC_PATH, 'main.ts'),
  output: {
    path: PUBLIC_PATH,
    publicPath: '/',
    filename: 'main.js'
  },
  devtool: _DEV_ ? 'inline-source-map' : false,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        include: WEB_SRC_PATH,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              hmr: false
            }
          },

          {
            loader: 'css-loader',
            options: {
              modules: {
                mode: 'global',
                //localIdentName: 'rex_[name]_[local]_[hash:4]',
                context: WEB_SRC_PATH
              },
              localsConvention: 'camelCaseOnly',
              sourceMap: _DEV_
            }
          }
        ]
      },
      {
        test: /\.(png|jpg)$/,
        loader: 'url-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  devServer: {
    contentBase: PUBLIC_PATH,
    compress: false,
    hot: false,
    inline: false,
    liveReload: false
  } as any,
  plugins
};

export default config;
