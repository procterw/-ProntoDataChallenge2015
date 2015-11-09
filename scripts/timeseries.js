// Creates a full page popup that fades out when clicked
// Relies on CSS rules from Mazama_databrowser_base.css
// There should be no need to make changes to this

angular.module('App')

	.directive('timeseries', [function () {

    return {
      restrict: 'E',		// Is an element <popup> </popup>
      scope: false,
      transclude: true,		// Allows HTML content inside
      link: function($scope, ele, atr) {

        var canvas = d3.select(ele[0].parentNode)
          .append("canvas")
          .attr("width", width)
          .attr("height", height)

        var ctx = canvas.node().getContext("2d");

        var devicePixelRatio = window.devicePixelRatio || 1;
        var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
          ctx.mozBackingStorePixelRatio ||
          ctx.msBackingStorePixelRatio ||
          ctx.oBackingStorePixelRatio ||
          ctx.backingStorePixelRatio || 1;

        var retina = devicePixelRatio / backingStoreRatio;

        var width = 250,
        height = 50;

        canvas.attr("width", width * retina);
        canvas.attr("height", height * retina);

        canvas.style("width", width + "px");
        canvas.style("height", height + "px");

        ctx.scale(retina, retina)

        // var xScale = d3.scale.linear()

        $scope.$watch(function() {
          return [$scope.main.currentTime, $scope.main.hoveredStation()];
        }, function() {

          ctx.clearRect(0,0,width,height);

          var station = $scope.main.hoveredStation();

          if (!station) return;

          var ageFilter = $scope.main.userAge;
          var userFilter = $scope.main.userType;

          var xScale = d3.scale.linear()
            .domain([0,24 * 60])
            .range([3,width-3]);

          var departureTimes = station.departures.filter(function(d) {
            var user = userFilter === "AO" || d.usertype === userFilter;
            var age = ageFilter === "all" || d.age === ageFilter;
            return user && age;
          }).map(function(s) {
            return Math.floor(s.time/5) * 5;
          });

          var arrivalTimes = station.arrivals.filter(function(d) {
            var user = userFilter === "AO" || d.usertype === userFilter;
            var age = ageFilter === "all" || d.age === ageFilter;
            return user && age;
          }).map(function(s) {
            return Math.floor(s.time/5) * 5;
          });

          var departuresHist = d3.layout.histogram()
            .bins(xScale.ticks(12*24))(departureTimes);

          var arrivalsHist = d3.layout.histogram()
            .bins(xScale.ticks(12*24))(arrivalTimes);

          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(0,0,width,height);
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fillRect(0,0,xScale($scope.main.currentTime),height);

          // ctx.beginPath();
          // ctx.moveTo(1,0);
          // ctx.lineTo(1,height);
          // ctx.moveTo(1, height/2);
          // ctx.lineTo(width, height/2);
          // ctx.moveTo(width-1,0);
          // ctx.lineTo(width-1,height);
          // ctx.strokeStyle = "white";
          // ctx.stroke();

          ctx.fillStyle = "white"
          // var times = ["4","7","10","1","4","7","10","1","4"];
          // // Draw ticks
          // for (var i=0; i < 9; i++) {
          //   ctx.font="8px Helvetica";
          //   ctx.fillText(times[i],xScale(i*180),33);
          // }

          angular.forEach(departuresHist, function(t) {
              ctx.beginPath();
              ctx.fillStyle = "#DB6E63";
              ctx.fillRect(xScale(t.x),26,2,t.y*4);
          })

          angular.forEach(arrivalsHist, function(t) {
              ctx.beginPath();
              ctx.fillStyle = "#73B1C9";
              ctx.fillRect(xScale(t.x),24,2,-t.y*4);
          })


        }, true);
        
      }
    }

  }]);