'use strict';

angular.module("App", []);

// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Main controller          //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //

(function() { 

	angular.module("App")
		.controller("Main", Main);

	Main.$inject = ['$scope', 'DataFactory', 'MapFactory'];

	function Main($scope, DataFactory, MapFactory) {

		var vm = this;

		vm.test = 5;
		vm.time = new Date(2015, 7, 1)
		vm.isNight = isNight;

		DataFactory.loadData(function(trips, stations, weather, seattle) {
      MapFactory.resize();
      MapFactory.drawMap(seattle);
      MapFactory.drawStations(DataFactory.stations);
			startAnimation();
		});

    window.onresize = function(event) {
      MapFactory.resize();
      MapFactory.drawMap(DataFactory.seattle);
    };


		function startAnimation() {

			setInterval(function() {
				
				// Add 5 minutes to time
				vm.time = new Date(vm.time.getTime() +  1000 * 60 * 2);
				$scope.$apply();

				var trips = DataFactory.filterByTime(DataFactory.trips, vm.time);

        var activeTrips = DataFactory.findTripsAt(vm.time);

				// Find the coords for trip start and stop
	
				// MapFactory.drawStations(DataFactory.stations);
				MapFactory.drawBikes(activeTrips);
        // MapFactory.drawMap(DataFactory.seattle)

			}, 40)

		}

		function isNight() {
			var time = vm.time.getHours();
			return ((time < 5) || (time > 20));
		}



	}

})();



// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Data Factory             //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //

(function(){

	angular.module("App")
		.factory("DataFactory", DataFactory);

	DataFactory.$inject = ['$http'];

	function DataFactory($http) {

		var Factory = {};

		Factory.loadData = loadData;
		Factory.filterByTime = filterByTime;
		Factory.getStationCoords = getStationCoords;
		Factory.getCurrentLocation = getCurrentLocation;
    Factory.findTripsAt = findTripsAt;

		Factory.trips;
		Factory.stations;
		Factory.weather;

		return Factory;

		function loadData(callback) {
			d3.csv("open_data_year_one/cleaned/trips.csv", function(trips) {
				d3.csv("open_data_year_one/cleaned/stations.csv", function(stations) {
					d3.csv("open_data_year_one/cleaned/weather.csv", function(weather) {
						Factory.trips = trips;
						Factory.stations = stations;
						Factory.weather = weather;
						d3.json("Neighborhoods.json", function(error, geojson) {
							Factory.seattle = unpackTopoJSON(geojson);
              callback(trips, stations, weather, Factory.seattle);
						})
					});
				});
			});
		}

    function unpackTopoJSON(data) {

      var unpacked = [];

      for (var i=0; i<data.geometries.length; i++) {

        var polygon = data.geometries[i].coordinates[0];
        var polygon2 = [];

        for (var k=0; k<polygon.length; k++) {

          polygon2.push({
            y: polygon[k][1],
            x: polygon[k][0]
          });

        }
 
        unpacked.push(polygon2);
      }

      return unpacked;

    }

		function filterByTime(data, time) {
			time = time.getTime() / 60000; // milliseconds to minutes
 			return data.filter(function(d) {
				return (+d.starttime < (time) && +d.stoptime > (time));
			});
		}

		function getStationCoords(terminal) {
			var coords = [];
			angular.forEach(Factory.stations, function(station) {
				if (station.terminal === terminal) {
					coords = [+station.lat, +station.long];
				}
			});
			return coords;
		}

		function getCurrentLocation(trip, time) {

			if (trip.from_station_id === trip.to_station_id) {

				var t1 = +trip.starttime; // time in minutes
				var t2 = +trip.stoptime; // time in minutes
				var dt = (time.getTime() / 60000) - t1;

				var r = 0.0015;

				// How far around?
				var theta = Math.PI * 2 * (dt / (t2 - t1));

				return {
					x: trip.startCoords[1] + (Math.cos(theta) * r),
					y: trip.startCoords[0] + (Math.sin(theta) * r) 
				}


			} else {

				var x1 = trip.startCoords[1];
				var y1 = trip.startCoords[0];
				var x2 = trip.stopCoords[1];
				var y2 = trip.stopCoords[0];
				var t1 = +trip.starttime; // time in minutes
				var t2 = +trip.stoptime; // time in minutes
				var dt = (time.getTime() / 60000) - t1;

				var rateX = (x2 - x1) / (t2 - t1); 
				var rateY = (y2 - y1) / (t2 - t1);

				return {
					x: (x1 + dt * rateX),
					y: (y1 + dt * rateY) 
				}

			}

		}

    function findTripsAt(time) {

      var trips = filterByTime(Factory.trips, time);

      angular.forEach(trips, function(trip) {
        trip.startCoords = getStationCoords(trip.from_station_id);
        trip.stopCoords = getStationCoords(trip.to_station_id);
        trip.currentLocation = getCurrentLocation(trip, time);
      });

      return trips;

    }

	}

})();


// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Map Factory             //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //

