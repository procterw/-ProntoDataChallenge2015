

// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Main controller          //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //



(function() { 

	angular.module("App")
		.controller("Main", Main);

	Main.$inject = ['$scope', 'DataFactory', 'MapFactory', "$http"];

	function Main($scope, DataFactory, MapFactory, $http) {


		var vm = this;

    var framerate = 40;

    // Default options
		vm.timeStart = new Date(2014, 10, 16);
    vm.timeStop = new Date(2014, 10, 18);
    vm.timeRange = [new Date(2014, 10, 16), new Date(2014, 10, 18)];
    vm.currentTime = 0;
    vm.minpersec = 60;

    vm.hoveredStation = MapFactory.Stations.getHoveredStation;

    // Forms
    vm.subsetOptions = DataFactory.subsetOptions;
    vm.monthOptions = DataFactory.monthOptions;
    vm.query = DataFactory.query;

    vm.animateQuery = animateQuery;
    // vm.animateTimespan = animateTimespan;

    vm.formatTime = formatTime;

    vm.stop = stop;

    var runningAnimation;

    // initialization function
		DataFactory.loadData(initialize);

    window.onresize = resize;

    // Is an animation currently running? 
    var runningAnimation;

    function stop() {
      clearInterval(runningAnimation);
    }

    function initialize(trips, stations, weather, seattle) {

      MapFactory.Map.setCoordinates(seattle);
      MapFactory.Map.setColorScales([[5,0],[18,0]]);

      MapFactory.Bikes.setColorScale([[5,0],[18,0]]);
      // MapFactory.Bikes.render();

      MapFactory.Stations.setStations(stations);
      MapFactory.Stations.setColorScale([[5,0],[18,0]]);

      resize();

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
    };


    function animateQuery() {

      MapFactory.Bikes.reset();
      MapFactory.Stations.reset();

      // Data subset based on query object
      var dataSubset = DataFactory.getTimeInMinutes(DataFactory.makeQuery());

      angular.forEach(dataSubset, function(d) { d.finished=false; });

      // Find the median time of this query for sunrise and sunset
      var medianTime = dataSubset[Math.round(dataSubset.length/2)].starttime;

      // Set color scales based on median time
      var sunriset = DataFactory.getSunriseSunset(medianTime);

      MapFactory.Map.setColorScales(sunriset);
      MapFactory.Bikes.setColorScale(sunriset);
      MapFactory.Stations.setColorScale(sunriset);
      MapFactory.Water.setColorScale(sunriset);

      // Set start and stop time in minutes and currentTime to 0
      vm.timeStart = 0;
      vm.timeStop = 24 * 60;
      vm.currentTime = 0;

      // Starting time of animation
      var animationStart = new Date();

      runningAnimation = setInterval(function() {

        // When to stop interval
        if (vm.currentTime > vm.timeStop) {
          // If it times out, actually clear all of the bike paths.
          // This behavior isn't in the stop function because we keep paths when the
          // animation is paused
          MapFactory.Bikes.reset();
          vm.stop();
        }

        // How long has the animation actually been running for
        var animationElapsed = (new Date()).getTime() - animationStart.getTime();

        // Update the current "real world" time
        vm.currentTime = vm.minpersec * (animationElapsed / 1000);
        $scope.$apply();

        // Remove day from the original subset
        var activeBikes = DataFactory.findTripStations(DataFactory.getDataBefore(dataSubset, vm.currentTime, true));
        dataSubset = DataFactory.getDataAfter(dataSubset, vm.currentTime, true);

        // Rerender bikes
        MapFactory.Bikes.setTime(vm.currentTime);
        MapFactory.Bikes.addData(activeBikes);
        MapFactory.Bikes.render();

        // Rerender stations
        MapFactory.Stations.setTime(vm.currentTime);
        MapFactory.Stations.render("usage");

        // Rerender map
        MapFactory.Map.setTime(vm.currentTime);
        MapFactory.Map.render();

        // Change background color
        vm.waterColor = MapFactory.Water.getColor(vm.currentTime % (24 * 60));



      }, framerate);

    }









   //  function animateQuery() {

   //    vm.stop();

   //    MapFactory.bikeQueue.clear();

   //    // Find data subset
   //    var dataSubset = DataFactory.makeQuery();

   //    if (dataSubset.length < 1) return;

   //    // Find median start time for animating time of day
   //    var medianTime = dataSubset[Math.round(dataSubset.length/2)].starttime;
   //    MapFactory.setSunScales(DataFactory.getSunriseSunset(medianTime));

   //    // Strip day month and year off of times
   //    dataSubset = DataFactory.getTimeInMinutes(dataSubset);

   //    vm.timeStart = 0,
   //    vm.timeStop = 25 * 60;

   //    var startTimer = new Date();
   //    var frameTime = 0;

   //    vm.currentTime = 0;

   //    activeAnimation = setInterval(function() {

   //      // How much RUN time has passed
   //      var dt = (new Date()).getTime() - startTimer.getTime();

   //      // How many BIKE minutes have passed
   //      vm.currentTime = vm.minpersec * (dt / 1000);
   //      $scope.$apply();

   //      var activeBikes = DataFactory.findTripStations(DataFactory.getDataBefore(dataSubset, vm.currentTime, true));
   //      dataSubset = DataFactory.getDataAfter(dataSubset, vm.currentTime, true);

   //      MapFactory.bikeQueue.addData(activeBikes);
   //      MapFactory.bikeQueue.getPositions(DataFactory.getCurrentLocation, vm.currentTime);
   //      MapFactory.bikeQueue.render();

   //      MapFactory.drawStations();

   //      vm.waterColor = MapFactory.waterScale(vm.currentTime % (24 * 60));
   //      MapFactory.setTime(vm.currentTime % (24 * 60));
   //      MapFactory.drawMap()
        
   //      // If time has gone too far, stop the animation
   //      if (vm.currentTime > vm.timeStop) {
   //        vm.stop();
   //      }

   //    }, 50);

   //  }








   //  // Run an animation between two timesteps
   //  function animateTimespan() {

   //    vm.stop(); // stp any active animations

   //    MapFactory.bikeQueue.clear(); // clear bikes from map and memory

   //    // Get subsets so it's faster to query data
   //    var dataSubset = DataFactory.queryTimespan(vm.timeRange[0], vm.timeRange[1]);
   //    var statusSubset = DataFactory.queryStatuses(vm.timeRange[0], vm.timeRange[1]);
   //    MapFactory.stations.datum().setBikeCount(statusSubset[0]);

   //    if (dataSubset.length < 1) return;

   //    console.log(statusSubset)

   //    // Find median start time for animating time of day
   //    var medianTime = dataSubset[Math.round(dataSubset.length/2)].starttime;
   //    MapFactory.setSunScales(DataFactory.getSunriseSunset(medianTime));

   //    console.log(statusSubset[0])

   //    // Add minutes to starttime and stoptimes
   //    dataSubset = DataFactory.getTimeSince(dataSubset, vm.timeRange[0]);

   //    vm.timeStart = 0,
   //    vm.timeStop = (vm.timeRange[1] - vm.timeRange[0]) / (1000 * 60);

   //    var startTimer = new Date();
   //    var frameTime = 0;
   //    var previousTime = 0;

   //    vm.currentTime = 0;


   //    activeAnimation = setInterval(function() {

   //      // How much RUN time has passed
   //      var dt = (new Date()).getTime() - startTimer.getTime();

   //       // How many BIKE minutes have passed
   //      vm.currentTime = vm.minpersec * (dt / 1000);
   //      $scope.$apply();

   //      // If an hour has passed, update the stations with statuses
   //      if (Math.floor(previousTime/60) != Math.floor(vm.currentTime/60)) {

   //        // How many hours have passed?
   //        var hoursPassed = Math.round((vm.currentTime - vm.timeStart)/60);
   //        MapFactory.stations.datum().setBikeCount(statusSubset[hoursPassed]);

   //      }
   //      previousTime = vm.currentTime;

   //      var activeBikes = DataFactory.findTripStations(DataFactory.getDataBefore(dataSubset, vm.currentTime, true));

   //      if (activeBikes)

   //      dataSubset = DataFactory.getDataAfter(dataSubset, vm.currentTime, true);

   //      MapFactory.bikeQueue.addData(activeBikes);
   //      MapFactory.bikeQueue.getPositions(DataFactory.getCurrentLocation, vm.currentTime);
   //      MapFactory.bikeQueue.render();

   //      MapFactory.drawStations();

   //      vm.waterColor = MapFactory.waterScale(vm.currentTime % (24 * 60));
   //      MapFactory.setTime(vm.currentTime % (24 * 60));
   //      MapFactory.drawMap()
        
   //      // If time has gone too far, stop the animation
   //      if (vm.currentTime > vm.timeStop) {
   //        vm.stop();
   //      }

   //    });

  	// }








    // Formates a "minute" time into hours and minutes
    function formatTime(time) {

      var hours = (Math.floor(time / 60) + 4);
      var minutes = Math.round(time % 60);

      var ampm = hours < 12 || hours > 23 ? "AM" : "PM";
      hours = hours % 12;
      if (hours === 0) hours = 12;

      if (hours < 10) hours = "0" + hours;
      if (minutes < 10) minutes = "0" + minutes;
      return hours + ":" + minutes + " " + ampm;
    }

  }

})();
