
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
    Factory.weather;

		Factory.loadData = loadData;
		Factory.filterByTime = filterByTime;
    Factory.filterByTimeRange = filterByTimeRange;
		Factory.getStationCoords = getStationCoords;
    Factory.findTripStations = findTripStations;

    Factory.queryTimespan = queryTimespan;

    Factory.getTimeInMinutes = getTimeInMinutes;
    Factory.getTimeSince = getTimeSince;

    Factory.queryStatuses = queryStatuses

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
      {name: "Sundays", val:0}
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
      month: {name: "July", val: 6},
      subset: {name: "Fridays", val:5}
    };

    var loading;

    // four hour timeshift to apply to all dates
    var timeShift = 1000 * 60 * 60 * 4;

    var statusString; // String of 2 digit statuses to parse

		return Factory;

		function loadData(callback) {
			d3.csv("clean_data/trips.csv", function(trips) {
				d3.csv("clean_data/stations.csv", function(stations) {
					d3.csv("clean_data/weather.csv", function(weather) {
						d3.json("clean_data/Neighborhoods.json", function(error, geojson) {
              // d3.csv("clean_data/statuses.csv", function(statuses) {
                // statusString = cleanStatuses(statuses);
                Factory.trips = cleanTripData(trips, stations);
                Factory.stations = stations;
                Factory.weather = cleanWeatherData(weather);
                Factory.seattle = unpackTopoJSON(geojson);
                callback(trips, stations, weather, Factory.seattle);
              // })
						});
					});
				});
			});
		}

    // Make a query using the internal QUERY object which is bound
    // To ui controls in the main view
    function makeQuery() {
      var subset = Factory.query.subset.val;
      var month = Factory.query.month.val;
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

    function getTimeSince(data, time) {
      function time2min(t) {
        return (t - time) / (60 * 1000)
      }
      angular.forEach(data, function(d) {
        if (d.starttime) d.starttime_min = time2min(d.starttime)
        if (d.stoptime) d.stoptime_min = time2min(d.stoptime)
        if (d.Date) d.Date_min = time2min(d.Date)
      });
      return data;
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
        d.sunrise = 60 * (+d.sunrise.split(":")[0] - 4) + (+d.sunrise.split(":")[1]);
        d.sunset = 60 * (+d.sunset.split(":")[0] - 4) + (+d.sunset.split(":")[1]);
      });
      return data;
    }

    function cleanTripData(data, stations) {

      var stationList = stations.map(function(d) {
        return d.terminal;
      });

      angular.forEach(data, function(d) {
        d.to_station_id = stationList[+d.to_station_id - 1];
        d.from_station_id = stationList[+d.from_station_id - 1];
        d.starttime = new Date((+d.starttime) * 60 * 1000 + timeShift);
        d.stoptime = new Date((+d.stoptime) * 60 * 1000 + timeShift);
        var age = new Date().getFullYear() - +d.birthyear;
        d.age = age < 35 ? "young" : (age > 34 ? "old" : null);
        delete d.birthyear;
      })

      return data;
    }

    function cleanStatuses(data) {

      var statuses = []; // initialize empty array

      // Loop through the data in intervals of 65 since there
      // are 65 stations
      for (var i=0; i < (data.length/65)-1; i++) {

        var startI = i * 65;
        var endI = (i + 1) * 65;

        // All stations for one hourly timestep
        var timeGroup = data.slice(startI, endI).map(function(d) {
          return +d.x;
        });

        statuses.push(timeGroup);

      } 

      return statuses;

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

    function queryTimespan(time1, time2) {
      console.log(time1, time2)
      return Factory.trips.filter(function(d) {
        return (+d.starttime > time1 && +d.starttime < time2);
      });
    }

    function queryStatuses(time1, time2) {
      // Statuses are organized in groups of 67 stations
      // with 1 hour intervals starting at 2014-10-16
      // First find the number of hours between
      console.log(time1, time2)
      var starttime = new Date(2014, 10, 16);
      var tdiff1 = (time1 - starttime) / (1000 * 60 * 60);
      var tdiff2 = (time2 - starttime) / (1000 * 60 * 60);
      // Slice the status array. Indices indicate number of hours
      // since starttime
      return statusString.slice(tdiff1 + 4, tdiff2 + 4);
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

    function getDataBefore(data, time, byMinutes) {
      return data.filter(function(d) {
        if (byMinutes) return +d.starttime_min < time;
        return +d.starttime < time;
      }) || [];

    }

    function getDataAfter(data, time, byMinutes) {
      return data.filter(function(d) {
        if (byMinutes) return +d.starttime_min > time;
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

    function getWeatherOn(date) {
      for (var i=0; i<Factory.weather.length; i++) {
        var d = Factory.weather[i];
        var isRightDate = d.Date.getDate() === date.getDate();
        var isRightMonth = d.Date.getMonth() === date.getMonth();
        if (isRightDate && isRightMonth) return d;
      }
      return null; // Is this bad practice?
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

    // Parse the status string and return a usable object
    function getStatuses(t1, t2) {
      console.log(t1, t2)
    }

	}

})();
