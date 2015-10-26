// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Map Factory             //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Functions for rendering the map components
(function() {

  angular.module("App")
    .factory("MapFactory", MapFactory);

  MapFactory.$inject = [];

  function MapFactory() {

    var Factory = {};

    // var _currentTime = 0;

    // Factory.setTime = function(time) { _currentTime = time; }

    Factory.Water = new Water();
    Factory.Map = new Map("#mapCanvas");
    Factory.Stations = new Stations("#stationCanvas");
    Factory.Bikes = new Bikes("#bikeCanvas");


    var transforms = {
      zoom: 1,
      translation: [0, 0]
    };


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

      var mapCenterX = -122.3215;
      var mapCenterY = 47.63;

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

      var yScale = d3.scale.linear()
        .domain([
          mapCenterY - 0.011 * (height / screenScale) / retina,
          mapCenterY + 0.011 * (height / screenScale) / retina
        ])
        .range([height / retina, 0]);

      return {
        x: xScale,
        y: yScale
      };

    }

    function makeSunScale(sunriset, night, day) {
      var sunrise = sunriset[1];
      var sunset = sunriset[0];
      sunrise = sunrise[0] * 60 + sunrise[1]; // which minute of day is it
      sunset = sunset[0] * 60 + sunset[1]; // which minute of day is it
      return d3.scale.linear()
        .domain([0, sunrise - 30, sunrise + 30, sunset - 30, sunset + 30, (25 * 60)])
        .range([night, night, day, day, night, night]);
    }



    function Water() {

      var Water = this;

      var _fillScale;

      Water.setColorScale = setColorScale;
      Water.getColor = getColor;

      function setColorScale(sunriset) {
        // sunriset, night color, day color
        _fillScale = makeSunScale(sunriset, "#3A4851", "#BAD3D0");
      }

      function getColor(time) {
        return _fillScale(time);
      }

    }



    function getCurrentLocation(trip, time) {

      var t1, t2, dt;

      if (trip.stoptime_min < time) {

        return [trip.stopCoords[1], trip.stopCoords[0], 2 * Math.PI];

      } else if (trip.from_station_id === trip.to_station_id) {

        t1 = +trip.starttime_min; // time in minutes
        t2 = +trip.stoptime_min; // time in minutes
        dt = time - t1;

        var r = 0.0015;

        // How far around?
        var theta = Math.PI * 2 * (dt / (t2 - t1));

        return [
          trip.startCoords[1] + (Math.cos(theta) * r),
          trip.startCoords[0] + (Math.sin(theta) * r),
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

      Map.render = render;

      return Map;

      function setCoordinates(coords) {
        _coordinates = coords;
      }

      function setColorScales(sunriset) {
        // sunriset, night color, day color
        _fillScale = makeSunScale(sunriset, "#3F3C3A", "#E2DCD5");
        _strokeScale = makeSunScale(sunriset, "#454545", "#F7F7F7");
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

        var scale = makeXYScales(_width, _height, _retina);

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
        _ctx.save();
        _ctx.translate(transforms.translation[0], transforms.translation[1]);
        _ctx.scale(transforms.zoom * _retina, transforms.zoom * _retina);

        // Apply style attributes and draw polygons
        _ctx.fillStyle = _fillScale(_currentTime % (24 * 60));
        _ctx.strokeStyle = _strokeScale(_currentTime % (24 * 60));
        _ctx.lineWidth = 1;

        // ctx.beginPath();
        // For each polygon, move the line path and continue drawing until
        // that poylgon is finished
        for (var i = 0; i < _coordinates.length; i++) {

          var polygon = _coordinates[i];
          _ctx.beginPath();
          _ctx.moveTo(_xScale(polygon[0].x), _yScale(polygon[0].y));

          for (var k = 1; k < polygon.length; k++) {
            _ctx.lineTo(_xScale(polygon[k].x), _yScale(polygon[k].y));
          }

          _ctx.fill();
          _ctx.stroke();

        }

        // Restore previous state
        _ctx.restore();

      }


    }




    function Stations(id) {

      var Stations = this;

      var _canvas = d3.select(id);
      _canvas.call(d3.behavior.zoom()
        .scaleExtent([0.5, 2])
        .on("zoom", zoom));

      // Internal coordinates data
      var _coordinates = [];
      var _fillScale; // scale for
      var _strokeScale;
      var _xScale; // coordinates -> xy
      var _yScale; // coordinates -> xy
      var _currentTime = 0; // current time in minutes
      var _ctx = _canvas.node().getContext('2d');
      var _retina = findRetina(_ctx); // 1 for non retina, 1+ for retina

      var _width, _height;

      Stations.setCoordinates = setCoordinates;
      Stations.setColorScale = setColorScale;
      Stations.setTime = setTime;
      Stations.resize = resize;

      Stations.render = render;

      return Stations;

      function setCoordinates(coords) {
        _coordinates = coords;
      }

      function setColorScale(sunriset) {
        // sunriset, night color, day color
        _fillScale = makeSunScale(sunriset, "#666", "#FFF");
        _strokeScale = makeSunScale(sunriset, "#3F3C3A", "#E2DCD5");
      }

      function setTime(time) {
        _currentTime = time;
      }

      // Takes ride data and uses it to add and remove 
      // counts
      // function updateCounts(data) {
      //   angular.forEach(data, function(d) {
      //     _coordinates.removeBike(d.from_station_id);
      //     if ((time - d.stoptime_min) >= pathFadeTime) {
      //       _coordinates.addBike(d.to_station_id)
      //     }
      //   });
      // }

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

        _xScale = scale.x;
        _yScale = scale.y;


      }

      function zoom() {
        transforms.translation = d3.event.translate;
        transforms.zoom = d3.event.scale;
        render();
        Factory.Map.render();
      }

      function clear() {
        _ctx.clearRect(0, 0, _width, _height);
      }

      function render() {

        clear();
        _ctx.save();
        _ctx.translate(transforms.translation[0], transforms.translation[1]);
        _ctx.scale(transforms.zoom * _retina, transforms.zoom * _retina);

        // Math constants
        var r = 8;
        var T = 2 * Math.PI;

        _ctx.lineWidth = 2;
        _ctx.strokeStyle = _strokeScale(_currentTime);

        for (var i = 0; i < _coordinates.length; i++) {

          var station = _coordinates[i];

          var x = _xScale(+station.long);
          var y = _yScale(+station.lat);

          _ctx.beginPath();
          _ctx.arc(x, y, r + 1, 0, T);
          _ctx.fillStyle = _fillScale(_currentTime);
          _ctx.fill();
          _ctx.stroke();

        }

        // Restore previous state
        _ctx.restore();


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

      var _width, _height;

      Bikes.addData = addData;
      Bikes.setColorScale = setColorScale;
      Bikes.setTime = setTime;
      Bikes.resize = resize;
      Bikes.reset = reset;

      Bikes.render = render;

      return Bikes;

      function addData(data) {
        // Factory.Stations.updateCounts(data);
        _rawData = _rawData.concat(data);
        getPositions();
      }

      // Converts raw data to position data
      function getPositions() {

        var pathFadeTime = 60;

        // Filter out data that is too old
        _rawData = _rawData.filter(function(d) {
          return (_currentTime - d.stoptime_min) < pathFadeTime;
        });

        _positionData = _rawData.map(function(d) {
          var current = getCurrentLocation(d, _currentTime);
          var sameStation = d.from_station_id === d.to_station_id;
          return {
            current: [_xScale(current[0]), _yScale(current[1]), current[2]],
            start: [_xScale(d.startCoords[1]), _yScale(d.startCoords[0])],
            sameStation: sameStation,
            opacity: _currentTime > d.stoptime_min ? (pathFadeTime + d.stoptime_min - _currentTime) / pathFadeTime : 1
          };
        });

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

        var scale = makeXYScales(_width, _height, _retina);

        _xScale = scale.x;
        _yScale = scale.y;

      }

      function reset() {
        clear();
        _rawData = [];
        _positionData = [];
      }

      function clear() {
        _ctx.clearRect(0, 0, _width, _height);
      }

      function render() {

        clear();
        _ctx.save();
        _ctx.translate(transforms.translation[0], transforms.translation[1]);
        _ctx.scale(transforms.zoom * _retina, transforms.zoom * _retina);

        _ctx.strokeStyle = _strokeScale(_currentTime);
        _ctx.lineWidth = 2;

        // Draw the fading lines
        angular.forEach(_positionData.filter(function(bike) {
          return bike.opacity < 1;
        }), function(bike) {

          // Each fading bike has a different opacity which is some fraction of 0.15
          _ctx.save();
          _ctx.globalAlpha = Math.round(100 * bike.opacity * 0.15) / 100;
          _ctx.beginPath();

          if (bike.sameStation) {

            _ctx.arc(bike.start[0], bike.start[1], 14, -bike.current[2], 0);

          } else {

            _ctx.moveTo(bike.start[0], bike.start[1]);
            _ctx.lineTo(bike.current[0], bike.current[1]);

          }

          _ctx.stroke();
          _ctx.restore();

        });

        // Active bikes always have opacity 0.15
        _ctx.globalAlpha = 0.15;

        // Active bike lines
        angular.forEach(_positionData.filter(function(bike) {
          return bike.opacity === 1 && bike.sameStation;
        }), function(bike) {

          _ctx.beginPath();
          _ctx.arc(bike.start[0], bike.start[1], 14, -bike.current[2], 0);

        });

        // Active bike lines
        angular.forEach(_positionData.filter(function(bike) {
          return bike.opacity === 1 && !bike.sameStation;
        }), function(bike) {

          _ctx.moveTo(bike.start[0], bike.start[1]);
          _ctx.lineTo(bike.current[0], bike.current[1]);

        });

        // Draw all active lines
        _ctx.stroke();

        _ctx.restore();

      }

    }



  }

})();