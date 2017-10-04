'use strict';

System.register(['./leaflet.js', './css/clock-panel.css!', './leaflet.css!', 'app/plugins/sdk', 'app/core/app_events', './leaflet-heat.js'], function (_export, _context) {
    "use strict";

    var MetricsPanelCtrl, appEvents, _createClass, myMap, coords, highlightedMarker, timeSrv, heatLayer, heatOpts, ClockCtrl, Geohash;

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    function _possibleConstructorReturn(self, call) {
        if (!self) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }

        return call && (typeof call === "object" || typeof call === "function") ? call : self;
    }

    function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
            throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
        }

        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }

    function hex(c) {
        var s = "0123456789abcdef";
        var i = parseInt(c);
        if (i == 0 || isNaN(c)) return "00";
        i = Math.round(Math.min(Math.max(0, i), 255));
        return s.charAt((i - i % 16) / 16) + s.charAt(i % 16);
    }

    /* Convert an RGB triplet to a hex string */
    function convertToHex(rgb) {
        return hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
    }

    /* Remove '#' in color hex string */
    function trim(s) {
        return s.charAt(0) == '#' ? s.substring(1, 7) : s;
    }

    /* Convert a hex string to an RGB triplet */
    function convertToRGB(hex) {
        var color = [];
        color[0] = parseInt(trim(hex).substring(0, 2), 16);
        color[1] = parseInt(trim(hex).substring(2, 4), 16);
        color[2] = parseInt(trim(hex).substring(4, 6), 16);
        return color;
    }

    function generateColor(colorStart, colorEnd, colorCount) {
        // The beginning of your gradient
        var start = convertToRGB(colorStart);
        // The end of your gradient
        var end = convertToRGB(colorEnd);
        // The number of colors to compute
        var len = colorCount;
        //Alpha blending amount
        var alpha = 0.0;
        var ret = [];
        for (var i = 0; i < len; i++) {
            var c = [];
            alpha += 1.0 / len;
            c[0] = start[0] * alpha + (1 - alpha) * end[0];
            c[1] = start[1] * alpha + (1 - alpha) * end[1];
            c[2] = start[2] * alpha + (1 - alpha) * end[2];
            ret.push(convertToHex(c));
        }
        return ret;
    }
    return {
        setters: [function (_leafletJs) {}, function (_cssClockPanelCss) {}, function (_leafletCss) {}, function (_appPluginsSdk) {
            MetricsPanelCtrl = _appPluginsSdk.MetricsPanelCtrl;
        }, function (_appCoreApp_events) {
            appEvents = _appCoreApp_events.default;
        }, function (_leafletHeatJs) {}],
        execute: function () {
            _createClass = function () {
                function defineProperties(target, props) {
                    for (var i = 0; i < props.length; i++) {
                        var descriptor = props[i];
                        descriptor.enumerable = descriptor.enumerable || false;
                        descriptor.configurable = true;
                        if ("value" in descriptor) descriptor.writable = true;
                        Object.defineProperty(target, descriptor.key, descriptor);
                    }
                }

                return function (Constructor, protoProps, staticProps) {
                    if (protoProps) defineProperties(Constructor.prototype, protoProps);
                    if (staticProps) defineProperties(Constructor, staticProps);
                    return Constructor;
                };
            }();

            coords = [];
            highlightedMarker = null;
            heatOpts = {
                radius: 20,
                minOpacity: 0,
                maxZoom: 18,
                max: 600,
                blur: 15,
                gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }

                //import './realworld-10000.js';
            };

            _export('ClockCtrl', ClockCtrl = function (_MetricsPanelCtrl) {
                _inherits(ClockCtrl, _MetricsPanelCtrl);

                function ClockCtrl($scope, $injector) {
                    _classCallCheck(this, ClockCtrl);

                    var _this = _possibleConstructorReturn(this, (ClockCtrl.__proto__ || Object.getPrototypeOf(ClockCtrl)).call(this, $scope, $injector));

                    timeSrv = $injector.get('timeSrv');
                    _this.panel.maxDataPoints = 500;
                    var dashboard = _this.dashboard;
                    //
                    // don't forget to include leaflet-heatmap.js

                    appEvents.on('graph-hover', function (event) {
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

                    _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));
                    _this.events.on('panel-teardown', _this.onPanelTeardown.bind(_this));
                    _this.events.on('panel-initialized', _this.render.bind(_this));
                    _this.events.on('data-received', function (data) {
                        coords = [];
                        var minLat = 90;
                        var maxLat = -90;
                        var minLon = 180;
                        var maxLon = -180;
                        var polylines = [];
                        var polyline = [];
                        var lastLineHasData = false;

                        if (data[0] === undefined) {
                            return false;
                        }

                        for (var i = 0; i < data[0].rows.length; i++) {
                            var position = data[0].rows[i][1] ? Geohash.decode(data[0].rows[i][1]) : null;
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

                        var center = coords.find(function (point) {
                            return point.position;
                        });
                        center = center ? center.position : [0, 0];

                        myMap = L.map('themap');
                        var fix = 0.000000000001;
                        myMap.fitBounds([[minLat + fix, minLon + fix], [maxLat, maxLon]]);

                        //var tiles = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                        //attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
                        //}).addTo(myMap);

                        var tiles = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
                            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
                            subdomains: 'abcd',
                            maxZoom: 20
                        }).addTo(myMap);

                        var scale = function scale(opts) {
                            var istart = opts.domain[0],
                                istop = opts.domain[1],
                                ostart = opts.range[0],
                                ostop = opts.range[1];
                            return function scale(value) {
                                return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
                            };
                        };

                        var nscale = 10;
                        var mscale = scale({ domain: [0, nscale], range: [0, 1] });
                        var mgradient = {};
                        var inc = 0;
                        var mcolors = generateColor('#111111', '#6495ED', nscale);

                        mcolors.map(function (c) {
                            mgradient[mscale(inc)] = "#" + String(mcolors[inc]);
                            inc += 1;
                        });

                        //console.log("Gradient: ", mgradient);

                        data = coords.map(function (p) {
                            return [p.position.lat, p.position.lng, p.value];
                        });

                        heatLayer = L.heatLayer(data, heatOpts).addTo(myMap);

                        myMap.on('boxzoomend', function (e) {
                            var coordsInBox = coords.filter(function (coord) {
                                return coord.position && e.boxZoomBounds.contains(L.latLng(coord.position.lat, coord.position.lng));
                            });
                            var minTime = Math.min.apply(Math, coordsInBox.map(function (coord) {
                                return coord.timestamp;
                            }));
                            var maxTime = Math.max.apply(Math, coordsInBox.map(function (coord) {
                                return coord.timestamp;
                            }));
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

                    return _this;
                }

                _createClass(ClockCtrl, [{
                    key: 'onInitEditMode',
                    value: function onInitEditMode() {
                        this.addEditorTab('Options', 'public/plugins/grafana-map-panel/editor.html', 2);
                    }
                }, {
                    key: 'onPanelTeardown',
                    value: function onPanelTeardown() {
                        this.$timeout.cancel(this.nextTickPromise);
                    }
                }, {
                    key: 'link',
                    value: function link(scope, elem) {
                        var _this2 = this;

                        this.events.on('render', function () {
                            var $panelContainer = elem.find('.panel-container');
                            heatOpts.gradient = { 0.4: _this2.panel.grad.c0, 0.65: _this2.panel.grad.c1, 1: _this2.panel.grad.c2 };
                            heatLayer.setOptions(heatOpts);
                            heatLayer.redraw();
                        });
                    }
                }]);

                return ClockCtrl;
            }(MetricsPanelCtrl));

            _export('ClockCtrl', ClockCtrl);

            ClockCtrl.templateUrl = 'module.html';

            Geohash = {};


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
                        var bitN = idx >> n & 1;
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
        }
    };
});
//# sourceMappingURL=clock_ctrl.js.map
