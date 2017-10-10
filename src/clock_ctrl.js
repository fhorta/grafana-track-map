import './leaflet.js';
import './leaflet-markercluster.js';

import _ from 'lodash';
//import moment from 'moment';
import './css/clock-panel.css!';
import './leaflet.css!';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';

import './leaflet-heat.js';
import './leaflet-sync.js';

import * as d3 from './external/d3.min.js';
import './external/d3-color.min.js';

//import * as h337 from './external/heatmap.min.js';

var map_ctrl = {};

var cmap_opts = {
    "inferno": d3.interpolateInferno,
    "plasma": d3.interpolatePlasma,
    "rainbow": d3.interpolateRainbow,
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function cleanPrevChart(mapId){
    var cid = map_ctrl[mapId]['chart_id'] + " > *";
    d3.select(cid).remove();
}

function loadGradient(gradient){
    var ret = {};
    var values = [
        gradient.c0.v,
        gradient.c1.v,
        gradient.c2.v,
    ]
    ret[values[0]] = gradient.c0.c;
    ret[values[1]] = gradient.c1.c;
    ret[values[2]] = gradient.c2.c;
    return ret;
}

var heatOpts = {
    radius:20,
    minOpacity: 0,
    maxZoom: 18,
    max: 600,
    blur: 15,
    gradient: {0.4: 'blue', 0.65: 'lime', 1: 'red'}
}

const panelDefaults = {
    'metric': "undefined",
    'heatOpts': heatOpts,
    'cmap': "rainbow",
    'nbins': 10
};

//import './realworld-10000.js';
//import {h337} from './heatmap.js'
//import {HeatmapOverlay} from './leaflet-heatmap.js';
//

function syncMaps(){
    //console.log(map_ctrl);
    var map_list = [];
    for (var k in map_ctrl) {
        if (map_ctrl.hasOwnProperty(k)) {
            if (map_ctrl[k]['count']>0) {
                map_list.push(map_ctrl[k]['map']);
            }
        }
    }
    //console.log(map_list);

    if (map_list.length>1) {
        var combos = [];
        for (var i = 0; i < map_list.length; i++)
            for (var j = i + 1; j < map_list.length; j++)
                combos.push([map_list[i], map_list[j]]);

        //console.log("Combos: ", combos.length);
        for (var m in combos){
            var A = combos[m][0];
            var B = combos[m][1];
            A.sync(B);
            B.sync(A);
        }
    }

}


export class ClockCtrl extends MetricsPanelCtrl {
    constructor($scope, $injector) {

        var myMap;
        var coords = [];
        var highlightedMarker = null;
        var timeSrv;

        super($scope, $injector);
        timeSrv = $injector.get('timeSrv');
        this.panel.maxDataPoints = 10000;

        var mapId = "map-" + String(guid());
        var colorbarId = "colorbar-" + mapId;
        var colorbar_;

        this.panel.mapId  = mapId;

        _.defaults(this.panel, panelDefaults);
        var heatOpts = this.panel.heatOpts;
        const dashboard = this.dashboard;

        var metric = this.panel.metric;
        var cmap = cmap_opts[this.panel.cmap];
        var nbins = this.panel.nbins;

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

            if (data[0]!=undefined && data[0].rows!=undefined){
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
            }

            if (lastLineHasData) {
                polylines.push(polyline);
            }

            if (myMap) {
                myMap.remove();
            }

            var center = coords.find(point => point.position);
            center = center ? center.position : [0, 0];

            myMap = L.map(mapId, {
                zoomControl: false,
                attributionControl:false
            });

            map_ctrl[mapId] = {
                map: myMap,
                count: coords.length,
                chart_id: "svg#hist-"+mapId,
            };

            var values;
            if (1) { // testing w fake values or not
                values = coords.map(function(d) { return d.value;});
            } else {
                values = d3.range(1000).map(d3.randomBates(10));
            }
            var [min, max] = d3.extent(values);
            var realValues = d3.scaleLinear().range([min, max]);
            values = values.map(function(d) { return (d-min)/(max-min);});

            var formatVal = d3.format(",.00f");

            cleanPrevChart(mapId);

            var hist = d3.select(map_ctrl[mapId]['chart_id']);
                //hist.attr("preserveAspectRatio", "xMinYMin meet")
                //hist.attr("viewBox", "0 0 960 500");

            var wrap = $("div#wrap-hist-"+mapId);

            var margin = {top: 3, right: 3, bottom: 3, left: 3},
                width = + wrap.width() - margin.left - margin.right,
                height = + wrap.height() - margin.top - margin.bottom,
                g = hist.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            var x = d3.scaleLinear().rangeRound([0, width]);

            var histogram = d3.histogram()
                .domain(x.domain())
                .thresholds(x.ticks(nbins));

            var bins = histogram(values);

            var set_y_domain = function(d){
                return d.length;
            }

            var y = d3.scaleLinear()
                .domain([0, d3.max(bins, set_y_domain)])
                .range([height, 0]);

            var div = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

            var bar = g.selectAll("bar")
                .data(bins)
                .enter().append("g")
                .attr("class", "bar")
                .attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")";  });

            var set_mouseover = function(d) {
                div.transition()
                    .duration(50)
                    .style("opacity", .9)
                    .style("background-color", "black");
                div.html("[" + formatVal(realValues(d.x0)) +  "-" + formatVal(realValues(d.x1))+ "]")
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            }

            var set_mouseout = function(d) {
                div.transition()
                    .duration(50)
                    .style("opacity", 0);
            }

            var set_fill = function(d) {
                var c = cmap(d.x0);
                heatOpts.gradient[d.x1] = c;
                return c;
            };

            var set_height = function(d) {
                return height - y(d.length);
            };

            bar.append("rect")
                .attr("x", 0)
                .attr("width", x(bins[0].x1) - x(bins[0].x0) - 1)
                .attr("height", set_height)
                .attr("fill", set_fill)
                .on("mouseover", set_mouseover)
                .on("mouseout", set_mouseout);

            var fix = 0.000000000001;

            if (data[0]!=undefined){
                myMap.setView(new L.LatLng(40.730610, -73.935242), 18);
            } else {
                myMap.setView(new L.LatLng(center[0], center[1]), 18);
            }

            myMap.fitBounds([
                [minLat + fix, minLon + fix],
                [maxLat + fix, maxLon + fix]
            ]);

            var tiles = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(myMap);

            function aggregateFun(cluster) {
                var val = 0,
                    childMarkers = cluster.getAllChildMarkers(), // Store in local variable to avoid having to execute it many times.
                    total = childMarkers.length;
                for (i = 0; i < total; i++) {
                    val = val + parseInt(childMarkers[i].options.value)
                }
                var avg = val / total;
                avg = Math.round(avg * 10) / 10;
                var navg = (avg-min)/max;
                return new L.divIcon({
                    html: "<div style='background-color: " + cmap(navg) + "'><span>" + avg + "</span></div>",
                    className: ' marker-cluster',
                    iconSize: new L.point(40, 40)
                })
            }

            var markers = L.markerClusterGroup( {
                iconCreateFunction: aggregateFun,
                spiderfyOnMaxZoom: false,
                singleMarkerMode: true
                    //disableClusteringAtZoom: 15
                }
            );

            //data = coords.map(function (p) { return [p.position.lat, p.position.lng, p.value]; });

            for (var i = 0; i < coords.length; i++) {
                var a = coords[i];
                var marker = L.marker(new L.LatLng(a.position.lat, a.position.lng, ), {
                    title: a.value,
                    value: a.value
                });
                marker.bindPopup(a.value);
                markers.addLayer(marker);
            }

            myMap.addLayer(markers);

            //var heatLayer = L.heatLayer(data, heatOpts).addTo(myMap);
            //console.log("coords [", metric,"] ", coords.length);
            syncMaps();

        });
    }

    onInitEditMode() {
        this.addEditorTab( 'Options', 'public/plugins/grafana-map-panel/editor.html', 2);
    }

    onPanelTeardown() {
        this.$timeout.cancel(this.nextTickPromise);
        //console.log("teardown: ", this);
        map_ctrl[this.panel.mapId]['map'].remove();

        var mapId = this.panel.mapId;
        cleanPrevChart(mapId);

        delete map_ctrl[this.panel.mapId];
        syncMaps();
    }

    link(scope, elem) {
        this.events.on('render', () => {
            //const $panelContainer = elem.find('.panel-container');
            //console.log(this.panel.heatOpts);
            //console.log("link: ", Object.keys(scope.maps).length, scope.maps);
            //if (scope.maps[this.panel.mapId] != undefined) {
                //scope.maps[this.panel.mapId].setOptions(this.panel.heatOpts);
                //scope.maps[this.panel.mapId].redraw();
            //}
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
