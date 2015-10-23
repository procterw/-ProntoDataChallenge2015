

// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Main controller          //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //



(function() { 

	angular.module("App")
		.controller("Main", Main);

	Main.$inject = ['$scope', 'DataFactory', 'MapFactory'];

	function Main($scope, DataFactory, MapFactory) {

		var vm = this;

    // Default options
		vm.timeStart = new Date(2015, 7, 7);
    vm.timeStop = new Date(2015, 7, 9);
    vm.currentTime = new Date(2015, 7, 7);
    vm.minpersec = 30;

    // Forms
    vm.subsetOptions = DataFactory.subsetOptions;
    vm.monthOptions = DataFactory.monthOptions;
    vm.query = DataFactory.query;

    vm.animateQuery = animateQuery;

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

        var activeBikes = DataFactory.findTripStations(DataFactory.getDataBefore(dataSubset, vm.currentTime));
        dataSubset = DataFactory.getDataAfter(dataSubset, vm.currentTime);

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
    function animateRange() {

      var t1 = vm.timeStart,
      t2 = vm.timeStop;

      var dataSubset = DataFactory.filterByTimeRange(DataFactory.trips, t1, t2);

      // Keep track of the intervals starting time
      var startTimer = new Date();

      // The time of the current frame relative to t1 and t2
      var frameTime = +t1;

      MapFactory.setSunScales(DataFactory.getSunriseSunset(new Date((t1.getTime()+t2.getTime())/2)));

      // Animation loop
      activeAnimation = setInterval(function() {

        // How much time has gone by?
        var dt = new Date() - startTimer;

        // How many "bike minutes" have passed
        var elapsedMinutes = vm.minpersec * (dt / 1000);

        // Update the frame time
        vm.currentTime = new Date(+t1 + (elapsedMinutes * 1000 * 60));
        $scope.$apply();

        var activeBikes = DataFactory.findTripStations(DataFactory.getDataBefore(dataSubset, vm.currentTime));
        dataSubset = DataFactory.getDataAfter(dataSubset, vm.currentTime);

        MapFactory.bikeQueue.addData(activeBikes);
        MapFactory.bikeQueue.getPositions(DataFactory.getCurrentLocation, vm.currentTime);
        MapFactory.bikeQueue.render();

        // Get time in minutes for scales
        var timeInMin = vm.currentTime.getHours() * 60 + vm.currentTime.getMinutes();

        // Set background color
        // vm.waterColor = MapFactory.waterScale(timeInMin);

        // MapFactory.setTime(timeInMin);

        MapFactory.drawMap();

        if (vm.currentTime > +t2) clearInterval(activeAnimation);

      }, 50);

  	}

  }

})();
