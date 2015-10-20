

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

		var _currentTime;

		Factory.setTime = function(time) { _currentTime = time; }

		Factory.seattle = d3.select("#mapCanvas");
		Factory.stations = d3.select("#stationCanvas");
		Factory.bikes = d3.select("#bikeCanvas");

		Factory.resize = resize;
		Factory.drawMap = drawMap;

		Factory.drawBikes = drawBikes;
		Factory.drawStations = drawStations;

		Factory.setSunScales = setSunScales;
		Factory.waterScale = d3.scale.linear();

		

		Factory.bikeQueue = {
			data: [],
			posData: [],
			addData: function(data) {
				this.data = this.data.concat(data);
			},
			getPositions: function(getCurrentLocation, time) {
				this.posData = this.data.map(function(d) {
					var current = getCurrentLocation(d, time);
					return {
						current: [xScale(current[0]), yScale(current[1]), current[2]],
						start: [xScale(d.startCoords[1]), yScale(d.startCoords[0])],
						sameStation: d.from_station_id === d.to_station_id
					}
				});
			},
			render: drawBikes
		}

    Factory.bikeTrailQueue = []; // leftover paths


		// Initialize scales
		var xScale = d3.scale.linear();
		var yScale = d3.scale.linear();
		var waterScale = d3.scale.linear();
		var landScale = d3.scale.linear();

		// d3 zoom behavior
		Factory.stations.call(d3.behavior.zoom()
			.scaleExtent([0.5, 2])
			.on("zoom", zoom))

		// Keep track of translations and zooms
		var translation = [0,0];
		var zoomLevel = 1;

		// Bounding box of parent div
		var bbox

		return Factory;

		// Set color scales to indicate time of day
		function setSunScales(sunriset) {

			var sunrise = sunriset[1];
			var sunset = sunriset[0];
			sunrise = sunrise[0] * 60 + sunrise[1]; // which minute of day is it
			sunset = sunset[0] * 60 + sunset[1]; // which minute of day is it

			var sunDomain = [0, sunrise - 120, sunrise, sunrise+120, sunset-120, sunset, sunset+120, (24*60)];

			Factory.waterScale.domain(sunDomain);
			landScale.domain(sunDomain);

			var waterNight = "#515D89";
			var waterMorning = "#CAE5EA";
			var waterMid = "#B2D9EA";
			var waterEvening = "#B7C6E5";

			var landNight = "#464651";
			var landMorning = "#F7E8DC";
			var landMid = "#F5F5F5";
			var landEvening = "#E5BAC0";

			Factory.waterScale.range([waterNight, waterNight, waterMorning, waterMid, waterMid, waterEvening, waterNight, waterNight]);
			landScale.range([landNight, landNight, landMorning, landMid, landMid, landEvening, landNight, landNight]);

		}

		// Resize behavior called when window size changes.
		function resize() {

			// find new bounding box
			bbox = Factory.seattle.node().parentNode.getBoundingClientRect();

			// Resize canvases
			Factory.bikes.attr("width", bbox.width);
			Factory.bikes.attr("height", bbox.height);
			Factory.stations.attr("width", bbox.width);
			Factory.stations.attr("height", bbox.height);
			Factory.seattle.attr("width", bbox.width);
			Factory.seattle.attr("height", bbox.height);

			// Update x and y scales with new domain and range.
			// The domain has to change because we don't want it to scale down
			// at small sizes
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



		function drawBikes() {

			var bikes = Factory.bikeQueue.posData;

			// Get context, clear it, save it's state, then apply current
			// translation and zoom
			var ctx = Factory.bikes.node().getContext("2d");
			ctx.clearRect(0, 0, bbox.width, bbox.height);
			ctx.save()
			ctx.translate(translation[0], translation[1]);
			ctx.scale(zoomLevel, zoomLevel);
			
			// Draw each bike
			angular.forEach(bikes, function(bike) {

				if (!bike.sameStation) {

					// Draw bike paths
					ctx.beginPath();
					ctx.moveTo(bike.start[0], bike.start[1]);
					ctx.lineTo(bike.current[0],bike.current[1]);
					ctx.lineWidth=3;
					ctx.strokeStyle = "rgba(0,0,0,0.1)";
					ctx.stroke();

				} else {

					// Draw "joy ride" circles around stations
					ctx.beginPath();
					ctx.arc(bike.start[0],bike.start[1],14,-bike.current[2],0)
					ctx.lineWidth=3;
					ctx.strokeStyle = "rgba(0,0,0,0.1)";
					ctx.stroke();

				}

				// Draw bike
				ctx.beginPath();
				ctx.arc(bike.current[0],bike.current[1],3,0,2*Math.PI);
				ctx.fillStyle = "#3498db";
				ctx.lineWidth=1;
				ctx.strokeStyle = "white";
				ctx.stroke();
				ctx.fill();

			});

			ctx.restore();

		}


		function drawStations(stations) {

			// Either store the new data
			// OR pull it from memory
			if (stations) {
				Factory.stations.datum(stations)
			} else {
				stations = Factory.stations.datum();
			}

			// Get context, clear it, save it's state, then apply current
			// translation and zoom
			var ctx = Factory.stations.node().getContext("2d");
			ctx.clearRect(0, 0, bbox.width, bbox.height);
			ctx.save()
			ctx.translate(translation[0], translation[1]);
			ctx.scale(zoomLevel, zoomLevel);

			angular.forEach(stations, function(station) {
				
				// Station x and y in pixel coords
				var x = xScale(+station.long);
				var y = yScale(+station.lat);

				// Draw circles
				ctx.beginPath();
				ctx.arc(x,y,4,0,2*Math.PI);
				ctx.fillStyle = "#27ae60";
				ctx.lineWidth=2;
				ctx.strokeStyle = "#EEE";
				ctx.fill();
				ctx.stroke();

			});

			// Restore previous state
			ctx.restore();

		}

		function drawMap(polygons) {

			// Either store the new data
			// OR pull it from memory
			if (polygons) {
				Factory.seattle.datum(polygons)
			} else {
				polygons = Factory.seattle.datum();
			}

			// Get context, clear it, save it's state, then apply current
			// translation and zoom
			var ctx = Factory.seattle.node().getContext('2d');
			ctx.clearRect(0, 0, bbox.width, bbox.height);
			ctx.save()
			ctx.translate(translation[0], translation[1]);
			ctx.scale(zoomLevel, zoomLevel);

			// Start drawing path
			ctx.beginPath();

			// For each polygon, move the line path and continue drawing until
			// that poylgon is finished
			for (var i=0; i<polygons.length; i++) {
					var polygon = polygons[i];
					ctx.moveTo(xScale(polygon[0].x), yScale(polygon[0].y));
					for (var k=1; k<polygon.length; k++) {
						ctx.lineTo(xScale(polygon[k].x), yScale(polygon[k].y));
					}
			}

			// Apply style attributes and draw polygons
			ctx.fillStyle = _currentTime ? landScale(_currentTime) : "#EEE";
			ctx.strokeStyle = _currentTime ? landScale(_currentTime) : "#FFF";
			ctx.lineWidth=2;
			ctx.fill();
			ctx.stroke();

			// Restore previous state
			ctx.restore();

		}

		// When zoomed everything has to be redrawn
		function zoom() {

			// Update translation and zoom
			translation = d3.event.translate;
			zoomLevel = d3.event.scale;

			// var canvas = Factory.seattle.node().getContext("2d");
			// canvas.save();
			drawMap();
			// canvas.restore();

			// canvas = Factory.stations.node().getContext("2d");
			// canvas.save();
			drawStations();
			// canvas.restore();

			// canvas = Factory.bikes.node().getContext("2d");
			// canvas.save();
			drawBikes();
			// canvas.restore();

		}




	}

})();

