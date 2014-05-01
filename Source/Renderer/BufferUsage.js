/*global define*/
define([], function() {
    "use strict";

    /**
     * DOC_TBA
     *
     * @exports BufferUsage
     */
    var BufferUsage = {
        /**
         * DOC_TBA
         *
         * @constant
         * @type {Number}
         */
        STREAM_DRAW : 0x88E0,
        /**
         * DOC_TBA
         *
         * @constant
         * @type {Number}
         */
        STATIC_DRAW : 0x88E4,
        /**
         * DOC_TBA
         *
         * @constant
         * @type {Number}
         */
        DYNAMIC_DRAW : 0x88E8,

        /**
         * DOC_TBA
         *
         * @param bufferUsage
         *
         * @returns {Boolean}
         */
        validate : function(bufferUsage) {
            return ((bufferUsage === BufferUsage.STREAM_DRAW) ||
                    (bufferUsage === BufferUsage.STATIC_DRAW) ||
                    (bufferUsage === BufferUsage.DYNAMIC_DRAW));
        }
    };

    return BufferUsage;
});
