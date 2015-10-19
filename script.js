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
		vm.time = new Date(2015, 6, 1)
		vm.isNight = isNight;

		DataFactory.loadData(function(trips, stations) {
			startAnimation();
		});

		function startAnimation() {

			setInterval(function() {
				
				// Add 5 minutes to time
				vm.time = new Date(vm.time.getTime() +  1000 * 60 * 2);
				$scope.$apply();

				var trips = DataFactory.filterByTime(DataFactory.trips, vm.time);

				// Find the coords for trip start and stop
				angular.forEach(trips, function(trip) {
					trip.startCoords = DataFactory.getStationCoords(trip.from_station_id);
					trip.stopCoords = DataFactory.getStationCoords(trip.to_station_id);
					trip.currentLocation = DataFactory.getCurrentLocation(trip, vm.time);
					
				});

				MapFactory.drawStations(DataFactory.stations, isNight());
				MapFactory.drawBikes(trips, isNight());

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
						callback(trips, stations, weather);
					});
				});
			});
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

		Factory.bikes = document.getElementById("bikeCanvas");
		Factory.stations = document.getElementById("stationCanvas");

		Factory.bikes.width = 600;
		Factory.bikes.height = 600;

		Factory.stations.width = 600;
		Factory.stations.height = 600;

		Factory.drawBikes = drawBikes;
		Factory.drawStations = drawStations;

		var xScale = d3.scale.linear()
			.domain([-122.382,-122.261])
			.range([0,600]);

		var yScale = d3.scale.linear()
			.domain([47.594,47.676])
			.range([600,0]);

		return Factory;

		function drawBikes(bikes, isNight) {

			var ctx = Factory.bikes.getContext("2d");

			ctx.clearRect(0, 0, 600, 600);

			angular.forEach(bikes, function(bike) {

				var x1 = xScale(bike.startCoords[1])
				var y1 = yScale(bike.startCoords[0])

				var x2 = xScale(bike.currentLocation.x)
				var y2 = yScale(bike.currentLocation.y)

				ctx.beginPath();
				ctx.arc(x2,y2,3,0,2*Math.PI);
				ctx.fillStyle = isNight ? "#FDE3A7" : "#555";
				ctx.fill();

				ctx.beginPath();
				ctx.moveTo(x1,y1);
				ctx.lineWidth=0.5;
				ctx.setLineDash([2,2])
				ctx.lineTo(x2,y2);
				ctx.strokeStyle = isNight ? "#FDE3A7" : "#555";
				ctx.stroke();

			});

		}

		function drawStations(stations, isNight) {

			var ctx = Factory.stations.getContext("2d");

			ctx.clearRect(0, 0, 600, 600);

			angular.forEach(stations, function(station) {
				
				var x = xScale(+station.long);
				var y = yScale(+station.lat);

				ctx.beginPath();
				ctx.arc(x,y,4,0,2*Math.PI);
				ctx.fillStyle = isNight ? "#D1B680" : "#CCC";
				ctx.strokeStyle = isNight ? "#A58C59" : "#BBB";
				ctx.fill();
				ctx.stroke();

			});

		}



	}

})();

