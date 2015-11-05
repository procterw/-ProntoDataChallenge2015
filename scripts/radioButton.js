// Creates a full page popup that fades out when clicked
// Relies on CSS rules from Mazama_databrowser_base.css
// There should be no need to make changes to this

angular.module('App')

	.directive('radioButton', [function () {

    return {
      restrict: 'E',		// Is an element <popup> </popup>
      scope: false,
      transclude: true,		// Allows HTML content inside
      link: function($scope, ele, atr) {

      }
    }

  }]);