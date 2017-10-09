import './leaflet.js';
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
            values = values.map(function(d) { return (d-min)/max;});

            var formatVal = d3.format(",.00f");

            cleanPrevChart(mapId);

            var hist = d3.select(map_ctrl[mapId]['chart_id']);
                //hist.attr("preserveAspectRatio", "xMinYMin meet")
                //hist.attr("viewBox", "0 0 960 500");

            var wrap = $("div#wrap-hist-"+mapId);

            var margin = {top: 0, right: 0, bottom: 0, left: 0},
                width = + wrap.width() - margin.left - margin.right,
                height = + wrap.height() - margin.top - margin.bottom,
                g = hist.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            var x = d3.scaleLinear().rangeRound([0, width]);

            var histogram = d3.histogram()
                .domain(x.domain())
                .thresholds(x.ticks(nbins));

            var bins = histogram(values);
            // Scale the range of the data in the y domain

            var y = d3.scaleLinear()
                .domain([0, d3.max(bins, function(d) { return d.length;  })])
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

            bar.append("rect")
                .attr("x", 0)
                .attr("width", x(bins[0].x1) - x(bins[0].x0) - 1)
                .attr("height", function(d) { return height - y(d.length);  })
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

            data = coords.map(function (p) { return [p.position.lat, p.position.lng, p.value]; });
            var heatLayer = L.heatLayer(data, heatOpts).addTo(myMap);
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

