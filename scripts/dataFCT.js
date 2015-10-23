
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

    Factory.getTimeInMinutes = getTimeInMinutes;

    Factory.getDataBefore = getDataBefore;
    Factory.getDataAfter = getDataAfter;

    Factory.getSunriseSunset = getSunriseSunset;

    Factory.makeQuery = makeQuery;

    Factory.subsetOptions = [
      {name: "Mondays", val:1},
      {name: "Tuesdays", val:2},
      {name: "Wednesdays", val:3},
      {name: "Thursdays", val:4},
      {name: "Fridays", val:5},
      {name: "Saturdays", val:6},
      {name: "Sundays", val:0},
      // {name: "Sunny Days", val:"sunny"},
      // {name: "Cloudy Days", val:"cloudy"},
      {name: "Rainy Days", val:"rainy"},
      {name: "Hot Days (>70)", val:"hot"},
      {name: "Cold Days (<35)", val:"cold"},
      {name: "Windy Days", val:"windy"}
    ];

    Factory.monthOptions = [
      {name: "January", val: 0},
      {name: "February", val: 1},
      {name: "March", val: 2},
      {name: "April", val: 3},
      {name: "May", val: 4},
      {name: "June", val: 5},
      {name: "July", val: 6},
      {name: "August", val: 7},
      {name: "September", val: 8},
      {name: "October", val: 9},
      {name: "November", val: 10},
      {name: "December", val: 11}
    ];

    Factory.query = {
      month: 6,
      subset: 5
    };

    // four hour timeshift to apply to all dates
    var timeShift = -1000 * 60 * 60 * 4;


		return Factory;

		function loadData(callback) {
			d3.csv("clean_data/trips.csv", function(trips) {
				d3.csv("clean_data/stations.csv", function(stations) {
					d3.csv("clean_data/weather.csv", function(weather) {
						d3.json("clean_data/Neighborhoods.json", function(error, geojson) {
              Factory.trips = cleanTripData(trips);
              Factory.stations = addStationTracking(stations);
              Factory.weather = cleanWeatherData(weather);
							Factory.seattle = unpackTopoJSON(geojson);
              callback(trips, stations, weather, Factory.seattle);
						});
					});
				});
			});
		}

    // Takes a station object and adds functions for 
    function addStationTracking(stations) {
        
        stations.forEach(function(d) {
          d.arrivals = 0;
          d.departures = 0;
        });

        stations.addBike = function(terminal) {
          stations.forEach(function(s) {
            if (s.terminal === terminal) s.arrivals++;
          });
        };

        stations.removeBike = function(terminal) {
          stations.forEach(function(s) {
            if (s.terminal === terminal) s.departures++;
          });
        };

        stations.resetBikes = function() {
          stations.forEach(function(s) {
            d.arrivals=0;
            d.departures=0;
          });
        };

        return stations;

    }

    // Make a query using the internal QUERY object which is bound
    // To ui controls in the main view
    function makeQuery() {
      var subset = Factory.query.subset;
      var month = Factory.query.month;
      // If not a number it must be a weather option
      if (isNaN(subset)) {
        var monthFilter = Factory.trips.filter(function(d) {
          try {
            return month === d.starttime.getMonth();
          } catch(err) {
            return false;
          }
        });
        return monthFilter.filter(function(d) {
          var weather = getWeatherOn(d.starttime);
          if (subset==="rainy") {
            return weather.Events === "Rain";
          } else if (subset==="hot") {
            return +weather.Mean_Temperature_F >= 70;
          } else if (subset==="cold") {
            return +weather.Mean_Temperature_F <= 35;
          } else {
            return false;
          }
        });
      } else { // otherwise assume it's a weekday
        return Factory.trips.filter(function(d) {
          var isRightMonth = month === d.starttime.getMonth();
          var isRightDay = subset === d.starttime.getDay();
          return isRightDay && isRightMonth;
        });
      }

    }

    function getTimeInMinutes(data) {
      function time2min(t) {
        return t.getHours() * 60 + t.getMinutes();
      }
      angular.forEach(data, function(d) {
        if (d.starttime) d.starttime_min = time2min(d.starttime)
        if (d.stoptime) d.stoptime_min = time2min(d.stoptime)
        if (d.Date) d.Date_min = time2min(d.Date)
      });
      return data;
    }

    function cleanWeatherData(data) {
      angular.forEach(data, function(d) {
        d.Precipitation_In = +d.Precipitation_In;
        d.Date = new Date((+d.Date) * 60 * 1000 + timeShift);
        d.sunrise = [+d.sunrise.split(":")[0] - 4,+d.sunrise.split(":")[1]];
        d.sunset = [+d.sunset.split(":")[0] - 4,+d.sunset.split(":")[1]];
      });
      return data;
    }

    function cleanTripData(data) {
      angular.forEach(data, function(d) {
        d.starttime = new Date((+d.starttime) * 60 * 1000 + timeShift);
        d.stoptime = new Date((+d.stoptime) * 60 * 1000 + timeShift);
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
      return data.filter(function(d) {
        return (+d.starttime > time1 && +d.starttime < time2);
      });
    }

    function getDataBefore(data, time) {
      return data.filter(function(d) {
        // check if time is date object or just minutes
        return time < 25 * 60 ? +d.starttime_min < time : +d.starttime < time;
      }) || [];

    }

    function getDataAfter(data, time) {
      return data.filter(function(d) {
        // check if time is date object or just minutes
        return time < 25 * 60 ? +d.starttime_min > time : +d.starttime > time;
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

    function getWeatherOn(date) {
      for (var i=0; i<Factory.weather.length; i++) {
        var d = Factory.weather[i];
        var isRightDate = d.Date.getDate() === date.getDate();
        var isRightMonth = d.Date.getMonth() === date.getMonth();
        if (isRightDate && isRightMonth) return d;
      }
      return null; // Is this bad practice?
    }

		function getCurrentLocation(trip, time) {

      if (trip.stoptime_min < time) {

        return [trip.stopCoords[1], trip.stopCoords[0], 2*Math.PI]

      } else if (trip.from_station_id === trip.to_station_id) {

				var t1 = +trip.starttime_min; // time in minutes
				var t2 = +trip.stoptime_min; // time in minutes
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
				var t1 = +trip.starttime_min; // time in minutes
				var t2 = +trip.stoptime_min; // time in minutes
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
