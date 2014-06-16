/*global define*/
define([
        '../Core/loadImage',
        '../Core/Color',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/PrimitiveType',
        '../Core/Geometry',
        '../Core/GeometryAttributes',
        '../Core/GeometryAttribute',
        '../Core/ComponentDatatype',
        '../Core/GeometryPipeline',
        '../Core/Math',
        '../Core/Matrix3',
        '../Core/Matrix4',
        '../Core/Cartesian3',
        '../Renderer/Texture',
        '../Renderer/DrawCommand',
        '../Renderer/BufferUsage',
        '../Core/WindingOrder',
        './CameraController',
        './Pass',
        './Material',
        './BlendEquation',
        './BlendFunction',
        './CullFace',
        './StencilFunction',
        './StencilOperation',
        './DepthFunction',
        '../ThirdParty/when'
    ], function(
        loadImage,
        Color,
        defaultValue,
        defined,
        destroyObject,
        DeveloperError,
        PrimitiveType,
        Geometry,
        GeometryAttributes,
        GeometryAttribute,
        ComponentDatatype,
        GeometryPipeline,
        CesiumMath,
        Matrix3,
        Matrix4,
        Cartesian3,
        Texture,
        DrawCommand,
        BufferUsage,
        WindingOrder,
        CameraController,
        Pass,
        Material,
        BlendEquation,
        BlendFunction,
        CullFace,
        StencilFunction,
        StencilOperation,
        DepthFunction,
        when) {
    "use strict";

    var compass_texturePath = "compass_da.png";

    /**
     * A renderable compass.
     *
     * @alias CompassPrimitive
     * @constructor
     *
     *  Options:
     *  x : Horizontal position on canvas (in percentage, from 0 to 100)
     *  y : Vertical position on canvas (in percentage, from 0 to 100)
     *  scale : Compass scale (1.0 means normal size, 0.5 means half of the size, etc)
     *  tilt : Compass tilt, default is 45 degrees
     */
    var CompassPrimitive = function(cameraController, canvas, options) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(cameraController)) {
            throw new DeveloperError('cameraController is required');
        }

        if (!defined(canvas)) {
            throw new DeveloperError('canvas is required');
        }
        //>>includeEnd('debug');

        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        this._cameraController = cameraController;
        this._canvas = canvas;

        this._scale = defaultValue(options.scale, 1.0);
        this._X = defaultValue(options.x, 90.0);
        this._Y = defaultValue(options.x, 10.0);
        this._tilt = defaultValue(options.tilt, 45.0);


        this._scale *= 0.2; // scale down because compass mesh was done with 500x500 size, now we're using 100x100


        /**
         * Determines if this primitive will be shown.
         *
         * @type Boolean
         *
         * @default true
         */
        this.show = defaultValue(options.show, true);


        /**
         * Determines if the geometry instances will be created and batched on
         * a web worker.
         *
         * @type Boolean
         *
         * @default true
         */
        this.asynchronous = defaultValue(options.asynchronous, true);

        /**
         * This property is for debugging only; it is not for production use nor is it optimized.
         * <p>
         * Draws the bounding sphere for each {@link DrawCommand} in the primitive.
         * </p>
         *
         * @type {Boolean}
         *
         * @default false
         */
        this.debugShowBoundingVolume = defaultValue(options.debugShowBoundingVolume, false);
    };

    /**
     * @private
     */
    CompassPrimitive.prototype.update = function(context, frameState, commandList) {
        if (!this.show) {
            return;
        }


        if (!defined(this._drawCommand)) {

             var defaults = {
                  frontFace : WindingOrder.COUNTER_CLOCKWISE,
                  cull : {
                      enabled : true,
                      face : CullFace.BACK
                   },
                   lineWidth : 1,
                   polygonOffset : {
                           enabled : false,
                           factor : 0,
                           units : 0
                    },
                    scissorTest : {
                        enabled : false,
                        rectangle : {
                        x : 0,
                        y : 0,
                        width : 0,
                        height : 0
                        }
                    },
                    depthRange : {
                        near : 0,
                        far : 1
                    },
                    depthTest : {
                        enabled : false,
                        func : DepthFunction.LESS
                    },
                    colorMask : {
                        red : true,
                        green : true,
                        blue : true,
                        alpha : true
                    },
                    depthMask : true,
                    stencilMask : ~0,
                    blending : {
                        enabled : true,
                        color : {
                            red : 0.0,
                            green : 0.0,
                            blue : 0.0,
                            alpha : 0.0
                    },
                    equationRgb : BlendEquation.ADD,
                    equationAlpha : BlendEquation.ADD,
                    functionSourceRgb : BlendFunction.SOURCE_ALPHA,
                    functionSourceAlpha : BlendFunction.SOURCE_ALPHA,
                    functionDestinationRgb : BlendFunction.ONE_MINUS_SOURCE_ALPHA,
                    functionDestinationAlpha : BlendFunction.ONE_MINUS_SOURCE_ALPHA
                    },
                    stencilTest : {
                        enabled : false,
                        frontFunction : StencilFunction.ALWAYS,
                        backFunction : StencilFunction.ALWAYS,
                        reference : 0,
                        mask : ~0,
                        frontOperation : {
                            fail : StencilOperation.KEEP,
                            zFail : StencilOperation.KEEP,
                            zPass : StencilOperation.KEEP
                        },
                        backOperation : {
                            fail : StencilOperation.KEEP,
                            zFail : StencilOperation.KEEP,
                            zPass : StencilOperation.KEEP
                        }
                    },
                    sampleCoverage : {
                        enabled : false,
                        value : 1.0,
                        invert : false
                    },
                    dither : false
                    };

             var vs =
                 'uniform mat4 customModelMatrix;\n'+
                 'uniform mat4 customProjMatrix;\n'+
                 'attribute vec4 position;\n'+
                 'attribute vec2 uv;\n'+
                 'attribute vec4 color;\n'+
                 'varying highp vec2 myUVs;\n'+
                 'varying highp vec4 myColor;\n'+
                 'void main(){\n'+
                 'gl_Position = customProjMatrix * customModelMatrix * position;\n'+
                 'myUVs = uv;\n'+
                 'myColor = color;\n'+
                 '}';

             var fs =
                 'varying highp vec2 myUVs;\n' +
                 'varying highp vec4 myColor;\n' +
                 'uniform sampler2D out_texture;\n' +
                 'void main(){\n' +
                 '   lowp vec4 color = texture2D(out_texture, myUVs.xy);\n' +
                 '   gl_FragColor = color  * myColor ;\n' +
                 '}';

            // corresponds to an white non transparent pixel on the current texture, edit if texture is changed
            var WU = 120.0/ 256.0;
            var WV = 120.0/ 256.0;

            var radius = 48.0;
            var lats = 16;
            var longs = 16;

            var pos_ofs = 0;
            var color_ofs = 0;
            var uv_ofs = 0;

            var vertexCount1 = (lats+1) * (longs+1) * 6 ;
            var baseOfs = vertexCount1;
            vertexCount1 += 6;
            var positions1 = new Float32Array(vertexCount1 * 3);
            var colors1 = new Float32Array(vertexCount1 * 4);
            var uvs1 = new Float32Array(vertexCount1 * 2);

            for (var i = 0; i <= lats; i++)
            {
                var lat0 = Math.PI * (-0.5 + (i - 1) / lats);
                var z0 = Math.sin(lat0);
                var zr0 = Math.cos(lat0);

                var lat1 = Math.PI * (-0.5 + i / lats);
                var z1 = Math.sin(lat1);
                var zr1 = Math.cos(lat1);

                var AX0,AY0,AZ0;
                var AX1,AY1,AZ1;
                var BX0,BY0,BZ0;
                var BX1,BY1,BZ1;

                for (var j = 0; j <= longs; j++)
                {
                    if (j>0)
                    {
                        AX0 = BX0; AY0 = BY0; AZ0 = BZ0;
                        AX1 = BX1; AY1 = BY1; AZ1 = BZ1;
                    }

                    var lng = 2 * Math.PI * (j - 1) / longs;
                    var sx = Math.cos(lng);
                    var sy = Math.sin(lng);

                    BX0 = sx * zr0 * radius;
                    BY0 = sy * zr0 * radius;
                    BZ0 = z0 * radius;

                    BX1 = sx * zr1 * radius;
                    BY1 = sy * zr1 * radius;
                    BZ1 = z1 * radius;

                    if (j>0)
                    {
                        for (var k = 0; k < 6*4; k++)
                        {
                            colors1[color_ofs+k] = 0.5;
                        }

                        for (k = 0; k < 6*2; k++)
                        {
                            if (k % 2)
                            {
                                uvs1[uv_ofs+0+k] = WV;
                            }
                            else
                            {
                                uvs1[uv_ofs+0+k] = WU;
                            }
                        }

                        positions1[pos_ofs+0] = BX1;
                        positions1[pos_ofs+1] = BY1;
                        positions1[pos_ofs+2] = BZ1;

                        positions1[pos_ofs+3] = BX0;
                        positions1[pos_ofs+4] = BY0;
                        positions1[pos_ofs+5] = BZ0;

                        positions1[pos_ofs+6] = AX1;
                        positions1[pos_ofs+7] = AY1;
                        positions1[pos_ofs+8] = AZ1;

                        positions1[pos_ofs+9] = AX0;
                        positions1[pos_ofs+10] = AY0;
                        positions1[pos_ofs+11] = AZ0;

                        positions1[pos_ofs+12] = AX1;
                        positions1[pos_ofs+13] = AY1;
                        positions1[pos_ofs+14] = AZ1;

                        positions1[pos_ofs+15] = BX0;
                        positions1[pos_ofs+16] = BY0;
                        positions1[pos_ofs+17] = BZ0;

                        pos_ofs += 6*3;
                        uv_ofs += 6*2;
                        color_ofs += 6*4;
                    }
                }
            }

            var size = radius;
            var start_ofs = baseOfs * 3;
            uv_ofs =  baseOfs * 2;

            positions1[start_ofs] = -size;  start_ofs++;
            positions1[start_ofs] = 0;      start_ofs++;
            positions1[start_ofs] = -size;  start_ofs++;
            uvs1[uv_ofs] = 0.0; uv_ofs++;
            uvs1[uv_ofs] = 0.0; uv_ofs++;

            positions1[start_ofs] = size;  start_ofs++;
            positions1[start_ofs] = 0;     start_ofs++;
            positions1[start_ofs] = -size; start_ofs++;
            uvs1[uv_ofs] = 1.0; uv_ofs++;
            uvs1[uv_ofs] = 0.0; uv_ofs++;

            positions1[start_ofs] = size;  start_ofs++;
            positions1[start_ofs] = 0;     start_ofs++;
            positions1[start_ofs] = size;  start_ofs++;
            uvs1[uv_ofs] = 1.0; uv_ofs++;
            uvs1[uv_ofs] = 1.0; uv_ofs++;

            positions1[start_ofs] = -size; start_ofs++;
            positions1[start_ofs] = 0;     start_ofs++;
            positions1[start_ofs] = -size; start_ofs++;
            uvs1[uv_ofs] = 0.0; uv_ofs++;
            uvs1[uv_ofs] = 0.0; uv_ofs++;

            positions1[start_ofs] = size;  start_ofs++;
            positions1[start_ofs] = 0;     start_ofs++;
            positions1[start_ofs] = size;  start_ofs++;
            uvs1[uv_ofs] = 1.0; uv_ofs++;
            uvs1[uv_ofs] = 1.0; uv_ofs++;

            positions1[start_ofs] = -size; start_ofs++;
            positions1[start_ofs] = 0;     start_ofs++;
            positions1[start_ofs] = size;  start_ofs++;
            uvs1[uv_ofs] = 0.0; uv_ofs++;
            uvs1[uv_ofs] = 1.0; uv_ofs++;

            start_ofs =  baseOfs * 4;
            for (var k=start_ofs; k<start_ofs+6*4; k++)
            {
                colors1[k] = 1.0;
            }

            var geoAttribs1 = function(options) {};

            geoAttribs1.position = new GeometryAttribute({
                    componentDatatype : ComponentDatatype.FLOAT,
                    componentsPerAttribute : 3,
                    values : positions1
            });

            geoAttribs1.uv = new GeometryAttribute({
                    componentDatatype : ComponentDatatype.FLOAT,
                    componentsPerAttribute : 2,
                    values : uvs1
            });

            geoAttribs1.color = new GeometryAttribute({
                    componentDatatype : ComponentDatatype.FLOAT,
                    componentsPerAttribute : 4,
                    values : colors1
            });

            var geo1 = new Geometry({
                attributes : geoAttribs1,
                primitiveType : PrimitiveType.TRIANGLES
            });

            var attribLoc1 = GeometryPipeline.createAttributeLocations(geo1);

            var vertexArray1 = context.createVertexArrayFromGeometry({
                geometry : geo1,
                attributeLocations : attribLoc1,
                bufferUsage : BufferUsage.STATIC_DRAW,
                interleave : true
            });

            this._shaderProgram1 = context.createShaderProgram(vs, fs, attribLoc1);


            pos_ofs = 0;
            color_ofs = 0;
            uv_ofs = 0;

            var segments = 32;
            var dx = 360*(Math.PI/180) / segments;

            var vertexCount2 = segments * 2 * 3;
            var positions2 = new Float32Array(vertexCount2 * 3);
            var colors2 = new Float32Array(vertexCount2 * 4);
            var uvs2 = new Float32Array(vertexCount2 * 2);

            for (var k=0; k<3; k++)
            {
                var angle = 0;
                var AX0,AY0,AZ0;
                var BX0,BY0,BZ0;

                for (var i=0; i<=segments; i++)
                {
                    if (i>0)
                    {
                        AX0 = BX0; AY0 = BY0; AZ0 = BZ0;
                    }

                    var SX = Math.cos(angle) * radius;
                    var SY = Math.sin(angle) * radius;

                    if (k===0)
                    {
                        BX0 = SX; BY0 = 0; BZ0 = SY;
                    }
                    else
                    if (k===1)
                    {
                        BX0 = SX; BY0 = SY; BZ0 = 0;
                    }
                    else
                    {
                        BX0 = 0; BY0 = SX; BZ0 = SY;
                    }

                    if (i>0)
                    {
                        positions2[pos_ofs+0] = AX0;
                        positions2[pos_ofs+1] = AY0;
                        positions2[pos_ofs+2] = AZ0;

                        colors2[color_ofs+0] = 0.5;
                        colors2[color_ofs+1] = 0.5;
                        colors2[color_ofs+2] = 0.5;
                        colors2[color_ofs+3] = 0.5;

                        uvs2[uv_ofs+0] = WU;
                        uvs2[uv_ofs+1] = WV;

                        positions2[pos_ofs+3] = BX0;
                        positions2[pos_ofs+4] = BY0;
                        positions2[pos_ofs+5] = BZ0;

                        colors2[color_ofs+4] = colors2[color_ofs+0];
                        colors2[color_ofs+5] = colors2[color_ofs+1];
                        colors2[color_ofs+6] = colors2[color_ofs+2];
                        colors2[color_ofs+7] = colors2[color_ofs+3];

                        uvs2[uv_ofs+2] = WU;
                        uvs2[uv_ofs+3] = WV;

                        pos_ofs += 2*3;
                        uv_ofs += 2*2;
                        color_ofs += 2*4;
                    }

                    angle = angle + dx;
                }
            }

            var geoAttribs2 = function(options) {};

            geoAttribs2.position = new GeometryAttribute({
                    componentDatatype : ComponentDatatype.FLOAT,
                    componentsPerAttribute : 3,
                    values : positions2
            });

            geoAttribs2.uv = new GeometryAttribute({
                    componentDatatype : ComponentDatatype.FLOAT,
                    componentsPerAttribute : 2,
                    values : uvs2
            });

            geoAttribs2.color = new GeometryAttribute({
                    componentDatatype : ComponentDatatype.FLOAT,
                    componentsPerAttribute : 4,
                    values : colors2
            });

            var geo2 = new Geometry({
                attributes : geoAttribs2,
                primitiveType : PrimitiveType.LINES
            });

            var attribLoc2 = GeometryPipeline.createAttributeLocations(geo2);

            var vertexArray2 = context.createVertexArrayFromGeometry({
                geometry : geo2,
                attributeLocations : attribLoc2,
                bufferUsage : BufferUsage.STATIC_DRAW,
                interleave : true
            });

//            this._shaderProgram2 = context.createShaderProgram(vs, fs, attribLoc2);

            this._projectionMatrix = Matrix4.computeOrthographicOffCenter(0.0, 100, 100, 0.0, 0.0, 300);

            this._modelMatrix = Matrix4.IDENTITY;

            this._texture = undefined;

            var that = this;
            this._uniforms = {
                customProjMatrix : function() {
                    return that._projectionMatrix;
                },

                customModelMatrix : function() {
                    return that._modelMatrix;
                },

                out_texture : function() {
                    if (!defined(that._texture)) {
                        that._texture = Material._textureCache.getTexture(compass_texturePath);
                    }

                    if (defined(that._texture)) {
                        return that._texture;
                    }
                    else
                    {
                        return 0;
                    }

                }
            };


            var compassImage = new Image();
            compassImage.onerror = function () {
                //alert("image loading error: "+compass_texturePath);
            };

            compassImage.onload = function () {
                var texture = Material._textureCache.getTexture(compass_texturePath);
                if (!defined(texture)) {
                    texture = context.createTexture2D({
                    source : compassImage
                    });
                    Material._textureCache.addTexture(compass_texturePath, texture);
                    //alert('Image '+compass_texturePath+' loaded!');
                }
            };

            compassImage.src = compass_texturePath;


            this._drawCommand1 = new DrawCommand({ owner : this});
            this._drawCommand1.vertexArray = vertexArray1;
            this._drawCommand1.count = vertexCount1;
            this._drawCommand1.cull = false;
            this._drawCommand1.renderState = context.createRenderState(defaults);
            this._drawCommand1.shaderProgram = this._shaderProgram1;
            this._drawCommand1.uniformMap = this._uniforms;
            this._drawCommand1.pass = Pass.OVERLAY;

            this._drawCommand2 = new DrawCommand({ owner : this});
            this._drawCommand2.vertexArray = vertexArray2;
            this._drawCommand2.count = vertexCount2;
            this._drawCommand2.cull = false;
            this._drawCommand2.primitiveType = PrimitiveType.LINES;
            this._drawCommand2.renderState = context.createRenderState(defaults);
            this._drawCommand2.shaderProgram = this._shaderProgram1;
            this._drawCommand2.uniformMap = this._uniforms;
            this._drawCommand2.pass = Pass.OVERLAY;
        }


        var passes = frameState.passes;

        if (passes.render) {

            var heading = this._cameraController.heading;

            var ratio = this._canvas.height/this._canvas.width;

            var rotationX = Matrix3.fromRotationX(Cesium.Math.toRadians(this._tilt));
            var rotationY = Matrix3.fromRotationY(heading);
            var finalRotation = Matrix3.multiply(rotationX, rotationY);
            var ratioScale = Matrix3.fromScale(new Cesium.Cartesian3(this._scale * ratio, this._scale, this._scale * ratio));
            var finalTransform = Matrix3.multiply(finalRotation, ratioScale);

            var screenOfs = new Cartesian3(this._X, this._Y, -100.0);
            this._modelMatrix = Matrix4.fromRotationTranslation(finalTransform, screenOfs);

            commandList.push(this._drawCommand1);
            commandList.push(this._drawCommand2);
        }
    };


    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @memberof CompassPrimitive
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see Rectangle#destroy
     */
    CompassPrimitive.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
     * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>undefined</code>) to the object as done in the example.
     *
     * @memberof CompassPrimitive
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see CompassPrimitive#isDestroyed
     *
     */
    CompassPrimitive.prototype.destroy = function() {
        return destroyObject(this);
    };

    return CompassPrimitive;
});