//thanks to: https://github.com/bmschmidt/colorbar
function Colorbar() {

    var scale, // the input scale this represents;
        margin = {top: 5, right: 30, bottom: 25, left: 0}

    var orient = "vertical",
        origin = {
            x: 0,
            y: 0
        }, // where on the parent to put it
        barlength = 100, // how long is the bar
        thickness = 50, // how thick is the bar
        title = "", // title for the colorbar
        scaleType = "linear";

    var checkScaleType = function (scale) {
        // AFAIK, d3 scale types aren't easily accessible from the scale itself.
        // But we need to know the scale type for formatting axes properly
        //Or do we? this variable seems not to be used.
        cop = scale.copy();
        cop.range([0, 1]);
        cop.domain([1, 10]);

        if (typeof(cop.invertExtent)!="undefined") {
            return "quantile"
        }
        if (Math.abs((cop(10) - cop(1)) / Math.log(10) - (cop(10) - cop(2)) / Math.log(5)) < 1e-6) {
            return "log"
        }
        else if (Math.abs((cop(10) - cop(1)) / 9 - (cop(10) - cop(2)) / 8) < 1e-6) {
            return "linear"
        }
        else if (Math.abs((cop(10) - cop(1)) / (Math.sqrt(10) - 1) - (cop(10) - cop(2)) / (Math.sqrt(10) - Math.sqrt(2))) < 1e-6) {
            return "sqrt"
        }
        else {
            return "unknown"
        }
    }

    function chart(selection) {
        var fillLegend,
            fillLegendScale;

        selection.pointTo = function(inputNumbers) {
            var pointer = fillLegend.selectAll(".pointer");
            var pointerWidth = Math.round(thickness*3/4);


            //Also creates a pointer if it doesn't exist yet.
            pointers = fillLegend
                .selectAll('.pointer')
                .data([inputNumbers]);

            pointerSVGdef = function() {
                return (
                    orient=="horizontal" ?
                    'M ' + 0 +' '+ thickness + ' l -' +  pointerWidth + ' -' + pointerWidth + ' l ' + 2*pointerWidth + ' -' + 0 + ' z' :
                    'M ' + thickness +' '+ 0 + ' l -' +  pointerWidth + ' -' + pointerWidth + ' l ' + 0 + ' ' +  2*pointerWidth + ' z'

                )
            }

            pointers
                .enter()
                .append('path')
                .attr('transform',"translate(0," + (
                    fillLegendScale(inputNumbers) - pointerWidth)+ ')'
                )
                .classed("pointer",true)
                .classed("axis",true)
                .attr('d', pointerSVGdef())
                .attr("fill","grey")
                .attr("opacity","0");

            //whether it's new or not, it updates it.
            pointers
                .transition()
                .duration(1000)
                .attr('opacity',1)
                .attr('transform',
                    orient=="vertical" ?
                    "translate(0," + (fillLegendScale(inputNumbers))+ ')':
                    "translate(" + (fillLegendScale(inputNumbers))+ ',0)'
                )
            //and then it fades the pointer out over 5 seconds.
                .transition()
                .delay(2000)
                .duration(3000)
                .attr('opacity',0)
                .remove();
        }

        selection.each(function(data) {

            var scaleType = checkScaleType(scale);
            var thickness_attr;
            var length_attr;
            var axis_orient;
            var position_variable,non_position_variable;
            var axis_transform;

            if (orient === "horizontal") {
                var tmp = [margin.left, margin.right, margin.top, margin.bottom]
                margin.top = tmp[0]
                margin.bottom = tmp[1]
                margin.left = tmp[2]
                margin.right = tmp[3]
                thickness_attr = "height"
                length_attr = "width"
                axis_orient = "bottom"
                position_variable = "x"
                non_position_variable = "y"
                axis_transform = "translate (0," + thickness + ")"
            }

            else {
                thickness_attr = "width"
                length_attr = "height"
                axis_orient = "right"
                position_variable = "y"
                non_position_variable = "x"
                axis_transform = "translate (" + thickness + "," + 0 + ")"
            }

            // select the svg if it exists
            var svg = d3.select(this)
                .selectAll("svg.colorbar")
                .data([origin]);

            // otherwise create the skeletal chart
            var new_colorbars = svg.enter()
                .append("svg")
                .classed("colorbar", true)
                .attr("x",function(d) {return d[0]-margin.right})
                .attr("y",function(d) {return d[1]-margin.top})

            offsetGroup = new_colorbars
                .append("g")
                .classed("colorbar", true)
                .attr("transform","translate(" + margin.left + "," + margin.top + ")")

            offsetGroup.append("g")
                .attr("class","legend rectArea")

            offsetGroup.append("g")
                .attr("class","axis color")

            svg
                .attr(thickness_attr, thickness + margin.left + margin.right)
                .attr(length_attr, barlength + margin.top + margin.bottom)
                .style("margin-top", origin.y - margin.top + "px")
                .style("margin-left", origin.x - margin.left + "px")


            // This either creates, or updates, a fill legend, and drops it
            // on the screen. A fill legend includes a pointer chart can be
            // updated in response to mouseovers, because that's way cool.

            fillLegend = svg.selectAll("g.colorbar")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            fillLegendScale = scale.copy();

            if (typeof(fillLegendScale.invert)=="undefined") {
                //console.log("assuming it's a quantile scale")
                fillLegendScale = d3.scale
                    .linear()
                    .domain(d3.extent(fillLegendScale.domain()))
            }

            var legendRange = d3.range(
                0, barlength,
                by=barlength / (fillLegendScale.domain().length - 1));

            legendRange.push(barlength);

            if (orient=="vertical") {
                //Vertical should go bottom to top, horizontal from left to right.
                //This should be changeable in the options, ideally.
                legendRange.reverse()
            }
            fillLegendScale.range(legendRange);

            colorScaleRects = fillLegend
                .selectAll("rect.legend")
                .data(d3.range(0, barlength));

            colorScaleRects
                .enter()
                .append("rect")
                .attr("class", "legend")
                .style("opacity", 0)
                .style("stroke-thickness", 0)
                .style("fill", function(d) {
                    return scale(fillLegendScale.invert(d));
                })

            colorScaleRects
                .exit()
                .remove();

            //Switch to using the original selection so that the transition will be inheirited
            selection
                .selectAll("rect.legend")
                .style("opacity", 1)
                .attr(thickness_attr, thickness)
                .attr(length_attr, 2) // single pixel thickness produces ghosting on some browsers
                .attr(position_variable, function(d) {return d;})
                .attr(non_position_variable, 0)
                .style("fill", function(d) {
                    return scale(fillLegendScale.invert(d));
                })


            colorAxisFunction = d3.svg.axis()
                .scale(fillLegendScale)
                .orient(axis_orient);

            if (typeof(scale.quantiles) != "undefined") {
                quantileScaleMarkers = scale.quantiles().concat( d3.extent(scale.domain()))
                console.log(quantileScaleMarkers)
                colorAxisFunction.tickValues(quantileScaleMarkers)
            }

            //Now make an axis
            fillLegend.selectAll(".color.axis")
                .attr("transform", axis_transform)
                .call(colorAxisFunction);

            //make a title
            titles = fillLegend.selectAll(".axis.title")
                .data([{label: title}])
                .attr("id", "#colorSelector")
                .attr('transform', 'translate (0, -10)')
                .style("text-anchor", "middle")
                .text(function(d) {return d.label});

            titles
                .exit()
                .remove();

            //            return this;
        });
    }

    function prettyName(number) {

        var comparisontype = comparisontype || function() {return ""}

        if (comparisontype()!='comparison') {
            suffix = ''
            switch(true) {
                case number>=1000000000:
                    number = number/1000000000
                    suffix = 'B'
                    break;
                case number>=1000000:
                    number = number/1000000
                    suffix = 'M'
                    break;
                case number>=1000:
                    number = number/1000
                    suffix = 'K'
                    break;
            }
            if (number < .1) {
                return(Math.round(number*100)/100+suffix)
            }
            return(Math.round(number*10)/10+suffix)
        }
        if (comparisontype()=='comparison') {
            if (number >= 1) {return(Math.round(number)) + ":1"}
            if (number < 1) {return("1:" + Math.round(1/number))}
        }
    }

    //getter-setters
    chart.origin = function(value) {
        if (!arguments.length) return origin;
        origin = value;
        return chart;
    }

    chart.margin = function(value) {
        if (!arguments.length) return margin;
        margin = value;
        return chart;
    }

    chart.thickness = function(value) {
        if (!arguments.length) return thickness;
        thickness = value;
        return chart;
    }

    chart.barlength = function(value) {
        if (!arguments.length) return barlength;
        barlength = value;
        return chart;
    }

    chart.title = function(value) {
        if (!arguments.length) return title;
        title = value;
        return chart;
    }

    chart.scale = function(value) {
        if (!arguments.length) return scale;
        scale = value;
        return chart;
    }

    chart.orient = function(value) {
        if (!arguments.length) return orient;
        if (value === "vertical" || value === "horizontal")
            orient = value;
        else
            console.warn("orient can be only vertical or horizontal, not", value);
        orient = value;
        return chart;
    }

    return chart;
}