(function() {

	angular.module("App")
		.factory("MapFactory", MapFactory);

	MapFactory.$inject = [];

	function MapFactory() {

    var Factory = {};


    // Always focus the map on this point when zoomed out?
    var mapCenterX = -122.3215;
    var mapCenterY = 47.63;

    Factory.seattle = d3.select("#mapCanvas");
		Factory.stations = d3.select("#stationCanvas");
    Factory.bikes = d3.select("#bikeCanvas");

    Factory.resize = resize;
    Factory.drawMap = drawMap;

		Factory.drawBikes = drawBikes;
		Factory.drawStations = drawStations;

    var xScale = d3.scale.linear();
    var yScale = d3.scale.linear();

    var bbox;

    Factory.stations.call(d3.behavior.zoom()
      // .x(xScale)
      // .y(yScale)
      .scaleExtent([0.5, 2])
      .on("zoom", zoom))

    // Keep track of translations and zooms
    var translation = [0,0];
    var zoomLevel = 1;

		return Factory;


    function resize() {

      bbox = Factory.seattle.node().parentNode.getBoundingClientRect();

      Factory.bikes.attr("width", bbox.width);
      Factory.bikes.attr("height", bbox.height);

      Factory.stations.attr("width", bbox.width);
      Factory.stations.attr("height", bbox.height);

      Factory.seattle.attr("width", bbox.width);
      Factory.seattle.attr("height", bbox.height);

      xScale
        .domain([
          mapCenterX - 0.016 * (bbox.width/Math.min(250, bbox.width, bbox.height)),
          mapCenterX + 0.016 * (bbox.width/Math.min(250, bbox.width, bbox.height))
          ])
        .range([0,bbox.width]);

      yScale
        .domain([
          mapCenterY - 0.011 * (bbox.height/Math.min(250, bbox.width, bbox.height)),
          mapCenterY + 0.011 * (bbox.height/Math.min(250, bbox.width, bbox.height))
          ])
        .range([bbox.height,0]);

    }



		function drawBikes(bikes) {

      if (bikes) {
        Factory.bikes.datum(bikes)
      } else {
        bikes = Factory.bikes.datum();
      }

			var ctx = Factory.bikes.node().getContext("2d");
      ctx.clearRect(0, 0, bbox.width, bbox.height);
      ctx.save()
      ctx.translate(translation[0], translation[1]);
      ctx.scale(zoomLevel, zoomLevel);
			

			angular.forEach(bikes, function(bike) {

				var x1 = xScale(bike.startCoords[1])
				var y1 = yScale(bike.startCoords[0])

				var x2 = xScale(bike.currentLocation.x)
				var y2 = yScale(bike.currentLocation.y)

        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineWidth=4;
        // ctx.setLineDash([2,2])
        ctx.lineTo(x2,y2);
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.stroke();

				ctx.beginPath();
				ctx.arc(x2,y2,3,0,2*Math.PI);
				ctx.fillStyle = "#555";
				ctx.fill();

			});

      ctx.restore();

		}




		function drawStations(stations) {

      if (stations) {
        Factory.stations.datum(stations)
      } else {
        stations = Factory.stations.datum();
      }

			var ctx = Factory.stations.node().getContext("2d");
      ctx.clearRect(0, 0, bbox.width, bbox.height);
      ctx.save()
      ctx.translate(translation[0], translation[1]);
      ctx.scale(zoomLevel, zoomLevel);

			angular.forEach(stations, function(station) {
				
				var x = xScale(+station.long);
				var y = yScale(+station.lat);

				ctx.beginPath();
				ctx.arc(x,y,4,0,2*Math.PI);
				ctx.fillStyle = "#CCC";
				ctx.strokeStyle = "#BBB";
				ctx.fill();
				ctx.stroke();

			});

      ctx.restore();

		}

    function drawMap(multipolys) {

      if (multipolys) {
        Factory.seattle.datum(multipolys)
      } else {
        multipolys = Factory.seattle.datum();
      }



      var ctx = Factory.seattle.node().getContext('2d');
      ctx.clearRect(0, 0, bbox.width, bbox.height);
      ctx.save()
      ctx.translate(translation[0], translation[1]);
      ctx.scale(zoomLevel, zoomLevel);

      ctx.beginPath();
      // ctx.scale(zoom,zoom)

      for (var i=0; i<multipolys.length; i++) {

          var polygon = multipolys[i];
         
          ctx.moveTo(xScale(polygon[0].x), yScale(polygon[0].y));
          for (var k=1; k<polygon.length; k++) {
            ctx.lineTo(xScale(polygon[k].x), yScale(polygon[k].y));
          }
          
      }

      ctx.fillStyle = "rgb(245,245,245)";
      ctx.strokeStyle = "rgb(252,252,252)";
      ctx.lineWidth=2;
      ctx.fill();
      ctx.stroke();

      ctx.restore();

    }

    function zoom() {

      console.log(d3.event.translate)

      translation = d3.event.translate;
      zoomLevel = d3.event.scale;

      var canvas = Factory.seattle.node().getContext("2d");
      canvas.save();
      drawMap();
      canvas.restore();

      canvas = Factory.stations.node().getContext("2d");
      canvas.save();
      drawStations();
      canvas.restore();

      canvas = Factory.bikes.node().getContext("2d");
      canvas.save();
      drawBikes();
      canvas.restore();

    }




	}

})();

