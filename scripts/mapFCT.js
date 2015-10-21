

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

		
		// The Queue of bike positions to draw
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




		// Initialize scales
		var xScale = d3.scale.linear();
		var yScale = d3.scale.linear();
		var waterScale = d3.scale.linear();
		var landScale = d3.scale.linear();
		var borderScale = d3.scale.linear();
		var pathScale = d3.scale.linear();

		// d3 zoom behavior
		Factory.stations.call(d3.behavior.zoom()
			.scaleExtent([0.5, 2])
			.on("zoom", zoom))

		// Keep track of translations and zooms
		var translation = [0,0];
		var zoomLevel = 1;
		var retinaZoom = 1;

		// Keep track of width and height
		var width;
		var height;

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
			borderScale.domain(sunDomain);
			pathScale.domain(sunDomain);

			var waterNight = "#515D89";
			var waterMorning = "#CAE5EA";
			var waterMid = "#B2D9EA";
			var waterEvening = "#B7C6E5";

			var landNight = "#464651";
			var landMorning = "#F7E8DC";
			var landMid = "#F5F5F5";
			var landEvening = "#E5BAC0";

			var borderNight = "#515D89";
			var borderMorning = "#CAE5EA";
			var borderMid = "#B2D9EA";
			var borderEvening = "#B7C6E5";

			var pathNight = "rgba(255,255,255,0.1)";
			var pathDay = "rgba(0,0,0,0.1)";


			Factory.waterScale.range([waterNight, waterNight, waterMorning, waterMid, waterMid, waterEvening, waterNight, waterNight]);

			landScale.range([landNight, landNight, landMorning, landMid, landMid, landEvening, landNight, landNight]);

			borderScale.range([borderNight, borderNight, borderMorning, borderMid, borderMid, borderEvening, borderNight, borderNight]);

			pathScale.range([pathNight, pathNight, pathDay, pathDay, pathDay, pathDay, pathNight, pathNight])

		}

		// Resize behavior called when window size changes.
		function resize() {

			// Find retina zoom level
			var devicePixelRatio = window.devicePixelRatio || 1
			var ctx = Factory.bikes.node().getContext('2d');
	    var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
        ctx.mozBackingStorePixelRatio ||
        ctx.msBackingStorePixelRatio ||
        ctx.oBackingStorePixelRatio ||
        ctx.backingStorePixelRatio || 1

      // retinaZoom = 1;
      retinaZoom = devicePixelRatio / backingStoreRatio;

      zoomLevel = zoomLevel * retinaZoom;

			// find new bounding box
			var bbox = Factory.seattle.node().parentNode.getBoundingClientRect();

			width = bbox.width * retinaZoom;
			height = bbox.height * retinaZoom;

			// Resize canvases
			Factory.bikes.attr("width", width);
			Factory.bikes.attr("height", height);
			Factory.stations.attr("width", width);
			Factory.stations.attr("height", height);
			Factory.seattle.attr("width", width);
			Factory.seattle.attr("height",height);

			Factory.bikes.style("width", width/retinaZoom + "px");
			Factory.bikes.style("height", height/retinaZoom + "px");
			Factory.stations.style("width", width/retinaZoom + "px");
			Factory.stations.style("height", height/retinaZoom + "px");
			Factory.seattle.style("width", width/retinaZoom + "px");
			Factory.seattle.style("height", height/retinaZoom + "px");

			// Update x and y scales with new domain and range.
			// The domain has to change because we don't want it to scale down
			// at small sizes
			var screenScale = Math.min(250, width, height);

			// Always focus the map on this point when zoomed out?
			var mapCenterX = -122.3215;
			var mapCenterY = 47.63;

			xScale
				.domain([
					mapCenterX - 0.016 * (width/screenScale) / retinaZoom,
					mapCenterX + 0.016 * (width/screenScale) / retinaZoom
					])
				.range([0,width/retinaZoom]);

			yScale
				.domain([
					mapCenterY - 0.011 * (height/screenScale) / retinaZoom,
					mapCenterY + 0.011 * (height/screenScale) / retinaZoom
					])
				.range([height/retinaZoom,0]);

			console.log(xScale(mapCenterX))

		}



		function drawBikes() {

			var bikes = Factory.bikeQueue.posData;

			// Get context, clear it, save it's state, then apply current
			// translation and zoom
			var ctx = Factory.bikes.node().getContext("2d");
			ctx.clearRect(0, 0, width, height);
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
					ctx.strokeStyle = _currentTime ? pathScale(_currentTime) : "rgba(0,0,0,0.1)";
					ctx.stroke();

				} else {

					// Draw "joy ride" circles around stations
					ctx.beginPath();
					ctx.arc(bike.start[0],bike.start[1],14,-bike.current[2],0)
					ctx.lineWidth=3;
					ctx.strokeStyle = _currentTime ? pathScale(_currentTime) : "rgba(0,0,0,0.1)";
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
			ctx.clearRect(0, 0, width, height);
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
			ctx.clearRect(0, 0, width, height);
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
			ctx.fillStyle = _currentTime ? landScale(_currentTime) : "rgb(245,245,245)";
			ctx.strokeStyle = _currentTime ? borderScale(_currentTime) : "rgb(252,252,252)";
			ctx.lineWidth=1;
			ctx.fill();
			ctx.stroke();

			// Restore previous state
			ctx.restore();

		}

		// When zoomed everything has to be redrawn
		function zoom() {

			// Update translation and zoom
			translation = d3.event.translate;
			zoomLevel = d3.event.scale * retinaZoom;

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

