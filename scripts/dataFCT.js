
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

    Factory.trips;
    Factory.stations;
    Factory.weather;

		Factory.loadData = loadData;
		Factory.filterByTime = filterByTime;
    Factory.filterByTimeRange = filterByTimeRange;
		Factory.getStationCoords = getStationCoords;
		Factory.getCurrentLocation = getCurrentLocation;
    Factory.findTripStations = findTripStations;

    Factory.getDataBefore = getDataBefore;
    Factory.getDataAfter = getDataAfter;

    Factory.getSunriseSunset = getSunriseSunset;

    




		return Factory;

		function loadData(callback) {
			d3.csv("clean_data/trips.csv", function(trips) {
				d3.csv("clean_data/stations.csv", function(stations) {
					d3.csv("clean_data/weather.csv", function(weather) {
						d3.json("clean_data/Neighborhoods.json", function(error, geojson) {
              Factory.trips = cleanTripData(trips);
              Factory.stations = stations;
              Factory.weather = cleanWeatherData(weather);
							Factory.seattle = unpackTopoJSON(geojson);
              callback(trips, stations, weather, Factory.seattle);
						});
					});
				});
			});
		}

    function cleanWeatherData(data) {
      angular.forEach(data, function(d) {
        d.Precipitation_In = +d.Precipitation_In;
        d.Date = new Date((+d.Date) * 60 * 1000);
        d.sunrise = [+d.sunrise.split(":")[0],+d.sunrise.split(":")[1]];
        d.sunset = [+d.sunset.split(":")[0],+d.sunset.split(":")[1]];
      });
      return data;
    }

    function cleanTripData(data) {
      angular.forEach(data, function(d) {
        d.starttime = new Date((+d.starttime) * 60 * 1000);
        d.stoptime = new Date((+d.stoptime) * 60 * 1000);
      })
      return data;
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

    function filterByTimeRange(data, time1, time2) {
      console.log(time1, time2)
      return data.filter(function(d) {
        return (+d.starttime > time1 && +d.starttime < time2);
      });
    }

    function getDataBefore(data, time) {
      return data.filter(function(d) {
        return +d.starttime < time;
      });

    }

    function getDataAfter(data, time) {
      return data.filter(function(d) {
        return +d.starttime > time;
      }) || [];
    }

		function getStationCoords(terminal) {
			var coords = [];
			angular.forEach(Factory.stations, function(station) {
				if (station.terminal === terminal) {
					coords = [+station.lat, +station.long];
				}
			}) || [];
			return coords;
		}

		function getCurrentLocation(trip, time) {

      if (trip.stoptime < time) {

        return [trip.stopCoords[1], trip.stopCoords[0], 2*Math.PI]

      } else if (trip.from_station_id === trip.to_station_id) {

				var t1 = +trip.starttime; // time in minutes
				var t2 = +trip.stoptime; // time in minutes
				var dt = time - t1;

				var r = 0.0015;

				// How far around?
				var theta = Math.PI * 2 * (dt / (t2 - t1));

				return [
					trip.startCoords[1] + (Math.cos(theta) * r),
					trip.startCoords[0] + (Math.sin(theta) * r),
          theta
				]

			} else {

				var x1 = trip.startCoords[1];
				var y1 = trip.startCoords[0];
				var x2 = trip.stopCoords[1];
				var y2 = trip.stopCoords[0];
				var t1 = +trip.starttime; // time in minutes
				var t2 = +trip.stoptime; // time in minutes
				var dt = time - t1;

				var rateX = (x2 - x1) / (t2 - t1); 
				var rateY = (y2 - y1) / (t2 - t1);

				return [
					(x1 + dt * rateX),
					(y1 + dt * rateY) 
				]

			}

		}

    function findTripStations(trips, time) {

      angular.forEach(trips, function(trip) {
        trip.startCoords = getStationCoords(trip.from_station_id);
        trip.stopCoords = getStationCoords(trip.to_station_id);
        // if (trip.stoptime > time) {  
        //   trip.currentLocation = getCurrentLocation(trip, time);
        // } else {
        //   // If this timestep was greater than the trip time
        //   trip.currentLocation = trip.stopCoords;
        // }
      });

      return trips;

    }

    function getSunriseSunset(time) {
      var correctDay = Factory.weather.filter(function(day) {
        return day.Date.getDate() == time.getDate() && day.Date.getMonth() === time.getMonth();
      })[0];
      return [correctDay.sunset, correctDay.sunrise];
    }

	}

})();
