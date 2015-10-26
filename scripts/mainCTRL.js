

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
    vm.minpersec = 30;

    // Forms
    vm.subsetOptions = DataFactory.subsetOptions;
    vm.monthOptions = DataFactory.monthOptions;
    vm.query = DataFactory.query;

    vm.animateQuery = animateQuery;
    vm.animateTimespan = animateTimespan;

    vm.formatTime = formatTime;

    vm.stop = function() {
      if (activeAnimation) clearInterval(activeAnimation);
      activeAnimation = false;
      MapFactory.bikeQueue.clear();
    }


		DataFactory.loadData(function(trips, stations, weather, seattle) {
      MapFactory.resize();
      MapFactory.drawMap(seattle);
      MapFactory.drawStations(DataFactory.stations);
		});

    window.onresize = function(event) {
      MapFactory.resize();
      MapFactory.drawMap(DataFactory.seattle);
      MapFactory.drawBikes();
      MapFactory.drawStations(DataFactory.makeStationList);
    };

    // Is an animation currently running? 
    var activeAnimation












    function animateQuery() {

      vm.stop();

      MapFactory.bikeQueue.clear();

      // Find data subset
      var dataSubset = DataFactory.makeQuery();

      if (dataSubset.length < 1) return;

      // Find median start time for animating time of day
      var medianTime = dataSubset[Math.round(dataSubset.length/2)].starttime;
      MapFactory.setSunScales(DataFactory.getSunriseSunset(medianTime));

      // Strip day month and year off of times
      dataSubset = DataFactory.getTimeInMinutes(dataSubset);

      vm.timeStart = 0,
      vm.timeStop = 25 * 60;

      var startTimer = new Date();
      var frameTime = 0;

      vm.currentTime = 0;

      activeAnimation = setInterval(function() {

        // How much RUN time has passed
        var dt = (new Date()).getTime() - startTimer.getTime();

        // How many BIKE minutes have passed
        vm.currentTime = vm.minpersec * (dt / 1000);
        $scope.$apply();

        var activeBikes = DataFactory.findTripStations(DataFactory.getDataBefore(dataSubset, vm.currentTime, true));
        dataSubset = DataFactory.getDataAfter(dataSubset, vm.currentTime, true);

        MapFactory.bikeQueue.addData(activeBikes);
        MapFactory.bikeQueue.getPositions(DataFactory.getCurrentLocation, vm.currentTime);
        MapFactory.bikeQueue.render();

        MapFactory.drawStations();

        vm.waterColor = MapFactory.waterScale(vm.currentTime % (24 * 60));
        MapFactory.setTime(vm.currentTime % (24 * 60));
        MapFactory.drawMap()
        
        // If time has gone too far, stop the animation
        if (vm.currentTime > vm.timeStop) {
          vm.stop();
        }

      }, 50);

    }








    // Run an animation between two timesteps
    function animateTimespan() {

      vm.stop(); // stp any active animations

      MapFactory.bikeQueue.clear(); // clear bikes from map and memory

      // Get subsets so it's faster to query data
      var dataSubset = DataFactory.queryTimespan(vm.timeRange[0], vm.timeRange[1]);
      var statusSubset = DataFactory.queryStatuses(vm.timeRange[0], vm.timeRange[1]);
      MapFactory.stations.datum().setBikeCount(statusSubset[0]);

      if (dataSubset.length < 1) return;

      console.log(statusSubset)

      // Find median start time for animating time of day
      var medianTime = dataSubset[Math.round(dataSubset.length/2)].starttime;
      MapFactory.setSunScales(DataFactory.getSunriseSunset(medianTime));

      console.log(statusSubset[0])

      // Add minutes to starttime and stoptimes
      dataSubset = DataFactory.getTimeSince(dataSubset, vm.timeRange[0]);

      vm.timeStart = 0,
      vm.timeStop = (vm.timeRange[1] - vm.timeRange[0]) / (1000 * 60);

      var startTimer = new Date();
      var frameTime = 0;
      var previousTime = 0;

      vm.currentTime = 0;


      activeAnimation = setInterval(function() {

        // How much RUN time has passed
        var dt = (new Date()).getTime() - startTimer.getTime();

         // How many BIKE minutes have passed
        vm.currentTime = vm.minpersec * (dt / 1000);
        $scope.$apply();

        // If an hour has passed, update the stations with statuses
        if (Math.floor(previousTime/60) != Math.floor(vm.currentTime/60)) {

          // How many hours have passed?
          var hoursPassed = Math.round((vm.currentTime - vm.timeStart)/60);
          MapFactory.stations.datum().setBikeCount(statusSubset[hoursPassed]);

        }
        previousTime = vm.currentTime;

        var activeBikes = DataFactory.findTripStations(DataFactory.getDataBefore(dataSubset, vm.currentTime, true));

        if (activeBikes)

        dataSubset = DataFactory.getDataAfter(dataSubset, vm.currentTime, true);

        MapFactory.bikeQueue.addData(activeBikes);
        MapFactory.bikeQueue.getPositions(DataFactory.getCurrentLocation, vm.currentTime);
        MapFactory.bikeQueue.render();

        MapFactory.drawStations();

        vm.waterColor = MapFactory.waterScale(vm.currentTime % (24 * 60));
        MapFactory.setTime(vm.currentTime % (24 * 60));
        MapFactory.drawMap()
        
        // If time has gone too far, stop the animation
        if (vm.currentTime > vm.timeStop) {
          vm.stop();
        }

      });

  	}








    // Formates a "minute" time into hours and minutes
    function formatTime(time) {
      var hours = (Math.floor(time / 60) + 4);
      var minutes = Math.round(time % 60);
      var ampm = Math.floor((hours % 25)/12) ? "PM" : "AM";
      if (hours === 0) hours = 12;
      hours = hours % 12;
      if (hours < 10) hours = "0" + hours;
      if (minutes < 10) minutes = "0" + minutes;
      return hours + ":" + minutes + " " + ampm;
    }

  }

})();
