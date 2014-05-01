/*global define*/
define([], function() {
    "use strict";

    /**
     * DOC_TBA
     *
     * @exports SceneMode
     */
    var SceneMode = {
        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 0
         */
        SCENE2D : 0,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 1
         */
        COLUMBUS_VIEW : 1,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 2
         */
        SCENE3D : 2,

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @constant
         * @default 3
         */
        MORPHING : 3
    };

    return SceneMode;
});
