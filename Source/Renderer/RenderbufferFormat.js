/*global define*/
define([], function() {
    "use strict";

    /**
     * DOC_TBA
     *
     * @exports RenderbufferFormat
     */
    var RenderbufferFormat = {
        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x8056
         */
        RGBA4 : 0x8056,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x8057
         */
        RGB5_A1 : 0x8057,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x8D62
         */
        RGB565 : 0x8D62,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x81A5
         */
        DEPTH_COMPONENT16 : 0x81A5,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0x8D48
         */
        STENCIL_INDEX8 : 0x8D48,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 084F9
         */
        DEPTH_STENCIL : 0x84F9,

        /**
         * DOC_TBA
         *
         * @param {RenderBufferFormat} renderbufferFormat
         *
         * @returns {Boolean}
         */
        validate : function(renderbufferFormat) {
            return ((renderbufferFormat === RenderbufferFormat.RGBA4) ||
                    (renderbufferFormat === RenderbufferFormat.RGB5_A1) ||
                    (renderbufferFormat === RenderbufferFormat.RGB565) ||
                    (renderbufferFormat === RenderbufferFormat.DEPTH_COMPONENT16) ||
                    (renderbufferFormat === RenderbufferFormat.STENCIL_INDEX8) ||
                    (renderbufferFormat === RenderbufferFormat.DEPTH_STENCIL));
        }
    };

    return RenderbufferFormat;
});
