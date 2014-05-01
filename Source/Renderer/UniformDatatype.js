/*global define*/
define([], function() {
    "use strict";

    /**
     * Indicates a GLSL uniform's datatype.
     *
     * @exports UniformDatatype
     * @see Uniform.datatype
     */
    var UniformDatatype = {
        /**
         * A <code>float</code> uniform.
         *
         * @type {Number}
         * @constant
         * @default 0x1406
         */
        FLOAT : 0x1406,

        /**
         * A <code>vec2</code> uniform: a two-component floating-point vector.
         *
         * @type {Number}
         * @constant
         * @default 0x8B50
         */
       FLOAT_VEC2 : 0x8B50,

        /**
         * A <code>vec3</code> uniform: a three-component floating-point vector.
         *
         * @type {Number}
         * @constant
         * @default 0x8B51
         */
        FLOAT_VEC3 : 0x8B51,

        /**
         * A <code>vec4</code> uniform: a four-component floating-point vector.
         *
         * @type {Number}
         * @constant
         * @default 0x8B52
         */
        FLOAT_VEC4 : 0x8B52,

        /**
         * An <code>int</code> uniform.
         *
         * @type {Number}
         * @constant
         * @default 0x1404
         */
        INT : 0x1404,

        /**
         * An <code>ivec2</code> uniform: a two-component integer vector.
         *
         * @type {Number}
         * @constant
         * @default 0x8B53
         */
        INT_VEC2 : 0x8B53,

        /**
         * An <code>ivec3</code> uniform: a three-component integer vector.
         *
         * @type {Number}
         * @constant
         * @default 0x8B54
         */
        INT_VEC3 : 0x8B54,

        /**
         * An <code>ivec4</code> uniform: a four-component integer vector.
         *
         * @type {Number}
         * @constant
         * @default 0x8B55
         */
        INT_VEC4 : 0x8B55,

        /**
         * A <code>bool</code> uniform.
         *
         * @type {Number}
         * @constant
         * @default 0x8B56
         */
        BOOL : 0x8B56,

        /**
         * A <code>bvec2</code> uniform: a two-component boolean vector.
         *
         * @type {Number}
         * @constant
         * @default 0x8B57
         */
        BOOL_VEC2 : 0x8B57,

        /**
         * A <code>bvec3</code> uniform: a three-component boolean vector.
         *
         * @type {Number}
         * @constant
         * @default 0x8B58
         */
        BOOL_VEC3 : 0x8B58,

        /**
         * A <code>bvec4</code> uniform: a four-component boolean vector.
         *
         * @type {Number}
         * @constant
         * @default 0x8B59
         */
        BOOL_VEC4 : 0x8B59,

        /**
         * An <code>mat2</code> uniform: a 2x2 floating-point matrix.
         *
         * @type {Number}
         * @constant
         * @default 0x8B5A
         */
        FLOAT_MAT2 : 0x8B5A,

        /**
         * An <code>mat3</code> uniform: a 3x3 floating-point matrix.
         *
         * @type {Number}
         * @constant
         * @default 0x8B5B
         */
        FLOAT_MAT3 : 0x8B5B,

        /**
         * An <code>mat4</code> uniform: a 4x4 floating-point matrix.
         *
         * @type {Number}
         * @constant
         * @default 0x8B5C
         */
        FLOAT_MAT4 : 0x8B5C,

        /**
         * A <code>sampler2D</code> uniform: an opaque type to access 2D textures.
         *
         * @type {Number}
         * @constant
         * @default 0x8B5E
         */
        SAMPLER_2D : 0x8B5E,

        /**
         * A <code>samplerCube</code> uniform: an opaque type to access cube-map textures.
         *
         * @type {Number}
         * @constant
         * @default 0x8B60
         */
        SAMPLER_CUBE : 0x8B60
    };

    return UniformDatatype;
});
