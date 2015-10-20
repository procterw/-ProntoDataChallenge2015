
// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Data Factory             //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //

// Functions for loading and parsing data

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
			d3.csv("clean_data/trips.csv", function(trips) {
				d3.csv("clean_data/stations.csv", function(stations) {
					d3.csv("clean_data/weather.csv", function(weather) {
						d3.json("clean_data/Neighborhoods.json", function(error, geojson) {
              Factory.trips = trips;
              Factory.stations = stations;
              Factory.weather = weather;
							Factory.seattle = unpackTopoJSON(geojson);
              callback(trips, stations, weather, Factory.seattle);
						});
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
