'use strict';

System.register(['./external/leaflet.js', './external/leaflet-markercluster.js', './external/leaflet-sync.js', './external/d3.min.js', './external/d3-color.min.js', 'lodash', './css/clock-panel.css!', './css/leaflet.css!', 'app/plugins/sdk', 'app/core/app_events'], function (_export, _context) {
    "use strict";

    var d3, _, MetricsPanelCtrl, appEvents, _slicedToArray, _createClass, map_ctrl, cmap_opts, heatOpts, panelDefaults, ClockCtrl, Geohash;

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

    function guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

    function syncMaps() {
        var map_list = [];
        for (var k in map_ctrl) {
            if (map_ctrl.hasOwnProperty(k)) {
                if (map_ctrl[k]['count'] > 0) {
                    map_list.push(map_ctrl[k]['map']);
                }
            }
        }
        if (map_list.length > 1) {
            var combos = [];
            for (var i = 0; i < map_list.length; i++) {
                for (var j = i + 1; j < map_list.length; j++) {
                    combos.push([map_list[i], map_list[j]]);
                }
            } //console.log("Combos: ", combos.length);
            for (var m in combos) {
                var A = combos[m][0];
                var B = combos[m][1];
                A.sync(B);
                B.sync(A);
            }
        }
    }

    return {
        setters: [function (_externalLeafletJs) {}, function (_externalLeafletMarkerclusterJs) {}, function (_externalLeafletSyncJs) {}, function (_externalD3MinJs) {
            d3 = _externalD3MinJs;
        }, function (_externalD3ColorMinJs) {}, function (_lodash) {
            _ = _lodash.default;
        }, function (_cssClockPanelCss) {}, function (_cssLeafletCss) {}, function (_appPluginsSdk) {
            MetricsPanelCtrl = _appPluginsSdk.MetricsPanelCtrl;
        }, function (_appCoreApp_events) {
            appEvents = _appCoreApp_events.default;
        }],
        execute: function () {
            _slicedToArray = function () {
                function sliceIterator(arr, i) {
                    var _arr = [];
                    var _n = true;
                    var _d = false;
                    var _e = undefined;

                    try {
                        for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                            _arr.push(_s.value);

                            if (i && _arr.length === i) break;
                        }
                    } catch (err) {
                        _d = true;
                        _e = err;
                    } finally {
                        try {
                            if (!_n && _i["return"]) _i["return"]();
                        } finally {
                            if (_d) throw _e;
                        }
                    }

                    return _arr;
                }

                return function (arr, i) {
                    if (Array.isArray(arr)) {
                        return arr;
                    } else if (Symbol.iterator in Object(arr)) {
                        return sliceIterator(arr, i);
                    } else {
                        throw new TypeError("Invalid attempt to destructure non-iterable instance");
                    }
                };
            }();

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

            map_ctrl = {};
            cmap_opts = {
                "inferno": d3.interpolateInferno,
                "plasma": d3.interpolatePlasma,
                "rainbow": d3.interpolateRainbow,
                "cool": d3.interpolateCool
                //"BrBG": d3.interpolateBrBG,
            };
            heatOpts = {
                radius: 20,
                minOpacity: 0,
                maxZoom: 18,
                max: 600,
                blur: 15
            };
            panelDefaults = {
                'metric': "undefined",
                'heatOpts': heatOpts,
                'cmap': "rainbow",
                'nbins': 10
            };

            _export('ClockCtrl', ClockCtrl = function (_MetricsPanelCtrl) {
                _inherits(ClockCtrl, _MetricsPanelCtrl);

                function ClockCtrl($scope, $injector) {
                    _classCallCheck(this, ClockCtrl);

                    var myMap,
                        data = [],
                        dataLinScale,
                        timeSrv,
                        min,
                        max,
                        mapId = "map-" + String(guid());

                    var _this = _possibleConstructorReturn(this, (ClockCtrl.__proto__ || Object.getPrototypeOf(ClockCtrl)).call(this, $scope, $injector));

                    timeSrv = $injector.get('timeSrv');

                    _this.panel.mapId = mapId;

                    var metric = _this.panel.metric,
                        cmap = cmap_opts[_this.panel.cmap],
                        nbins = _this.panel.nbins,
                        heatOpts = _this.panel.heatOpts;

                    _.defaults(_this.panel, panelDefaults);

                    var dashboard = _this.dashboard;

                    _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));
                    _this.events.on('panel-teardown', _this.onPanelTeardown.bind(_this));
                    _this.events.on('panel-initialized', _this.render.bind(_this));

                    _this.events.on('data-received', function (data_) {
                        data = [];
                        var minLat = 90;
                        var maxLat = -90;
                        var minLon = 180;
                        var maxLon = -180;

                        var polylines = [];
                        var polyline = [];

                        if (data_[0] != undefined && data_[0].rows != undefined) {
                            for (var i = 0; i < data_[0].rows.length; i++) {
                                var position = data_[0].rows[i][1] ? Geohash.decode(data_[0].rows[i][1]) : null;
                                if (position) {
                                    minLat = Math.min(minLat, position.lat);
                                    minLon = Math.min(minLon, position.lng);
                                    maxLat = Math.max(maxLat, position.lat);
                                    maxLon = Math.max(maxLon, position.lng);
                                    polyline.push(position);
                                } else {
                                    if (lastLineHasData) {
                                        polylines.push(polyline);
                                        polyline = [];
                                        lastLineHasData = false;
                                    }
                                }
                                data.push({
                                    value: data_[0].rows[i][2],
                                    hash: data_[0].rows[i][1],
                                    position: position,
                                    timestamp: data_[0].rows[i][0]
                                });
                            }
                        }

                        if (myMap) {
                            myMap.remove();
                        }

                        var center = data.find(function (point) {
                            return point.position;
                        });
                        center = center ? center.position : [0, 0];

                        myMap = L.map("div#" + mapId, {
                            zoomControl: false,
                            attributionControl: false
                        });

                        map_ctrl[mapId] = {
                            map: myMap,
                            count: data.length,
                            chart_id: "svg#hist-" + mapId
                        };

                        histogram.plot(mapId);

                        for (var i = 0; i < data.length; i++) {
                            var a = data[i];
                            var marker = L.marker(new L.LatLng(a.position.lat, a.position.lng), {
                                title: a.value,
                                value: a.value
                            });
                            marker.bindPopup(a.value);
                            markers.addLayer(marker);
                        }

                        myMap.addLayer(markers);
                        syncMaps();
                    });

                    var histogram = {

                        clean: function clean() {
                            var cid = map_ctrl[mapId]['chart_id'] + " > *";
                            d3.select(cid).remove();
                        },

                        aggregate: function aggregate(cluster) {
                            var val = 0,
                                childMarkers = cluster.getAllChildMarkers(),
                                // Store in local variable to avoid having to execute it many times.
                            total = childMarkers.length;
                            for (i = 0; i < total; i++) {
                                val = val + parseInt(childMarkers[i].options.value);
                            }
                            var avg = val / total;
                            avg = Math.round(avg * 10) / 10;
                            var navg = (avg - min) / max;
                            return new L.divIcon({
                                html: "<div style='background-color: " + cmap(navg) + "'><span>" + avg + "</span></div>",
                                className: ' marker-cluster',
                                iconSize: new L.point(40, 40)
                            });
                        },

                        plot: function plot() {

                            histogram.clean();

                            var values = data.map(function (d) {
                                return d.value;
                            });

                            var _d3$extent = d3.extent(values);

                            var _d3$extent2 = _slicedToArray(_d3$extent, 2);

                            min = _d3$extent2[0];
                            max = _d3$extent2[1];

                            values = values.map(function (d) {
                                return (d - min) / (max - min);
                            });
                            dataLinScale = d3.scaleLinear().range([min, max]);

                            var formatVal = d3.format(",.00f");
                            var hist = d3.select(map_ctrl[mapId]['chart_id']);
                            var wrap = $("div#wrap-hist-" + mapId);

                            var margin = { top: 3, right: 3, bottom: 3, left: 3 },
                                width = +wrap.width() - margin.left - margin.right,
                                height = +wrap.height() - margin.top - margin.bottom,
                                g = hist.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                            var x = d3.scaleLinear().rangeRound([0, width]);

                            histogram.svg = d3.histogram().domain(x.domain()).thresholds(x.ticks(nbins));

                            var bins = histogram.svg(values);

                            var set_y_domain = function set_y_domain(d) {
                                return d.length;
                            };

                            var y = d3.scaleLinear().domain([0, d3.max(bins, set_y_domain)]).range([height, 0]);

                            var div = d3.select("div#tooltip-hist-" + mapId).attr("class", "tooltip").style("opacity", 0);

                            var bar = g.selectAll("bar").data(bins).enter().append("g").attr("class", "bar").attr("transform", function (d) {
                                return "translate(" + x(d.x0) + "," + y(d.length) + ")";
                            });

                            var set_mouseover = function set_mouseover(d) {
                                div.transition().duration(50).style("opacity", .9).style("background-color", "black");
                                div.html("[" + formatVal(dataLinScale(d.x0)) + "-" + formatVal(dataLinScale(d.x1)) + "]");
                            };

                            var set_mouseout = function set_mouseout(d) {
                                div.transition().duration(50).style("opacity", 0);
                            };

                            var set_fill = function set_fill(d) {
                                var c = cmap(d.x0);
                                heatOpts.gradient[d.x1] = c;
                                return c;
                            };

                            var set_height = function set_height(d) {
                                return height - y(d.length);
                            };

                            bar.append("rect").attr("x", 0).attr("width", x(bins[0].x1) - x(bins[0].x0) - 1).attr("height", set_height).attr("fill", set_fill).on("mouseover", set_mouseover).on("mouseout", set_mouseout);

                            var fix = 0.000000000001;

                            if (data[0] != undefined) {
                                myMap.setView(new L.LatLng(40.730610, -73.935242), 18);
                            } else {
                                myMap.setView(new L.LatLng(center[0], center[1]), 18);
                            }

                            myMap.fitBounds([[minLat + fix, minLon + fix], [maxLat + fix, maxLon + fix]]);

                            var tiles = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
                                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
                                subdomains: 'abcd',
                                maxZoom: 20
                            }).addTo(myMap);

                            var markers = L.markerClusterGroup({
                                iconCreateFunction: histogram.aggregate,
                                spiderfyOnMaxZoom: false,
                                singleMarkerMode: true
                            });
                        }
                    };

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
                        //console.log("teardown: ", this);
                        map_ctrl[mapId]['map'].remove();
                        histogram.clean();
                        delete map_ctrl[mapId];
                        syncMaps();
                    }
                }, {
                    key: 'link',
                    value: function link(scope, elem) {
                        this.events.on('render', function () {
                            //const $panelContainer = elem.find('.panel-container');
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
