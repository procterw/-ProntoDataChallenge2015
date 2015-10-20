

// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Map Factory             //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //

// Functions for rendering the map components

(function() {

	angular.module("App")
		.factory("MapFactory", MapFactory);

	MapFactory.$inject = [];

	function MapFactory() {

		var Factory = {};


		// Always focus the map on this point when zoomed out?
		var mapCenterX = -122.3215;
		var mapCenterY = 47.63;

		Factory.seattle = d3.select("#mapCanvas");
		Factory.stations = d3.select("#stationCanvas");
		Factory.bikes = d3.select("#bikeCanvas");

		Factory.resize = resize;
		Factory.drawMap = drawMap;

		Factory.drawBikes = drawBikes;
		Factory.drawStations = drawStations;

		var xScale = d3.scale.linear();
		var yScale = d3.scale.linear();

		var bbox;

		Factory.stations.call(d3.behavior.zoom()
			// .x(xScale)
			// .y(yScale)
			.scaleExtent([0.5, 2])
			.on("zoom", zoom))

		// Keep track of translations and zooms
		var translation = [0,0];
		var zoomLevel = 1;

		return Factory;


		function resize() {

			bbox = Factory.seattle.node().parentNode.getBoundingClientRect();

			Factory.bikes.attr("width", bbox.width);
			Factory.bikes.attr("height", bbox.height);

			Factory.stations.attr("width", bbox.width);
			Factory.stations.attr("height", bbox.height);

			Factory.seattle.attr("width", bbox.width);
			Factory.seattle.attr("height", bbox.height);

			xScale
				.domain([
					mapCenterX - 0.016 * (bbox.width/Math.min(250, bbox.width, bbox.height)),
					mapCenterX + 0.016 * (bbox.width/Math.min(250, bbox.width, bbox.height))
					])
				.range([0,bbox.width]);

			yScale
				.domain([
					mapCenterY - 0.011 * (bbox.height/Math.min(250, bbox.width, bbox.height)),
					mapCenterY + 0.011 * (bbox.height/Math.min(250, bbox.width, bbox.height))
					])
				.range([bbox.height,0]);

		}



		function drawBikes(bikes) {

			if (bikes) {
				Factory.bikes.datum(bikes)
			} else {
				bikes = Factory.bikes.datum();
			}

			var ctx = Factory.bikes.node().getContext("2d");
			ctx.clearRect(0, 0, bbox.width, bbox.height);
			ctx.save()
			ctx.translate(translation[0], translation[1]);
			ctx.scale(zoomLevel, zoomLevel);
			

			angular.forEach(bikes, function(bike) {

				var x1 = xScale(bike.startCoords[1])
				var y1 = yScale(bike.startCoords[0])

				var x2 = xScale(bike.currentLocation.x)
				var y2 = yScale(bike.currentLocation.y)

				ctx.beginPath();
				ctx.moveTo(x1,y1);
				ctx.lineWidth=4;
				// ctx.setLineDash([2,2])
				ctx.lineTo(x2,y2);
				ctx.strokeStyle = "rgba(0,0,0,0.15)";
				ctx.stroke();

				ctx.beginPath();
				ctx.arc(x2,y2,3,0,2*Math.PI);
				ctx.fillStyle = "#555";
				ctx.fill();

			});

			ctx.restore();

		}




		function drawStations(stations) {

			if (stations) {
				Factory.stations.datum(stations)
			} else {
				stations = Factory.stations.datum();
			}

			var ctx = Factory.stations.node().getContext("2d");
			ctx.clearRect(0, 0, bbox.width, bbox.height);
			ctx.save()
			ctx.translate(translation[0], translation[1]);
			ctx.scale(zoomLevel, zoomLevel);

			angular.forEach(stations, function(station) {
				
				var x = xScale(+station.long);
				var y = yScale(+station.lat);

				ctx.beginPath();
				ctx.arc(x,y,4,0,2*Math.PI);
				ctx.fillStyle = "#CCC";
				ctx.strokeStyle = "#BBB";
				ctx.fill();
				ctx.stroke();

			});

			ctx.restore();

		}

		function drawMap(multipolys) {

			if (multipolys) {
				Factory.seattle.datum(multipolys)
			} else {
				multipolys = Factory.seattle.datum();
			}



			var ctx = Factory.seattle.node().getContext('2d');
			ctx.clearRect(0, 0, bbox.width, bbox.height);
			ctx.save()
			ctx.translate(translation[0], translation[1]);
			ctx.scale(zoomLevel, zoomLevel);

			ctx.beginPath();
			// ctx.scale(zoom,zoom)

			for (var i=0; i<multipolys.length; i++) {

					var polygon = multipolys[i];
				 
					ctx.moveTo(xScale(polygon[0].x), yScale(polygon[0].y));
					for (var k=1; k<polygon.length; k++) {
						ctx.lineTo(xScale(polygon[k].x), yScale(polygon[k].y));
					}
					
			}

			ctx.fillStyle = "rgb(245,245,245)";
			ctx.strokeStyle = "rgb(252,252,252)";
			ctx.lineWidth=2;
			ctx.fill();
			ctx.stroke();

			ctx.restore();

		}

		function zoom() {

			console.log(d3.event.translate)

			translation = d3.event.translate;
			zoomLevel = d3.event.scale;

			var canvas = Factory.seattle.node().getContext("2d");
			canvas.save();
			drawMap();
			canvas.restore();

			canvas = Factory.stations.node().getContext("2d");
			canvas.save();
			drawStations();
			canvas.restore();

			canvas = Factory.bikes.node().getContext("2d");
			canvas.save();
			drawBikes();
			canvas.restore();

		}




	}

})();

