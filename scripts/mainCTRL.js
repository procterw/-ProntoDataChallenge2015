

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
		vm.timeStart = new Date(2015, 7, 7);
    vm.timeStop = new Date(2015, 7, 8);
    vm.currentTime = new Date(2015, 7, 7);
    vm.minpersec = 30;

		DataFactory.loadData(function(trips, stations, weather, seattle) {
      MapFactory.resize();
      MapFactory.drawMap(seattle);
      MapFactory.drawStations(DataFactory.stations);
			animateRange(vm.timeStart, vm.timeStop);
		});

    window.onresize = function(event) {
      MapFactory.resize();
      MapFactory.drawMap(DataFactory.seattle);
    };

    // Run an animation between two timesteps
    function animateRange(t1, t2) {

      var dataSubset = DataFactory.filterByTimeRange(DataFactory.trips, t1, t2);

      // Keep track of the intervals starting time
      var startTimer = new Date();

      // The time of the current frame relative to t1 and t2
      var frameTime = +t1;

      MapFactory.setSunScales(DataFactory.getSunriseSunset(new Date((t1.getTime()+t2.getTime())/2)));

      console.log(MapFactory.waterScale(0))

      // Animation loop
      var interval = setInterval(function() {

        if (vm.currentTime > +t2) clearInterval(interval);

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
        vm.waterColor = MapFactory.waterScale(timeInMin);

        MapFactory.setTime(timeInMin);

        MapFactory.drawMap();

      }, 50);

	}

})();
