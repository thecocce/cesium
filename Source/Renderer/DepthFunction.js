/*global define*/
define([], function() {
    "use strict";

    /**
     * DOC_TBA
     *
     * @exports DepthFunction
     */
    var DepthFunction = {
        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x200
         */
        NEVER : 0x0200,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x201
         */
        LESS : 0x0201,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x202
         */
        EQUAL : 0x0202,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x203
         */
        LESS_OR_EQUAL : 0x0203,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x204
         */
        GREATER : 0x0204,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x25
         */
        NOT_EQUAL : 0x0205,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x206
         */
        GREATER_OR_EQUAL : 0x0206,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x207
         */
        ALWAYS : 0x0207,

        /**
         * DOC_TBA
         *
         * @param {DepthFunction} depthFunction
         *
         * @returns {Boolean}
         */
        validate : function(depthFunction) {
            return ((depthFunction === DepthFunction.NEVER) ||
                    (depthFunction === DepthFunction.LESS) ||
                    (depthFunction === DepthFunction.EQUAL) ||
                    (depthFunction === DepthFunction.LESS_OR_EQUAL) ||
                    (depthFunction === DepthFunction.GREATER) ||
                    (depthFunction === DepthFunction.NOT_EQUAL) ||
                    (depthFunction === DepthFunction.GREATER_OR_EQUAL) ||
                    (depthFunction === DepthFunction.ALWAYS));
        }
    };

    return DepthFunction;
});
