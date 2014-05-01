/*global define*/
define([], function() {
    "use strict";

    /**
     * DOC_TBA
     *
     * @exports MipmapHint
     */
    var MipmapHint = {
        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x1100
         */
        DONT_CARE : 0x1100,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x1101
         */
        FASTEST : 0x1101,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x1102
         */
        NICEST : 0x1102,

        /**
         * DOC_TBA
         *
         * @param {MipmapHint} mipmapHint
         *
         * @returns {Boolean}
         */
        validate : function(mipmapHint) {
            return ((mipmapHint === MipmapHint.DONT_CARE) ||
                    (mipmapHint === MipmapHint.FASTEST) ||
                    (mipmapHint === MipmapHint.NICEST));
        }
    };

    return MipmapHint;
});
