// leaflet stuff
import './external/leaflet.js';
import './external/leaflet-markercluster.js';
//import './leaflet-heat.js';
import './external/leaflet-sync.js';

// d3 stuff
import * as d3 from './external/d3.min.js';
import './external/d3-color.min.js';

//import './external/d3-interpolate.min.js';
//import './external/d3-scale-chromatic.min.js';
import _ from 'lodash';
//import moment from 'moment';

import './css/clock-panel.css!';
import './css/leaflet.css!';

import { MetricsPanelCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';

var map_ctrl = {};

var cmap_opts = {
    "inferno": d3.interpolateInferno,
    "plasma": d3.interpolatePlasma,
    "rainbow": d3.interpolateRainbow,
    "cool": d3.interpolateCool,
    //"BrBG": d3.interpolateBrBG,
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

var heatOpts = {
    radius:20,
    minOpacity: 0,
    maxZoom: 18,
    max: 600,
    blur: 15,
}

const panelDefaults = {
    'metric': "undefined",
    'heatOpts': heatOpts,
    'cmap': "rainbow",
    'nbins': 10
};


function syncMaps(){
    var map_list = [];
    for (var k in map_ctrl) {
        if (map_ctrl.hasOwnProperty(k)) {
            if (map_ctrl[k]['count']>0) {
                map_list.push(map_ctrl[k]['map']);
            }
        }
    }
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
        var myMap,
            data = [],
            dataLinScale,
            timeSrv,
            min, max,
            mapId = "map-" + String(guid());

        super($scope, $injector);
        timeSrv = $injector.get('timeSrv');

        this.panel.mapId = mapId;

        var metric =    this.panel.metric,
            cmap =      cmap_opts[this.panel.cmap],
            nbins =     this.panel.nbins,
            heatOpts =  this.panel.heatOpts;

        _.defaults(this.panel, panelDefaults);

        const dashboard = this.dashboard;

        this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
        this.events.on('panel-teardown', this.onPanelTeardown.bind(this));
        this.events.on('panel-initialized', this.render.bind(this));

        this.events.on('data-received', function (data_) {
            data = [];
            var minLat = 90;
            var maxLat = -90;
            var minLon = 180;
            var maxLon = -180;

            var polylines = [];
            var polyline = [];

            if (data_[0]!=undefined && data_[0].rows!=undefined){
                for (var i = 0; i < data_[0].rows.length; i++) {
                    const position = data_[0].rows[i][1] ?
                        Geohash.decode(data_[0].rows[i][1]) :
                        null;
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

            var center = data.find(point => point.position);
            center = center ? center.position : [0, 0];

            myMap = L.map("div#" + mapId, {
                zoomControl: false,
                attributionControl:false
            });

            map_ctrl[mapId] = {
                map: myMap,
                count: data.length,
                chart_id: "svg#hist-"+mapId,
            };

            histogram.plot(mapId);

            for (var i = 0; i < data.length; i++) {
                const a = data[i];
                const marker = L.marker(new L.LatLng(a.position.lat, a.position.lng, ), {
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

        clean: function(){
            const cid = map_ctrl[mapId]['chart_id'] + " > *";
            d3.select(cid).remove();
        },

        aggregate: function(cluster) {
            let val = 0,
                childMarkers = cluster.getAllChildMarkers(), // Store in local variable to avoid having to execute it many times.
                total = childMarkers.length;
            for (i = 0; i < total; i++) {
                val = val + parseInt(childMarkers[i].options.value)
            }
            let avg = val / total;
            avg = Math.round(avg * 10) / 10;
            let navg = (avg-min)/max;
            return new L.divIcon({
                html: "<div style='background-color: " + cmap(navg) + "'><span>" + avg + "</span></div>",
                className: ' marker-cluster',
                iconSize: new L.point(40, 40)
            })
        },

        plot: function(){

            histogram.clean();

            let values = data.map(function(d) { return d.value;});

            [min, max] = d3.extent(values);
            values = values.map(function(d) { return (d-min)/(max-min);});
            dataLinScale = d3.scaleLinear().range([min, max]);

            let formatVal = d3.format(",.00f");
            let hist = d3.select(map_ctrl[mapId]['chart_id']);
            let wrap = $("div#wrap-hist-"+mapId);

            let margin = {top: 3, right: 3, bottom: 3, left: 3},
                width = + wrap.width() - margin.left - margin.right,
                height = + wrap.height() - margin.top - margin.bottom,
                g = hist.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            let x = d3.scaleLinear().rangeRound([0, width]);

            histogram.svg = d3.histogram()
                .domain(x.domain())
                .thresholds(x.ticks(nbins));

            let bins = histogram.svg(values);

            let set_y_domain = function(d){
                return d.length;
            };

            let y = d3.scaleLinear()
                .domain([0, d3.max(bins, set_y_domain)])
                .range([height, 0]);

            let div = d3.select("div#tooltip-hist-"+mapId)
                .attr("class", "tooltip")
                .style("opacity", 0);

            let bar = g.selectAll("bar")
                .data(bins)
                .enter().append("g")
                .attr("class", "bar")
                .attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")";  });

            let set_mouseover = function(d) {
                div.transition()
                    .duration(50)
                    .style("opacity", .9)
                    .style("background-color", "black");
                div.html("[" + formatVal(dataLinScale(d.x0)) +  "-" + formatVal(dataLinScale(d.x1))+ "]");
            }

            let set_mouseout = function(d) {
                div.transition()
                    .duration(50)
                    .style("opacity", 0);
            }

            let set_fill = function(d) {
                var c = cmap(d.x0);
                heatOpts.gradient[d.x1] = c;
                return c;
            };

            let set_height = function(d) {
                return height - y(d.length);
            };

            bar.append("rect")
                .attr("x", 0)
                .attr("width", x(bins[0].x1) - x(bins[0].x0) - 1)
                .attr("height", set_height)
                .attr("fill", set_fill)
                .on("mouseover", set_mouseover)
                .on("mouseout", set_mouseout);

            let fix = 0.000000000001;

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

            var markers = L.markerClusterGroup( {
                iconCreateFunction: histogram.aggregate,
                spiderfyOnMaxZoom: false,
                singleMarkerMode: true
            });
        }
    }

    };

    onInitEditMode() {
        this.addEditorTab( 'Options', 'public/plugins/grafana-map-panel/editor.html', 2);
    }

    onPanelTeardown() {
        this.$timeout.cancel(this.nextTickPromise);
        //console.log("teardown: ", this);
        map_ctrl[mapId]['map'].remove();
        histogram.clean();
        delete map_ctrl[mapId];
        syncMaps();
    }

    link(scope, elem) {
        this.events.on('render', () => {
            //const $panelContainer = elem.find('.panel-container');
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
