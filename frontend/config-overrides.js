const { override, addWebpackPlugin, addBabelPlugin } = require('customize-cra');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = override(
  // Remove broken babel plugin that was causing import errors

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
              priority: 20
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
              test: /[\\/]node_modules[\\/]mapbox-gl/,
              name: 'mapbox',
              priority: 30,
              chunks: 'all'
            },
            three: {
              test: /[\\/]node_modules[\\/]three/,
              name: 'three',
              priority: 30,
              chunks: 'all'
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
              chunks: 'all'
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
                pure_funcs: ['console.log', 'console.info', 'console.debug']
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
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8
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
        // Remove incorrect React aliases - let webpack handle React normally
        // Alias for easier imports
        '@components': 'src/components',
        '@styles': 'src/styles',
        '@utils': 'src/utils',
        '@api': 'src/api'
      }
    };

    // Remove broken CSS optimization that was causing loader errors

    // Add performance hints
    config.performance = {
      hints: 'warning',
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
      assetFilter: function(assetFilename) {
        return assetFilename.endsWith('.js') || assetFilename.endsWith('.css');
      }
    };

    return config;
  }
);