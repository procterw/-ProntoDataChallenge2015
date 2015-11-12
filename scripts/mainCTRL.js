

// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Main controller          //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //



(function() { 

	angular.module("App")
		.controller("Main", Main);

	Main.$inject = ['$scope', 'DataFactory', 'MapFactory', "$http"];

	function Main($scope, DataFactory, MapFactory, $http) {


		var vm = this;

    // Default options
		vm.timeStart = new Date(2014, 10, 16);
    vm.timeStop = new Date(2014, 10, 18);
    vm.timeRange = [new Date(2014, 10, 16), new Date(2014, 10, 18)];
    vm.currentTime = 0;
    vm.minpersec = 20;

    vm.loading = true;

    vm.hoveredStation = MapFactory.Stations.getHoveredStation;

    vm.userType = "AO";
    vm.userAge = "all";

    // Forms
    vm.subsetOptions = DataFactory.subsetOptions;
    vm.monthOptions = DataFactory.monthOptions;
    vm.query = DataFactory.query;

    vm.previous = {
      day: "",
      month: "" 
    }

    // vm.animateQuery = animateQuery;
    // vm.animateTimespan = animateTimespan;

    // vm.formatTime = formatTime;


    // initialization function
		DataFactory.loadData(initialize);

    window.onresize = resize;

    function initialize(trips, stations, weather, seattle) {

      MapFactory.Map.setCoordinates(seattle);
      MapFactory.Map.setColorScales([6*60,18*60]);

      MapFactory.Bikes.setColorScale([6*60,18*60]);

      MapFactory.Stations.setColorScale([6*60,18*60]);
      MapFactory.Stations.setStations(stations);
      
      resize();

      setTimeout(function() {
        vm.loading = false
        $scope.$apply()
      }, 100);

    };

    // Resize and rerender canvas layers.
    // Stations must be resized first because that is
    // the top layer and therefore handles zoom events.
    function resize(event) {
      MapFactory.Stations.resize();
      MapFactory.Map.resize();
      MapFactory.Map.render();
      MapFactory.Stations.render();
      MapFactory.Bikes.resize();
      MapFactory.Bikes.render();
      MapFactory.Timeseries.resize();
      MapFactory.Timeseries.render("all");
    };

    // track the time of day
    var timeOfDay = "night";
    var newTimeOfDay = "night";




    var Trends = new function() {

      var runningAnimation = false;

      // Queried subset of trip data
      var dataSubset = [];
      // Array of newly active bikes since last frame
      var activeBikes = [];
      // Sunrise and sunset times in minutes since 12AM
      var sunriset;
      var sunclass;

      var pauseGap = 0;
      var pauseStart;

      // Select background of canva for water colors
      var water = d3.select(".canvas-wrapper");

      this.initialize = initialize;
      this.pause = pause;
      this.isRunning = isRunning;

      function initialize() {

        // Reset pause gap
        pauseGap = 0;

        // Reset everything
        MapFactory.Bikes.reset();
        MapFactory.Bikes.resize();
        MapFactory.Stations.reset();

        // Timing variables
        animationStartTime = new Date();
        animationLastTime = new Date();
        timeOfDay = "night";

        // Get data subset
        dataSubset = DataFactory.getTimeInMinutes(DataFactory.makeQuery());
        // Ensure the finished property is reset
        angular.forEach(dataSubset, function(d) { d.finished=false; });

        // Find the median time of this query for sunrise and sunset
        var medianTime = dataSubset[Math.round(dataSubset.length/2)].starttime;
        sunriset = DataFactory.getSunriseSunset(medianTime);

        // Set the color scales for this run
        MapFactory.Map.setColorScales(sunriset);
        MapFactory.Bikes.setColorScale(sunriset);
        MapFactory.Stations.setColorScale(sunriset);

        // Set start and stop time in minutes and currentTime to 0
        vm.timeStart = 0;
        vm.timeStop = 24 * 60;
        vm.currentTime = 0;

        // Start animation
        runningAnimation = window.requestAnimationFrame(run);

      }

      function run() {

        // Update the current "real world" time
        vm.currentTime = vm.currentTime + vm.minpersec * (((new Date()).getTime() - animationLastTime) / 1000);

        // This lets us keep track of when the previous iteration of run was
        animationLastTime = new Date().getTime();

        if (vm.currentTime > vm.timeStop) vm.currentTime = vm.timeStop;

        $scope.$apply();

        // Get the new time of day
        if (vm.currentTime < sunriset[1] - 60 || vm.currentTime > sunriset[0] - 60) {
          newTimeOfDay = "night";
        } else {
          newTimeOfDay = "day";
        }

        sunclass = vm.minpersec === 10 ? "sun-fast" : (vm.minpersec === 20 ? "sun-med" : "sun-slow");

        if (newTimeOfDay !== timeOfDay && newTimeOfDay === "night") water.attr("class", "canvas-wrapper " + sunclass);
        if (newTimeOfDay !== timeOfDay && newTimeOfDay === "day") water.attr("class", "canvas-wrapper day " + sunclass);
        if (newTimeOfDay !== timeOfDay) timeOfDay = newTimeOfDay;

        // Remove day from the original subset
        activeBikes = DataFactory.findTripStations(DataFactory.getDataBefore(dataSubset, vm.currentTime, true));
        
        dataSubset = DataFactory.getDataAfter(dataSubset, vm.currentTime, true);

        // Rerender bikes
        MapFactory.Bikes.setUserFilter(vm.userType);
        MapFactory.Bikes.setAgeFilter(vm.userAge);
        MapFactory.Bikes.setTime(vm.currentTime);
        MapFactory.Bikes.addData(activeBikes);
        MapFactory.Bikes.render();

        // Rerender stations
        MapFactory.Stations.setUserFilter(vm.userType);
        MapFactory.Stations.setAgeFilter(vm.userAge);
        MapFactory.Stations.setTime(vm.currentTime);
        MapFactory.Stations.render("usage");

        MapFactory.Timeseries.setTime(vm.currentTime);
        MapFactory.Timeseries.render(vm.hoveredStation());

        // Rerender map
        var newFill = MapFactory.Map.needsNewFill(vm.currentTime);
        MapFactory.Map.setTime(vm.currentTime);
        if (newFill) MapFactory.Map.render();

        if (vm.currentTime < vm.timeStop) {
          runningAnimation = window.requestAnimationFrame(run);
        } else {
          runningAnimation = false;
          MapFactory.Bikes.reset();
        }

      }

      function pause() {

        // unpause
        if (!runningAnimation) {
          animationLastTime = new Date();
          runningAnimation = window.requestAnimationFrame(run);
        } 
        // pause
        else {
          window.cancelAnimationFrame(runningAnimation)
          runningAnimation = false;
          // animationLastTime = new Date();
        }
      }


      function isRunning() {
        return !!runningAnimation;
      }


    };

    vm.start = Trends.initialize;
    vm.pause = Trends.pause;

    vm.showPlayButton = function() {
      return !Trends.isRunning() && (vm.currentTime === 0 || vm.currentTime >= 60*24);
    }

    vm.showUnpauseButton = function() {
      return !Trends.isRunning() && (vm.currentTime > 0 && vm.currentTime < 60*24);
    }

    vm.showPauseButton = function() {
      return Trends.isRunning();
    }

    $scope.$watch(function() { return [vm.userType, vm.userAge]; }, function() {
      // if (!runningAnimation) {
        MapFactory.Stations.setUserFilter(vm.userType);
        MapFactory.Stations.setAgeFilter(vm.userAge);
        MapFactory.Timeseries.setUserFilter(vm.userType);
        MapFactory.Timeseries.setAgeFilter(vm.userAge);
        MapFactory.Stations.render();
        MapFactory.Timeseries.render(vm.hoveredStation());
      // }
    }, true);



  }

})();
