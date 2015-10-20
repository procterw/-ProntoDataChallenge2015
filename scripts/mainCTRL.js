

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
		vm.time = new Date(2015, 7, 1)
		vm.isNight = isNight;

		DataFactory.loadData(function(trips, stations, weather, seattle) {
      MapFactory.resize();
      MapFactory.drawMap(seattle);
      MapFactory.drawStations(DataFactory.stations);
			startAnimation();
		});

    window.onresize = function(event) {
      MapFactory.resize();
      MapFactory.drawMap(DataFactory.seattle);
    };


		function startAnimation() {

			setInterval(function() {
				
				// Add 5 minutes to time
				vm.time = new Date(vm.time.getTime() +  1000 * 60 * 1);
				$scope.$apply();

				var trips = DataFactory.filterByTime(DataFactory.trips, vm.time);

        var activeTrips = DataFactory.findTripsAt(vm.time);

				// Find the coords for trip start and stop
	
				// MapFactory.drawStations(DataFactory.stations);
				MapFactory.drawBikes(activeTrips);
        // MapFactory.drawMap(DataFactory.seattle)

			}, 40)

		}

		function isNight() {
			var time = vm.time.getHours();
			return ((time < 5) || (time > 20));
		}



	}

})();
