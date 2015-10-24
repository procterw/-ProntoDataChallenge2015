

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
		vm.timeStart = new Date(2015, 7, 1);
    vm.timeStop = new Date(2015, 7, 8);;
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
    function animateTimespan() {

      vm.stop(); // stp any active animations

      MapFactory.bikeQueue.clear(); // clear bikes from map and memory

      var dataSubset = DataFactory.queryTimespan(vm.timeStart, vm.timeStop);

      var statusSubset = DataFactory.queryStatuses(vm.timeStart, vm.timeStop);
      console.log(statusSubset)

  	}








    // Formates a "minute" time into hours and minutes
    function formatTime(time) {
      var hours = Math.floor(time / 60) + 4;
      var minutes = Math.round(time % 60);
      if (hours === 0) hours = 12;
      if (hours < 10) hours = "0" + hours;
      if (minutes < 10) minutes = "0" + minutes;
      return hours + ":" + minutes + " " + (time < 12 * 60 ? "AM" : "PM");
    }

  }

})();
