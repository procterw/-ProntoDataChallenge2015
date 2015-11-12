// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Map Factory             //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Functions for rendering the map components
(function() {

  angular.module("App")
    .factory("MapFactory", MapFactory);

  MapFactory.$inject = ["$rootScope"];

  function MapFactory($rootScope) {

    var Factory = {};

    // var _currentTime = 0;

    // Factory.setTime = function(time) { _currentTime = time; }

    Factory.Map = new Map("#mapCanvas");
    Factory.Stations = new Stations("#stationCanvas");
    Factory.Bikes = new Bikes("#bikeCanvas");
    Factory.Timeseries = new Timeseries("#timeseriesCanvas");

    var transforms = {
      zoom: 1,
      translation: [0, 0]
    };

    var red = "#D37363";
    var blue = "#88B5BF";
    var purple = "#A493A5";


    return Factory;

    // Returns the scale for retina screens
    function findRetina(ctx) {

      // Find retina zoom level
      var devicePixelRatio = window.devicePixelRatio || 1;
      var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
        ctx.mozBackingStorePixelRatio ||
        ctx.msBackingStorePixelRatio ||
        ctx.oBackingStorePixelRatio ||
        ctx.backingStorePixelRatio || 1;

      return devicePixelRatio / backingStoreRatio;

    }

    function makeXYScales(width, height, retina) {

      var mapCenterX = -122.3425;
      var mapCenterY = 47.63;

      function scale(x, axis) {
        return transforms.zoom * (transforms.translation[axis] + x);
      }

      // Update x and y scales with new domain and range.
      // The domain has to change because we don't want it to scale down
      // at small sizes
      var screenScale = Math.min(250, width, height);

      var xScale = d3.scale.linear()
        .domain([
          mapCenterX - 0.016 * (width / screenScale) / retina,
          mapCenterX + 0.016 * (width / screenScale) / retina
        ])
        .range([0, width / retina]);

      // Round values to the nearest 1/2
      xScale.round = function(x) {
        if (retina < 2) return x;
        return Math.round(this(x) * retina) / retina;
      }

      var yScale = d3.scale.linear()
        .domain([
          mapCenterY - 0.011 * (height / screenScale) / retina,
          mapCenterY + 0.011 * (height / screenScale) / retina
        ])
        .range([height / retina, 0]);

      // Round values to the nearest 1/2
      yScale.round = function(y) {
        if (retina < 2) return x;
        return Math.round(this(y) * retina) / retina;
      }

      return {
        x: xScale,
        y: yScale
      };

    }

    function makeSunScale(sunriset, night, day) {
      var sunrise = sunriset[1];
      var sunset = sunriset[0];
      return d3.scale.linear()
        .domain([0, sunrise - 60, sunrise + 60, sunset - 60, sunset + 60, (25 * 60)])
        .range([night, night, day, day, night, night]);
    }




    function getCurrentLocation(trip, time) {

      var t1, t2, dt;

      if (trip.stoptime_min < time) {

        return [trip.stopCoords[1], trip.stopCoords[0], 2 * Math.PI];

      } else if (trip.from_station_id === trip.to_station_id) {

        t1 = +trip.starttime_min; // time in minutes
        t2 = +trip.stoptime_min; // time in minutes
        dt = time - t1;

        // How far around?
        var theta = Math.PI * 2 * (dt / (t2 - t1));

        return [
          trip.startCoords[1] + (Math.cos(theta) * 0.0018),
          trip.startCoords[0] + (Math.sin(theta) * 0.0012),
          theta
        ];

      } else {

        var x1 = trip.startCoords[1];
        var y1 = trip.startCoords[0];
        var x2 = trip.stopCoords[1];
        var y2 = trip.stopCoords[0];
        t1 = +trip.starttime_min; // time in minutes
        t2 = +trip.stoptime_min; // time in minutes
        dt = time - t1;

        var rateX = (x2 - x1) / (t2 - t1);
        var rateY = (y2 - y1) / (t2 - t1);

        return [
          (x1 + dt * rateX), (y1 + dt * rateY)
        ];

      }

    }


    function zoom() {
      transforms.translation = d3.event.translate;
      transforms.zoom = d3.event.scale;
      Factory.Bikes.resize();
      Factory.Stations.render();
      Factory.Map.render();
      Factory.Bikes.render();
    }











    function Map(id) {

      var Map = this;

      var _canvas = d3.select(id);

      // Internal coordinates data
      var _coordinates = [];
      var _fillScale; // scale for 
      var _strokeScale; // scale for 
      var _xScale; // coordinates -> xy
      var _yScale; // coordinates -> xy
      var _currentTime = 0; // current time in minutes
      var _ctx = _canvas.node().getContext('2d');
      var _retina = findRetina(_ctx); // 1 for non retina, 1+ for retina

      var _width, _height;

      Map.setCoordinates = setCoordinates;
      Map.setColorScales = setColorScales;
      Map.setTime = setTime;
      Map.resize = resize;

      Map.needsNewFill = needsNewFill;

      Map.render = render;

      return Map;

      function setCoordinates(coords) {
        _coordinates = coords;
      }

      function setColorScales(sunriset) {
        // sunriset, night color, day color
        _fillScale = makeSunScale(sunriset, "#544A45", "#E0D7CE");
        _strokeScale = makeSunScale(sunriset, "#5B5552", "#F7F7F7");
        _waterScale = makeSunScale(sunriset, "#585F60", "#CCD6D3");
      }

      function setTime(time) {
        _currentTime = time;
      }

      function needsNewFill(time) {
        return _fillScale(time) !== _fillScale(_currentTime);
      }

      function resize() {

        // find new bounding box
        var bbox = _canvas.node().parentNode.getBoundingClientRect();

        _width = bbox.width * _retina;
        _height = bbox.height * _retina;

        // Resize canvases
        _canvas.attr("width", _width);
        _canvas.attr("height", _height);

        _canvas.style("width", _width / _retina + "px");
        _canvas.style("height", _height / _retina + "px");

        _ctx.scale(_retina,_retina)

        var scale = Factory.Stations.getScales();

        _xScale = scale.x;
        _yScale = scale.y;


      }

      function clear() {
        _ctx.clearRect(0, 0, _width, _height);
      }

      function render() {

        // Clear context save it's state, then apply current
        // translation and zoom
        clear();
        // _ctx.save();
        // _ctx.translate(transforms.translation[0], transforms.translation[1]);
        // _ctx.scale(transforms.zoom * _retina, transforms.zoom * _retina);

        _ctx.fillStyle = _waterScale(_currentTime % (24 * 60));
        _ctx.fillRect(0,0,_width,_height);

        // Apply style attributes and draw polygons
        _ctx.fillStyle = _fillScale(_currentTime % (24 * 60));
        _ctx.strokeStyle = _strokeScale(_currentTime % (24 * 60));
        _ctx.lineWidth = 1;

        // ctx.beginPath();
        // For each polygon, move the line path and continue drawing until
        // that poylgon is finished
        _ctx.beginPath();

        for (var i = 0; i < _coordinates.length; i++) {

          var polygon = _coordinates[i];
          
          _ctx.moveTo(_xScale.round(polygon[0].x), _yScale.round(polygon[0].y));

          for (var k = 1; k < polygon.length; k++) {
            _ctx.lineTo(_xScale.round(polygon[k].x), _yScale.round(polygon[k].y));
          }

        }

        _ctx.fill();
        _ctx.stroke();

        // Restore previous state
        // _ctx.restore();

      }


    }











    function Stations(id) {

      var Stations = this;

      var _canvas = d3.select(id);

      // Internal coordinates data
      var _stations = [];
      var _fillScale; // scale for
      var _strokeScale;
      var _hoveredStation = -1;
      var _xScale; // coordinates -> xy
      var _yScale; // coordinates -> xy
      var _currentTime = 0; // current time in minutes
      var _ctx = _canvas.node().getContext('2d');
      var _retina = findRetina(_ctx); // 1 for non retina, 1+ for retina
      
      var _userFilter = "AO";
      var _ageFilter = "all"

      var _plotType;

      var _width, _height;

      Stations.setStations = setStations;
      Stations.setColorScale = setColorScale;
      Stations.setTime = setTime;
      Stations.resize = resize;
      Stations.reset = reset;
      Stations.getScales = getScales;

      Stations.getData = getData;

      Stations.setUserFilter = setUserFilter;
      Stations.setAgeFilter = setAgeFilter;

      Stations.getHoveredStation = getHoveredStation;

      Stations.removeBikes = removeBikes;
      Stations.addBike = addBike;

      Stations.render = render;

      _canvas.on("mousemove", mousemove);

      return Stations;

      function getHoveredStation() {
        // case: there's no hovered station, so instead return
        // 
        // if (_hoveredStation < 0) {

        // }
        return _stations[_hoveredStation];
      }

      function getData() {
        return _stations;
      }

      function mousemove(d,i) {
        var x = d3.event.offsetX;
        var y = d3.event.offsetY;
        var closestDist = 999;
        var xDist = 999;
        var yDist = 999;
        var previousStation = _hoveredStation;
        _hoveredStation = -1;
        angular.forEach(_stations, function(s,i) {
          if (isInBoundingRect(x,y,s)) {
            _hoveredStation = i;
          };
        });
        if (_hoveredStation !== previousStation) {
          $rootScope.$apply();
          render();
          Factory.Timeseries.render(_stations[_hoveredStation]);
        }
      }

      function reset() {
        clear();
        _stations.forEach(function(s) {
          s.bikeCount = 0;
          s.departures = [];
          s.arrivals = [];
        });
      }

      // Is the given pair of coordinates inside of the bounding
      // rectangle of a given station?
      function isInBoundingRect(x,y,station) {

        // Define bounding rectangle
        var x1 = _xScale(station.long) - 8;
        var x2 = _xScale(station.long) + 8;
        var y1 = _yScale(station.lat) - Math.max(8, station.arrivals.length / 4);
        var y2 = _yScale(station.lat) + Math.max(8, station.departures.length / 4);
        
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;

      }

      function setStations(stations) {
        _stations = stations;
        reset();
      }

      function setColorScale(sunriset) {
        // sunriset, night color, day color
        _fillScale = makeSunScale(sunriset, "#999", "#FFF");
        _strokeScale = makeSunScale(sunriset, "#4C4440", "#E2DCD5");
      }

      function setTime(time) {
        _currentTime = time;
      }

      function removeBikes(data) {
        angular.forEach(data, function(d) {
          _stations.forEach(function(s) {
            if (s.terminal === d.from_station_id) {
              s.bikeCount--;
              s.departures.push({
                age: d.age,
                usertype: d.usertype,
                time: d.starttime_min
              })
            }
          });
        });
      }

      function addBike(terminal,usertype,age,time) {
        _stations.forEach(function(s) {
          if (s.terminal === terminal) {
            s.bikeCount++;
            s.arrivals.push({
              age: age,
              usertype: usertype,
              time: time
            })
          }
        });
      }

      var init = true;

      function resize() {

        // find new bounding box
        var bbox = _canvas.node().parentNode.getBoundingClientRect();

        _width = bbox.width * _retina;
        _height = bbox.height * _retina;

        // Resize canvases
        _canvas.attr("width", _width);
        _canvas.attr("height", _height);

        _canvas.style("width", _width / _retina + "px");
        _canvas.style("height", _height / _retina + "px");

        var scale = makeXYScales(_width, _height, _retina);

        _ctx.scale(_retina,_retina)

        _xScale = scale.x;
        _yScale = scale.y;

        d3.selectAll(".canvas").call(d3.behavior.zoom()
          .x(_xScale)
          .y(_yScale)
          .scaleExtent([0.7, 4])
          .on("zoom", zoom));

      }

      function getScales() {
        return {
          x: _xScale,
          y: _yScale
        }
      }

      function setUserFilter(filter) {
        _userFilter = filter;
      }

      function setAgeFilter(filter) {
        _ageFilter = filter;
      }

      function clear() {
        _ctx.clearRect(0, 0, _width, _height);
      }

      function render(plotType) {

        // Save plot type
        _plotType = plotType || _plotType;

        clear();
        // _ctx.save();
        // _ctx.translate(transforms.translation[0], transforms.translation[1]);
        // _ctx.scale(transforms.zoom * _retina, transforms.zoom * _retina);

        // Math constants
        var r = 8;
        var T = 2 * Math.PI;

        _ctx.lineWidth = 1;
        _ctx.strokeStyle = _strokeScale ? _strokeScale(_currentTime) : "#CCC";

        for (var i = 0; i < _stations.length; i++) {

          // hovered behavior
          var isHoveredStation = _hoveredStation === i;
          var addedSize = isHoveredStation ? 1 : 0;

          var station = _stations[i];

          // Canvas xy coordinates for rendering
          var x = _xScale.round(+station.long);
          var y = _yScale.round(+station.lat);

          

          var arrivals = station.arrivals.filter(function(d) {
            var user = _userFilter === "AO" || d.usertype === _userFilter;
            var age = _ageFilter === "all" || d.age === _ageFilter;
            return user && age;
          }).length;

          var departures = station.departures.filter(function(d) {
            var user = _userFilter === "AO" || d.usertype === _userFilter;
            var age = _ageFilter === "all" || d.age === _ageFilter;
            return user && age;
          }).length;

          

          // Initial plot
          if (!_plotType) {
            drawblank(x,y,5)
          }

          if (_plotType === "usage") {

            var r = 5;

            // var spacing = isHoveredStation ? 3 : 2;

            var rowLength = 12;
            var sqSide = 2 + (addedSize / 2); // square side in pixels

            // Number of rows
            var nrowArrivals = Math.floor(arrivals / rowLength);
            var nrowDepartures = Math.floor(departures / rowLength);
            var remainderArrivals = arrivals % rowLength;
            var remainderDepartures = departures % rowLength;   

            drawArrivals(rowLength,sqSide,nrowArrivals,nrowDepartures,remainderArrivals,remainderDepartures);
            drawDepartures(rowLength,sqSide,nrowArrivals,nrowDepartures,remainderArrivals,remainderDepartures);
            drawblank(x,y,r)

          }
        }

        function drawblank(x,y,r) {
          _ctx.beginPath();
          _ctx.arc(x, y, r + addedSize, 0, T);
          _ctx.fillStyle = _fillScale(_currentTime);
          _ctx.lineWidth = 2;
          _ctx.fill();
          _ctx.stroke();
        }

        function drawArrivals(rowLength,sqSide,nrowArrivals,nrowDepartures,remainderArrivals,remainderDepartures) {
          _ctx.fillStyle = blue;
          // draw big row
          if (nrowArrivals > 0) {
            _ctx.fillRect(x - (rowLength/2*sqSide), y, rowLength*sqSide, -(nrowArrivals)*sqSide);
          }
          if (remainderArrivals > 0) {
            _ctx.fillRect(x - (rowLength/2*sqSide), y - (nrowArrivals)*sqSide, remainderArrivals*sqSide, -sqSide);
          }
        }

        function drawDepartures(rowLength,sqSide,nrowArrivals,nrowDepartures,remainderArrivals,remainderDepartures) {
          _ctx.fillStyle = red;
          // draw big row
          if (nrowDepartures > 0) {
            _ctx.fillRect(x - (rowLength/2*sqSide), y, rowLength*sqSide, (nrowDepartures)*sqSide);
          }
          if (remainderDepartures > 0) {
            _ctx.fillRect(x - (rowLength/2*sqSide), y + (nrowDepartures)*sqSide, remainderDepartures*sqSide,sqSide);
          }
        }

      }

    }








    function Bikes(id) {

      var Bikes = this;

      var _canvas = d3.select(id);

      // Internal coordinates data
      var _rawData = [];
      var _positionData = [];
      var _strokeScale;
      var _xScale; // coordinates -> xy
      var _yScale; // coordinates -> xy
      var _currentTime = 0; // current time in minutes
      var _ctx = _canvas.node().getContext('2d');
      var _retina = findRetina(_ctx); // 1 for non retina, 1+ for retina
      
      var _userFilter = "AO";
      var _ageFilter = "all";

      var _width, _height;

      Bikes.addData = addData;
      Bikes.setColorScale = setColorScale;
      Bikes.setTime = setTime;
      Bikes.resize = resize;
      Bikes.reset = reset;

      Bikes.setUserFilter = setUserFilter;
      Bikes.setAgeFilter = setAgeFilter;

      Bikes.render = render;

      return Bikes;

      function addData(data) {
        Factory.Stations.removeBikes(data);
        _rawData = _rawData.concat(data);
        getPositions();
      }

      // Converts raw data to position data
      function getPositions() {

        angular.forEach(_rawData, function(d) {
          if (!d.finished && d.stoptime_min < _currentTime) {
            d.finished = true;
            Factory.Stations.addBike(d.to_station_id, d.usertype, d.age, d.stoptime_min);
          }
        });

        var pathFadeTime = 60;

        // Filter out data that is too old
        _rawData = _rawData.filter(function(d) {
          return (_currentTime - d.stoptime_min) < pathFadeTime;
        });

        _positionData = _rawData.map(function(d) {
          var current = getCurrentLocation(d, _currentTime);
          var sameStation = d.from_station_id === d.to_station_id;
          return {
            age: d.age,
            usertype: d.usertype,
            current: [current[0], current[1], current[2]],
            start: [d.startCoords[1], d.startCoords[0]],
            sameStation: sameStation,
            opacity: _currentTime > d.stoptime_min ? (pathFadeTime + d.stoptime_min - _currentTime) / pathFadeTime : 1
          };
        }).filter(function(d) {
          var user = _userFilter === "AO" || d.usertype === _userFilter;
          var age = _ageFilter === "all" || d.age === _ageFilter;
          return user && age;
        });

      }

      function setUserFilter(filter) {
        _userFilter = filter;
      }

      function setAgeFilter(filter) {
        _ageFilter = filter;
      }

      function setColorScale(sunriset) {
        // sunriset, night color, day color
        _strokeScale = makeSunScale(sunriset, "#F2EABD", "#4B756D");
      }

      function setTime(time) {
        _currentTime = time;
      }

      function resize() {

        // find new bounding box
        var bbox = _canvas.node().parentNode.getBoundingClientRect();

        _width = bbox.width * _retina;
        _height = bbox.height * _retina;

        // Resize canvases
        _canvas.attr("width", _width);
        _canvas.attr("height", _height);

        _canvas.style("width", _width / _retina + "px");
        _canvas.style("height", _height / _retina + "px");

        _ctx.scale(_retina,_retina)

        var scale = Factory.Stations.getScales();

        _xScale = scale.x;
        _yScale = scale.y;

      }

      function reset() {
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
        clear();
        _rawData = [];
        _positionData = [];
      }

      function clear() {
        _ctx.clearRect(0, 0, _width, _height);
      }

      function render() {

        clear();
        // _ctx.save();
        // _ctx.translate(transforms.translation[0], transforms.translation[1]);
        // _ctx.scale(transforms.zoom * _retina, transforms.zoom * _retina);

        _ctx.strokeStyle = _strokeScale(_currentTime);
        _ctx.lineWidth = 2;

        // _ctx.save();

        // Draw the fading lines
        angular.forEach(_positionData.filter(function(bike) {
          return bike.opacity < 1;
        }), function(bike) {

          // Each fading bike has a different opacity which is some fraction of 0.15
          
          _ctx.globalAlpha = Math.round(50 * bike.opacity * 0.22) / 50;
          _ctx.beginPath();

          if (bike.sameStation) {
            _ctx.arc(_xScale.round(bike.start[0]), _yScale.round(bike.start[1]), 14*transforms.zoom, -bike.current[2], 0);
          } else {
            // _ctx.moveTo(_xScale.round(bike.start[0]), _yScale.round(bike.start[1]));
            // _ctx.lineTo(_xScale.round(bike.current[0]), _yScale.round(bike.current[1]));
          }

          _ctx.stroke();
          
        });

        // _ctx.restore();

        // Active bikes always have opacity 0.15
        _ctx.globalAlpha = 0.2;
        _ctx.beginPath();

        // Active bike lines
        angular.forEach(_positionData.filter(function(bike) {
          return bike.opacity === 1;
        }), function(bike) {

          if (bike.sameStation) {
            _ctx.moveTo(_xScale.round(bike.start[0]), _yScale.round(bike.start[1]));
            _ctx.arc(_xScale.round(bike.start[0]), _yScale.round(bike.start[1]), 14*transforms.zoom, -bike.current[2], 0);
          } else {
            _ctx.moveTo(_xScale.round(bike.start[0]), _yScale.round(bike.start[1]));
            _ctx.lineTo(_xScale.round(bike.current[0]), _yScale.round(bike.current[1]));
          } 

        });
    
        _ctx.stroke();    
        
        // Draw active bikes
        _ctx.globalAlpha = 1;
        angular.forEach(_positionData.filter(function(bike) {
          return bike.opacity > 0.95;
        }), function(bike) {
          _ctx.beginPath();
          _ctx.arc(_xScale.round(bike.current[0]), _yScale.round(bike.current[1]), 2, 0, Math.PI * 2);
          _ctx.fillStyle = "#DDD";
          _ctx.fill();
        });

        // _ctx.restore();

      }

    }











    function Timeseries(id) {

      var Timeseries = {};

      var _canvas = d3.select(id);

      // Internal coordinates data
      var _xScale; // coordinates -> xy
      var _yScale; // coordinates -> xy
      var _currentTime = 0; // current time in minutes
      var _ctx = _canvas.node().getContext('2d');
      var _retina = findRetina(_ctx); // 1 for non retina, 1+ for retina
      
      var _userFilter = "AO";
      var _ageFilter = "all";

      var _width, _height;

      Timeseries.setColorScale = setColorScale;
      Timeseries.setTime = setTime;
      Timeseries.resize = resize;
      // Timeseries.reset = reset;

      Timeseries.setUserFilter = setUserFilter;
      Timeseries.setAgeFilter = setAgeFilter;

      Timeseries.render = render;

      return Timeseries;

      function getData() {

      }

      function setUserFilter(filter) {
        _userFilter = filter;
      }

      function setAgeFilter(filter) {
        _ageFilter = filter;
      }

      function setColorScale(sunriset) {
        // sunriset, night color, day color
        _strokeScale = makeSunScale(sunriset, "#F2EABD", "#4B756D");
      }

      function setTime(time) {
        _currentTime = time;
      }
      
      function resize() {

        // find new bounding box
        var bbox = _canvas.node().parentNode.getBoundingClientRect();

        _width = 140 * _retina;
        _height = bbox.height * _retina;
        _plotWidth = 60;

        // Resize canvases
        _canvas.attr("width", _width);
        _canvas.attr("height", _height);

        _canvas.style("width", _width / _retina + "px");
        _canvas.style("height", _height / _retina + "px");
        // _canvas.style("padding-left", 320 + "px");

        _ctx.scale(_retina,_retina)

        _xScale = d3.scale.linear().domain([0,24*60]).range([10,(_height)/_retina - 30]);
        _yScale = d3.scale.linear().domain([0,200]).range([0,20]);

      }

      function render(selection) {

        var scalar = selection ? 14 : 1;

        if (selection === "all" || !selection) {

          // Current stations dataset
          var data = Factory.Stations.getData();

          // All of the departures
          var departures = data.map(function(station) {
            return station.departures;
          }).reduce(function(prev, cur) {
            return prev.concat(cur);
          });

          // All of the arrivals
          var arrivals = data.map(function(station) {
            return station.arrivals;
          }).reduce(function(prev, cur) {
            return prev.concat(cur);
          });

        } else {

          var departures = selection.departures;
          var arrivals = selection.arrivals

        }

        var departureTimes = departures.filter(function(d) {
          var user = _userFilter === "AO" || d.usertype === _userFilter;
          var age = _ageFilter === "all" || d.age === _ageFilter;
          return user && age;
        }).map(function(s) {
          return Math.floor(s.time/5) * 5;
        });

        var arrivalTimes = arrivals.filter(function(d) {
          var user = _userFilter === "AO" || d.usertype === _userFilter;
          var age = _ageFilter === "all" || d.age === _ageFilter;
          return user && age;
        }).map(function(s) {
          return Math.floor(s.time/5) * 5;
        });

        var departuresHist = d3.layout.histogram()
          .bins(_xScale.ticks(5*24))(departureTimes);

        var arrivalsHist = d3.layout.histogram()
          .bins(_xScale.ticks(5*24))(arrivalTimes);

        _ctx.clearRect(0,0,_width,_height);

        var d1;
        var d2;
        var diff;

        // JUST red bars
        _ctx.fillStyle = red;
        for (var i=0; i<Math.floor(_currentTime/5); i++){
          d1 = departuresHist[i];
          d2 = arrivalsHist[i];
          if (d1 && d1.y > d2.y) _ctx.fillRect(d1.y,_xScale(d1.x),(d2.y-d1.y)*scalar,4);
        }

        _ctx.fillStyle = blue;
        for (var i=0; i<Math.floor(_currentTime/5) * 5; i++){
          d2 = departuresHist[i];
          d1 = arrivalsHist[i];
          if (d1 && d1.y > d2.y) _ctx.fillRect(d1.y,_xScale(d1.x),(d2.y-d1.y)*scalar,4);
        }

        _ctx.fillStyle = purple;
        for (var i=0; i<Math.floor(_currentTime/5) * 5; i++){
          d2 = departuresHist[i];
          d1 = arrivalsHist[i];
          if (d1) _ctx.fillRect(0,_xScale(d1.x),Math.min(d1.y,d2.y)*scalar,4);
        }

        _ctx.fillStyle = "rgba(0,0,0,0.3)";
        _ctx.fillRect(45,_xScale(_currentTime)-12,70,22);

        _ctx.fillStyle = "white";
        // _ctx.font = "18px Work Sans";
        
        _ctx.font = "10px Work Sans";
        for (var i=0;i<13;i++) {
          var time = formatTime(i*60*2).split(",")[0];
          _ctx.fillText(time,5,_xScale(i*60*2));
        }

        _ctx.font = "14px Work Sans";
        var time = formatTime(_currentTime).split(",");
        _ctx.fillText(time[0],50,_xScale(_currentTime)+3);
        _ctx.fillText(time[1],90,_xScale(_currentTime)+3);

        


      }

    }



  }

  function formatTime(time) {

    if (!time) return "04:00,AM";

    var hours = (Math.floor(time / 60) + 4);
    var minutes = Math.round(time % 60);

    var ampm = hours < 12 || hours > 23 ? "AM" : "PM";
    hours = hours % 12;
    if (hours === 0) hours = 12;

    if (hours < 10) hours = "0" + hours;
    if (minutes < 10) minutes = "0" + minutes;
    return hours + ":" + minutes + "," + ampm;

  }


})();

