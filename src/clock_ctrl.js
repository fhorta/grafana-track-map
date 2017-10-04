import './leaflet.js';
//import _ from 'lodash';
//import moment from 'moment';
import './css/clock-panel.css!';
import './leaflet.css!';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';

var myMap;
var coords = [];
var highlightedMarker = null;
var timeSrv;

var heatLayer;
var heatOpts = {
    radius:20,
    minOpacity: 0,
    maxZoom: 18,
    max: 600,
    blur: 15,
    gradient: {0.4: 'blue', 0.65: 'lime', 1: 'red'}
}

//import './realworld-10000.js';
import './leaflet-heat.js';
//import {h337} from './heatmap.js'
//import {HeatmapOverlay} from './leaflet-heatmap.js';

export class ClockCtrl extends MetricsPanelCtrl {
    constructor($scope, $injector) {

        super($scope, $injector);
        timeSrv = $injector.get('timeSrv');
        this.panel.maxDataPoints = 500;
        const dashboard = this.dashboard;
        //
        // don't forget to include leaflet-heatmap.js

        appEvents.on('graph-hover', event => {
            if (coords) {
                for (var i = 0; i < coords.length; i++) {
                    if (coords[i].timestamp >= event.pos.x) {
                        if (coords[i].circle) {
                            coords[i].circle.setStyle({
                                fillColor: 'red',
                                color: 'red'
                            });
                        }
                        if (highlightedMarker) {
                            highlightedMarker.setStyle({
                                fillColor: 'none',
                                color: 'none'
                            });
                        }
                        highlightedMarker = coords[i].circle;
                        break;
                    }
                }
            }
        });

        this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
        this.events.on('panel-teardown', this.onPanelTeardown.bind(this));
        this.events.on('panel-initialized', this.render.bind(this));
        this.events.on('data-received', function (data) {
            coords = [];
            var minLat = 90;
            var maxLat = -90;
            var minLon = 180;
            var maxLon = -180;
            var polylines = [];
            var polyline = [];
            var lastLineHasData = false;

            if (data[0]===undefined){
                return false;
            }

            for (var i = 0; i < data[0].rows.length; i++) {
                const position = data[0].rows[i][1] ?
                    Geohash.decode(data[0].rows[i][1]) :
                    null;
                if (position) {
                    minLat = Math.min(minLat, position.lat);
                    minLon = Math.min(minLon, position.lng);
                    maxLat = Math.max(maxLat, position.lat);
                    maxLon = Math.max(maxLon, position.lng);
                    polyline.push(position);
                    lastLineHasData = true;
                } else {
                    if (lastLineHasData) {
                        polylines.push(polyline);
                        polyline = [];
                        lastLineHasData = false;
                    }
                }
                coords.push({
                    value: data[0].rows[i][2],
                    hash: data[0].rows[i][1],
                    position: position,
                    timestamp: data[0].rows[i][0]
                });
            }

            if (lastLineHasData) {
                polylines.push(polyline);
            }

            if (myMap) {
                myMap.remove();
            }

            var center = coords.find(point => point.position);
            center = center ? center.position : [0, 0];

            myMap = L.map('themap');
            var fix = 0.000000000001;
            myMap.fitBounds([
                [minLat + fix, minLon + fix],
                [maxLat, maxLon]
            ]);

            //var tiles = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                //attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
            //}).addTo(myMap);

            var tiles = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(myMap);

            var scale = function(opts){
                var istart = opts.domain[0],
                    istop  = opts.domain[1],
                    ostart = opts.range[0],
                    ostop  = opts.range[1];
                return function scale(value) {
                    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
                }
            };

            var nscale=10;
            var mscale = scale({domain:[0,nscale],range:[0,1]});
            var mgradient = {};
            var inc = 0;
            var mcolors = generateColor('#111111','#6495ED',nscale);

            mcolors.map(function (c) {
                mgradient[mscale(inc)] = "#"+String(mcolors[inc]);
                inc+=1;
            })

            //console.log("Gradient: ", mgradient);

            data = coords.map(function (p) { return [p.position.lat, p.position.lng, p.value]; });

            heatLayer = L.heatLayer(data, heatOpts).addTo(myMap);

            myMap.on('boxzoomend', function (e) {
                const coordsInBox = coords.filter(
                    coord =>
                    coord.position &&
                    e.boxZoomBounds.contains(
                        L.latLng(coord.position.lat, coord.position.lng)
                    )
                );
                const minTime = Math.min.apply(
                    Math,
                    coordsInBox.map(coord => coord.timestamp)
                );
                const maxTime = Math.max.apply(
                    Math,
                    coordsInBox.map(coord => coord.timestamp)
                );
                console.log(new Date(minTime));
                console.log(new Date(maxTime));
                if (isFinite(minTime) && isFinite(maxTime)) {
                    timeSrv.setTime({
                        from: moment.utc(minTime),
                        to: moment.utc(maxTime)
                    });
                }
            });
        });

    }

