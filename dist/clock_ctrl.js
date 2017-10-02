'use strict';

System.register(['./leaflet.js', 'lodash', 'moment', './heatmap.js', './leaflet-heatmap.js', './css/clock-panel.css!', './leaflet.css!', 'app/plugins/sdk', 'app/core/app_events'], function (_export, _context) {
  "use strict";

  var LL, _, moment, HeatmapJS, HeatmapOverlay, MetricsPanelCtrl, appEvents, _createClass, myMap, coords, highlightedMarker, timeSrv, ClockCtrl, Geohash;

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

  return {
    setters: [function (_leafletJs) {
      LL = _leafletJs.default;
    }, function (_lodash) {
      _ = _lodash.default;
    }, function (_moment) {
      moment = _moment.default;
    }, function (_heatmapJs) {
      HeatmapJS = _heatmapJs.default;
    }, function (_leafletHeatmapJs) {
      HeatmapOverlay = _leafletHeatmapJs.default;
    }, function (_cssClockPanelCss) {}, function (_leafletCss) {}, function (_appPluginsSdk) {
      MetricsPanelCtrl = _appPluginsSdk.MetricsPanelCtrl;
    }, function (_appCoreApp_events) {
      appEvents = _appCoreApp_events.default;
    }],
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
          var testData = {
            max: 8
            // data: [{lat: 24.6408, lng:46.7728, count: 3},{lat: 50.75, lng:-1.55, count: 1}, ...]
          };

          var baseLayer = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            // attribution: '...',
            maxZoom: 18
          });

          var cfg = {
            // radius should be small ONLY if scaleRadius is true (or small radius is intended)
            // if scaleRadius is false it will be the constant radius used in pixels
            radius: 2,
            maxOpacity: 0.8,
            // scales the radius based on map zoom
            scaleRadius: true,
            // if set to false the heatmap uses the global maximum for colorization
            // if activated: uses the data maximum within the current map boundaries
            //   (there will always be a red spot with useLocalExtremas true)
            useLocalExtrema: true,
            // which field name in your data represents the latitude - default "lat"
            latField: 'lat',
            // which field name in your data represents the longitude - default "lng"
            lngField: 'lng',
            // which field name in your data represents the data value - default "value"
            valueField: 'count'
          };

          var heatmapLayer = new HeatmapOverlay(cfg);

          var map = new L.Map('map-canvas', {
            center: new L.LatLng(25.6586, -80.3568),
            zoom: 4,
            layers: [baseLayer, heatmapLayer]
          });

          heatmapLayer.setData(testData);

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
            for (var i = 0; i < data[0].datapoints.length; i++) {
              var position = data[1].datapoints[i][0] ? Geohash.decode(data[1].datapoints[i][0]) : null;
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
                value: data[0].datapoints[i][0],
                hash: data[1].datapoints[i][0],
                position: position,
                timestamp: data[0].datapoints[i][1]
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
            var CartoDB_PositronNoLabels = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
              subdomains: 'abcd',
              maxZoom: 19
            });

            // var heatmapLayer = new HeatmapOverlay(cfg);

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

            var OpenTopoMap = L.tileLayer('http://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
              maxZoom: 17
            });
            OpenTopoMap.addTo(myMap);
            var OpenSeaMap = L.tileLayer('http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {});

            OpenSeaMap.addTo(myMap);
            polylines.forEach(function (polyline) {
              L.polyline(polyline, {
                color: 'blue',
                weight: 6,
                opacity: 0.9
              }).addTo(myMap);
            });
            coords.forEach(function (point) {
              if (point.position) {
                point.circle = L.circleMarker(point.position, {
                  color: 'none',
                  stroke: 'false',
                  fillColor: 'none',
                  fillOpacity: 0.5,
                  radius: 10
                });
                point.circle.addTo(myMap);
              }
            });
          });
          return _this;
        }

        _createClass(ClockCtrl, [{
          key: 'onInitEditMode',
          value: function onInitEditMode() {
            this.addEditorTab('Options', 'public/plugins/grafana-clock-panel/editor.html', 2);
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

              if (_this2.panel.bgColor) {
                $panelContainer.css('background-color', _this2.panel.bgColor);
              } else {
                $panelContainer.css('background-color', '');
              }
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
