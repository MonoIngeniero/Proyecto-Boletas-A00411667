    const path = require('path');
    const HtmlWebpackPlugin = require('html-webpack-plugin');

    module.exports = {
      entry: './src/index.js',
      output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        clean: true,
      },
      resolve: {
        fallback: {
          fs: false,
          net: false,
          tls: false,
          crypto: false,
          path: false,
          stream: false,
          http: false,
          https: false,
          zlib: false,
          dgram: false,
          child_process: false,
          os: false,
        },
      },
      module: {
        rules: [
          {
            test: /\.css$/i,
            use: ['style-loader', 'css-loader'],
          },
        ],
      },
      plugins: [
        new HtmlWebpackPlugin({
          title: 'Sistema de Reserva de Boletas',
        }),
      ],
      devServer: {
        port: 3000,
        open: true,
        hot: true,
      },
    };