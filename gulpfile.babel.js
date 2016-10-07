/* eslint-disable import/no-extraneous-dependencies */
import fs from 'fs';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import AssetsWebpackPlugin from 'assets-webpack-plugin';
import _ from 'lodash';
import WebpackNotifierPlugin from 'webpack-notifier';
import WebpackMd5Hash from 'webpack-md5-hash';

// import scsslint from 'gulp-scss-lint';

const gulp = require('gulp');
const gutil = require('gulp-util');
const rimraf = require('rimraf');
const autoprefixer = require('autoprefixer');
const path = require('path');

const destDir = './build';

const WEB_ROOT = __dirname;
const BUNDLE_MAP_FILE = path.resolve(WEB_ROOT, './bundleMap.json');


gulp.task('clean', (done) => {
    rimraf.sync(destDir);
    rimraf.sync(BUNDLE_MAP_FILE);
    done();
});

gulp.task('default', ['clean'], (done) => {
    process.env.NODE_ENV = 'production';

    const webpackConfig = {
        context: WEB_ROOT,
        entry: [
            './replace/replace.js'
        ],
        debug: false,
        output: {
            path: path.resolve(WEB_ROOT, destDir),
            filename: '[name].[chunkhash].js',
            publicPath: '/static/',
        },
        module: {
            loaders: [{
                exclude: [/node_modules/],
                test: /\.js$/,
                loader: 'babel-loader',
            }, {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract('style-loader', 'css-loader!postcss-loader'),
            }, {
                test: /\.scss$/,
                loader: ExtractTextPlugin.extract('style-loader', 'css-loader!postcss-loader!sass-loader'),
            }, {
                loader: 'url-loader?limit=20480&name=[path][name].[ext]?[sha256:hash:base64:8]',
                test: /\.(gif|jpg|jpeg|png|woff|woff2|eot|ttf|svg)(\?v=.+)?$/,
            }, {
                test: /\.handlebars$/,
                loader: 'handlebars-loader',
            }],
        },
        postcss: [autoprefixer],
        plugins: [
            new ExtractTextPlugin('[name].[contenthash].css', { allChunks: false }),
            new AssetsWebpackPlugin({
                path: path.dirname(BUNDLE_MAP_FILE),
                filename: path.basename(BUNDLE_MAP_FILE),
            }),
            new webpack.optimize.OccurenceOrderPlugin(true),

            /* eslint-disable camelcase */
            new webpack.optimize.UglifyJsPlugin({
                compress: {
                    warnings: false,
                    screw_ie8: false,
                },
            }),

            new WebpackMd5Hash(),

        ],
        recordsPath: path.resolve(WEB_ROOT, destDir, 'records.json'),
    };

    webpack(webpackConfig, (fatalError, stats) => {
        if (fatalError) {
            throw new gutil.PluginError('webpack', fatalError);
        }
        const jsonStats = stats.toJson();
        const buildError = jsonStats.errors[0] || jsonStats.warnings[0];

        if (buildError) {
            throw new gutil.PluginError('webpack', buildError);
        } else {
            gutil.log('[webpack]', stats.toString({
                colors: true,
                version: false,
                hash: false,
                timings: false,
                chunks: false,
                chunkModules: false,
            }));
            done();
        }
    });
});