    onInitEditMode() {
        this.addEditorTab( 'Options', 'public/plugins/grafana-map-panel/editor.html', 2);
    }

    onPanelTeardown() {
        this.$timeout.cancel(this.nextTickPromise);
    }

    link(scope, elem) {
        this.events.on('render', () => {
            const $panelContainer = elem.find('.panel-container');
            heatOpts.gradient = {0.4: this.panel.grad.c0, 0.65: this.panel.grad.c1, 1: this.panel.grad.c2};
            heatLayer.setOptions(heatOpts);
            heatLayer.redraw();
        });
    }
}

ClockCtrl.templateUrl = 'module.html';

var Geohash = {};

/* (Geohash-specific) Base32 map */
Geohash.base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

Geohash.decode = function (geohash) {
    var bounds = Geohash.bounds(geohash); // <-- the hard work
    // now just determine the centre of the cell...

    var latMin = bounds.sw.lat,
        lonMin = bounds.sw.lng;
    var latMax = bounds.ne.lat,
        lonMax = bounds.ne.lng;

    // cell centre
    var lat = (latMin + latMax) / 2;
    var lon = (lonMin + lonMax) / 2;

    // round to close to centre without excessive precision: ⌊2-log10(Δ°)⌋ decimal places
    lat = lat.toFixed(Math.floor(2 - Math.log(latMax - latMin) / Math.LN10));
    lon = lon.toFixed(Math.floor(2 - Math.log(lonMax - lonMin) / Math.LN10));

    return {
        lat: Number(lat),
        lng: Number(lon)
    };
};

Geohash.bounds = function (geohash) {
    if (geohash.length === 0) throw new Error('Invalid geohash');

    geohash = geohash.toLowerCase();

    var evenBit = true;
    var latMin = -90,
        latMax = 90;
    var lonMin = -180,
        lonMax = 180;

    for (var i = 0; i < geohash.length; i++) {
        var chr = geohash.charAt(i);
        var idx = Geohash.base32.indexOf(chr);
        if (idx == -1) throw new Error('Invalid geohash');

        for (var n = 4; n >= 0; n--) {
            var bitN = (idx >> n) & 1;
            if (evenBit) {
                // longitude
                var lonMid = (lonMin + lonMax) / 2;
                if (bitN == 1) {
                    lonMin = lonMid;
                } else {
                    lonMax = lonMid;
                }
            } else {
                // latitude
                var latMid = (latMin + latMax) / 2;
                if (bitN == 1) {
                    latMin = latMid;
                } else {
                    latMax = latMid;
                }
            }
            evenBit = !evenBit;
        }
    }

    var bounds = {
        sw: {
            lat: latMin,
            lng: lonMin
        },
        ne: {
            lat: latMax,
            lng: lonMax
        }
    };

    return bounds;
};

function hex (c) {
  var s = "0123456789abcdef";
  var i = parseInt (c);
  if (i == 0 || isNaN (c))
    return "00";
  i = Math.round (Math.min (Math.max (0, i), 255));
  return s.charAt ((i - i % 16) / 16) + s.charAt (i % 16);
}

/* Convert an RGB triplet to a hex string */
function convertToHex (rgb) {
  return hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
}

/* Remove '#' in color hex string */
function trim (s) { return (s.charAt(0) == '#') ? s.substring(1, 7) : s }

/* Convert a hex string to an RGB triplet */
function convertToRGB (hex) {
  var color = [];
  color[0] = parseInt ((trim(hex)).substring (0, 2), 16);
  color[1] = parseInt ((trim(hex)).substring (2, 4), 16);
  color[2] = parseInt ((trim(hex)).substring (4, 6), 16);
  return color;
}

function generateColor(colorStart,colorEnd,colorCount){
    // The beginning of your gradient
    var start = convertToRGB (colorStart);
    // The end of your gradient
    var end   = convertToRGB (colorEnd);
    // The number of colors to compute
    var len = colorCount;
    //Alpha blending amount
    var alpha = 0.0;
    var ret = [];
    for (var i = 0; i < len; i++) {
        var c = [];
        alpha += (1.0/len);
        c[0] = start[0] * alpha + (1 - alpha) * end[0];
        c[1] = start[1] * alpha + (1 - alpha) * end[1];
        c[2] = start[2] * alpha + (1 - alpha) * end[2];
        ret.push(convertToHex (c));
    }
    return ret;
}
