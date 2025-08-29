const { override, addWebpackPlugin } = require('customize-cra');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  webpack: override(
    // Add webpack configuration
    (config) => {
      // Production optimizations
      if (config.mode === 'production') {
        // Optimize bundle splitting
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              default: false,
              vendors: false,
              // Vendor code splitting
              vendor: {
                name: 'vendor',
                chunks: 'all',
                test: /node_modules/,
                priority: 20,
                enforce: true,
                reuseExistingChunk: true
              },
              // Common components
              common: {
                name: 'common',
                minChunks: 2,
                chunks: 'all',
                priority: 10,
                reuseExistingChunk: true,
                enforce: true
              },
              // Separate large libraries
              mapbox: {
                test: /[\\/]node_modules[\\/](mapbox-gl|@mapbox)/,
                name: 'mapbox',
                priority: 30,
                chunks: 'all',
                enforce: true
              },
              three: {
                test: /[\\/]node_modules[\\/](three|@react-three|cannon-es)/,
                name: 'three',
                priority: 30,
                chunks: 'all',
                enforce: true
              },
              particles: {
                test: /[\\/]node_modules[\\/]@?tsparticles/,
                name: 'particles',
                priority: 30,
                chunks: 'all'
              },
              framer: {
                test: /[\\/]node_modules[\\/]framer-motion/,
                name: 'framer',
                priority: 30,
                chunks: 'all',
                enforce: true
              },
              // Separate React and core libraries
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-router)/,
                name: 'react',
                priority: 40,
                chunks: 'all',
                enforce: true
              },
              // Separate heavy utilities
              utils: {
                test: /[\\/]node_modules[\\/](lodash|@turf|axios|crypto-js)/,
                name: 'utils',
                priority: 25,
                chunks: 'all',
                enforce: true
              }
            }
          },
          runtimeChunk: 'single',
          minimize: true,
          minimizer: [
            new TerserPlugin({
              terserOptions: {
                parse: {
                  ecma: 8
                },
                compress: {
                  ecma: 5,
                  warnings: false,
                  inline: 2,
                  drop_console: true,
                  drop_debugger: true,
                  pure_funcs: ['console.log', 'console.info', 'console.debug'],
                  passes: 3,
                  dead_code: true,
                  unused: true
                },
                mangle: {
                  safari10: true
                },
                output: {
                  ecma: 5,
                  comments: false,
                  ascii_only: true
                }
              },
              parallel: true
            })
          ]
        };

        // Add compression plugin
        config.plugins.push(
          new CompressionPlugin({
            algorithm: 'gzip',
            test: /\.(js|css|html|svg|json)$/,
            threshold: 4096, // Lower threshold for more compression
            minRatio: 0.7,
            deleteOriginalAssets: false,
            filename: '[path][base].gz'
          }),
          // Add Brotli compression for better compression ratio
          new CompressionPlugin({
            algorithm: 'brotliCompress',
            test: /\.(js|css|html|svg|json)$/,
            threshold: 4096,
            minRatio: 0.7,
            deleteOriginalAssets: false,
            filename: '[path][base].br'
          })
        );

        // Add bundle analyzer in analyze mode
        if (process.env.ANALYZE === 'true') {
          config.plugins.push(
            new BundleAnalyzerPlugin({
              analyzerMode: 'static',
              reportFilename: 'bundle-report.html',
              openAnalyzer: false
            })
          );
        }
      }

      // Module resolution optimizations
      config.resolve = {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          '@components': 'src/components',
          '@styles': 'src/styles',
          '@utils': 'src/utils',
          '@api': 'src/api'
        }
      };

      // Add performance hints
      config.performance = {
        hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
        maxEntrypointSize: 768000, // Increased slightly for complex app
        maxAssetSize: 512000,
        assetFilter: function(assetFilename) {
          return assetFilename.endsWith('.js') || assetFilename.endsWith('.css');
        }
      };

      // Enable tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      
      // Add module concatenation for smaller bundles
      config.optimization.concatenateModules = true;

      return config;
    }
  ),
  // Dev server configuration for SPA routing
  devServer: function(configFunction) {
    return function(proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);
      
      // Enable serving index.html for all non-file routes (required for React Router)
      config.historyApiFallback = true;
      
      // Ensure proxy is properly configured
      // The setupProxy.js file should be loaded automatically by react-scripts
      // but we need to ensure the proxy parameter is passed correctly
      if (proxy) {
        config.proxy = proxy;
      }
      
      return config;
    };
  }
};