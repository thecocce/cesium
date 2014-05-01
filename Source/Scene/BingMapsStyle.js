/*global define*/
define([], function() {
    "use strict";

    /**
     * An enumeration of the types of imagery provided by Bing Maps.
     *
     * @exports BingMapsStyle
     *
     * @see BingMapsImageryProvider
     */
    var BingMapsStyle = {
        /**
         * Aerial imagery.
         *
         * @type {Number}
         * @constant
         * @default 0
         */
        AERIAL : 0,

        /**
         * Aerial imagery with a road overlay.
         *
         * @type {Number}
         * @constant
         * @default 1
         */
        AERIAL_WITH_LABELS : 1,

        /**
         * Roads without additional imagery.
         *
         * @type {Number}
         * @constant
         * @default 2
         */
        ROAD : 2,

        /**
         * Ordnance Survey imagery
         *
         * @type {Number}
         * @constant
         * @default 3
         */
        ORDNANCE_SURVEY : 3,

        /**
         * Collins Bart imagery.
         *
         * @type {Number}
         * @constant
         * @default 4
         */
        COLLINS_BART : 4
    };

    return BingMapsStyle;
});
