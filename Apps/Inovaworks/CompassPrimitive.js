
    var scratchHeadingMatrix4 = new Cesium.Matrix4();
    var scratchHeadingMatrix3 = new Cesium.Matrix3();
    var scratchHeadingCartesian3 = new Cesium.Cartesian3();

    function getHeading3D(camera) 
	{
        var ellipsoid = camera._projection.ellipsoid;
        var toFixedFrame = Cesium.Transforms.eastNorthUpToFixedFrame(camera.position, ellipsoid, scratchHeadingMatrix4);
        var transform = Cesium.Matrix4.getRotation(toFixedFrame, scratchHeadingMatrix3);
        Cesium.Matrix3.transpose(transform, transform);

        var right = Cesium.Matrix3.multiplyByVector(transform, camera.rightWC, scratchHeadingCartesian3);
        return Math.atan2(right.y, right.x);
    }

    function getTiltCV(camera) {
        // CesiumMath.acosClamped(dot(camera.direction, Cartesian3.negate(Cartesian3.UNIT_Z))
        return Cesium.Math.PI_OVER_TWO - Cesium.Math.acosClamped(-camera.directionWC.z);
    }
	
function MatrixLookAt(eye, lookAt, up)
{
	var proj = new Cesium.Cartesian3(0,0,0);
	
	Cesium.Cartesian3.subtract(eye, lookAt, lookAt);	
	Cesium.Cartesian3.normalize(lookAt, lookAt);

	var d = Cesium.Cartesian3.dot(up, lookAt);

	Cesium.Cartesian3.multiplyByScalar(lookAt, d, proj);

	Cesium.Cartesian3.subtract(up, proj, up);
	Cesium.Cartesian3.normalize(up, up);

	var right = new Cesium.Cartesian3(0,0,0);
	Cesium.Cartesian3.cross(up, lookAt, right);

	var m00 = right.x;
	var m01 = up.x;
	var m02 = lookAt.x;
	var m10 = right.y;
	var m11 = up.y;
	var m12 = lookAt.y;
	var m20 = right.z;
	var m21 = up.z;
	var m22 = lookAt.z;

	var Q = new Cesium.Quaternion(0,0,0,0);
	Q.w = Math.sqrt(1.0 + m00 + m11 + m22) * 0.5;
	var w4_recip = 1.0 / (4.0 * Q.w);
	Q.x = (m21 - m12) * w4_recip;
	Q.y = (m02 - m20) * w4_recip;
	Q.z = (m10 - m01) * w4_recip;

	var Result = new Cesium.Matrix4();

  Result[0] = 1.0 - 2.0*Q.y*Q.y -2.0 *Q.z*Q.z;
  Result[1] = 2.0 * Q.x*Q.y + 2.0 * Q.w*Q.z;
  Result[2] = 2.0 * Q.x*Q.z - 2.0 * Q.w*Q.y;
  Result[3] = 0;

  Result[4] = 2.0 * Q.x*Q.y - 2.0 * Q.w*Q.z;
  Result[5] = 1.0 - 2.0 * Q.x*Q.X - 2.0 * Q.z*Q.z;
  Result[6] = 2.0 * Q.y*Q.z + 2.0 * Q.w*Q.x;
  Result[7] = 0;

  Result[8] = 2.0 * Q.x*Q.z + 2.0 * Q.w*Q.y;
  Result[9] = 2.0 * Q.y*Q.z - 2.0 * Q.w*Q.x;
  Result[10] = 1.0 - 2.0 * Q.x*Q.x - 2.0 * Q.y*Q.y;
  Result[11] = 0;

  Result[12] = 0.0;
  Result[13] = 0.0;
  Result[14] = 0.0;
  Result[15] = 1.0;

	return Result;  
}

/*function MatrixLookAt(Eye, LookAt, Roll)
{
	var xaxis = new Cesium.Cartesian3(0,0,0);
	var yaxis = new Cesium.Cartesian3(0,0,0);
	var zaxis = new Cesium.Cartesian3(0,0,0);

	Cesium.Cartesian3.subtract(Eye, LookAt, zaxis);
	Cesium.Cartesian3.normalize(zaxis, zaxis);

	Cesium.Cartesian3.cross(Roll, zaxis, xaxis);
	Cesium.Cartesian3.normalize(xaxis, xaxis);

	if (xaxis.magnitudeSquared<=0)
	{
		Roll = new Cesium.Cartesian3(-Roll.Z, -Roll.X, -Roll.Y);
		Cesium.Cartesian3.cross(Roll, zaxis, xaxis);
		Cesium.Cartesian3.normalize(xaxis, xaxis);
	}

	Cesium.Cartesian3.cross( zaxis, xaxis, yaxis);

	var Result = new Cesium.Matrix4();

	Result[0] = xaxis.x;
	Result[1] = yaxis.x;
	Result[2] = zaxis.x;
	Result[3] = 0.0;
	Result[4] = xaxis.y;
	Result[5] = yaxis.y;
	Result[6] = zaxis.y;
	Result[7] = 0.0;
	Result[8] = xaxis.z;
	Result[9] = yaxis.z;
	Result[10] = zaxis.z;
	Result[11] = 0.0;
	Result[12] = -Cesium.Cartesian3.dot(xaxis, Eye);
	Result[13] = -Cesium.Cartesian3.dot(yaxis, Eye);
	Result[14] = -Cesium.Cartesian3.dot(zaxis, Eye);
	Result[15] = 1.0;

	return Result;
}*/

    var default_compass_texturePath = "compass_da.png";

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
	 *	texturePath: path to compass texture
     */
    var CompassPrimitive = function(camera, ellipsoid, canvas, options) {
        //>>includeStart('debug', pragmas.debug);
        if (!Cesium.defined(camera)) {
            throw new Cesium.DeveloperError('camera is required');
        }

        if (!Cesium.defined(ellipsoid)) {
            throw new Cesium.DeveloperError('ellipsoid is required');
        }

        if (!Cesium.defined(canvas)) {
            throw new Cesium.DeveloperError('canvas is required');
        }
        //>>includeEnd('debug');

        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

        this._camera = camera;
		this._ellipsoid = ellipsoid;
        this._canvas = canvas;

        this._scale = Cesium.defaultValue(options.scale, 1.0);
        this._X = Cesium.defaultValue(options.x, 90.0);
        this._Y = Cesium.defaultValue(options.y, 10.0);
        this._tilt = Cesium.defaultValue(options.tilt, 0.0);
		this._texturePath = Cesium.defaultValue(options.texturePath, default_compass_texturePath);


        this._scale *= 0.2; // scale down because compass mesh was done with 500x500 size, now we're using 100x100


        /**
         * Determines if this primitive will be shown.
         *
         * @type Boolean
         *
         * @default true
         */
        this.show = Cesium.defaultValue(options.show, true);


        /**
         * Determines if the geometry instances will be created and batched on
         * a web worker.
         *
         * @type Boolean
         *
         * @default true
         */
        this.asynchronous = Cesium.defaultValue(options.asynchronous, true);

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
        this.debugShowBoundingVolume = Cesium.defaultValue(options.debugShowBoundingVolume, false);
    };

    /**
     * @private
     */
    CompassPrimitive.prototype.update = function(context, frameState, commandList) {
        if (!this.show) {
            return;
        }


        if (!Cesium.defined(this._drawCommand1)) {
             var defaults = {
                  frontFace : Cesium.WindingOrder.COUNTER_CLOCKWISE,
                  cull : {
                      enabled : true,
                      face : Cesium.CullFace.BACK
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
                        enabled : true,
                        func : Cesium.DepthFunction.LESS
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
                    equationRgb : Cesium.BlendEquation.ADD,
                    equationAlpha : Cesium.BlendEquation.ADD,
                    functionSourceRgb : Cesium.BlendFunction.SOURCE_ALPHA,
                    functionSourceAlpha : Cesium.BlendFunction.SOURCE_ALPHA,
                    functionDestinationRgb : Cesium.BlendFunction.ONE_MINUS_SOURCE_ALPHA,
                    functionDestinationAlpha : Cesium.BlendFunction.ONE_MINUS_SOURCE_ALPHA
                    },
                    stencilTest : {
                        enabled : false,
                        frontFunction : Cesium.StencilFunction.ALWAYS,
                        backFunction : Cesium.StencilFunction.ALWAYS,
                        reference : 0,
                        mask : ~0,
                        frontOperation : {
                            fail : Cesium.StencilOperation.KEEP,
                            zFail : Cesium.StencilOperation.KEEP,
                            zPass : Cesium.StencilOperation.KEEP
                        },
                        backOperation : {
                            fail : Cesium.StencilOperation.KEEP,
                            zFail : Cesium.StencilOperation.KEEP,
                            zPass : Cesium.StencilOperation.KEEP
                        }
                    },
                    sampleCoverage : {
                        enabled : false,
                        value : 1.0,
                        invert : false
                    },
                    dither : false
                    };

             var defaults2 = {
                  frontFace : Cesium.WindingOrder.COUNTER_CLOCKWISE,
                  cull : {
                      enabled : true,
                      face : Cesium.CullFace.BACK
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
                        func : Cesium.DepthFunction.LESS
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
                    equationRgb : Cesium.BlendEquation.ADD,
                    equationAlpha : Cesium.BlendEquation.ADD,
                    functionSourceRgb : Cesium.BlendFunction.SOURCE_ALPHA,
                    functionSourceAlpha : Cesium.BlendFunction.SOURCE_ALPHA,
                    functionDestinationRgb : Cesium.BlendFunction.ONE_MINUS_SOURCE_ALPHA,
                    functionDestinationAlpha : Cesium.BlendFunction.ONE_MINUS_SOURCE_ALPHA
                    },
                    stencilTest : {
                        enabled : false,
                        frontFunction : Cesium.StencilFunction.ALWAYS,
                        backFunction : Cesium.StencilFunction.ALWAYS,
                        reference : 0,
                        mask : ~0,
                        frontOperation : {
                            fail : Cesium.StencilOperation.KEEP,
                            zFail : Cesium.StencilOperation.KEEP,
                            zPass : Cesium.StencilOperation.KEEP
                        },
                        backOperation : {
                            fail : Cesium.StencilOperation.KEEP,
                            zFail : Cesium.StencilOperation.KEEP,
                            zPass : Cesium.StencilOperation.KEEP
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

            var vertexCount1 = ((lats+1) * (longs+1)) * 6 ;
            var baseOfs = vertexCount1;
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
                        positions1[pos_ofs+2] = - BZ1;

                        positions1[pos_ofs+3] = BX0;
                        positions1[pos_ofs+4] = BY0;
                        positions1[pos_ofs+5] =  - BZ0;

                        positions1[pos_ofs+6] = AX1;
                        positions1[pos_ofs+7] = AY1;
                        positions1[pos_ofs+8] =  - AZ1;

                        positions1[pos_ofs+9] = AX0;
                        positions1[pos_ofs+10] = AY0;
                        positions1[pos_ofs+11] = - AZ0;

                        positions1[pos_ofs+12] = AX1;
                        positions1[pos_ofs+13] = AY1;
                        positions1[pos_ofs+14] = - AZ1;

                        positions1[pos_ofs+15] = BX0;
                        positions1[pos_ofs+16] = BY0;
                        positions1[pos_ofs+17] =  - BZ0;
				
                        pos_ofs += 6*3;
                        uv_ofs += 6*2;
                        color_ofs += 6*4;
                    }
                }
            }


            var geoAttribs1 = function(options) {};

            geoAttribs1.position = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 3,
                    values : positions1
            });

            geoAttribs1.uv = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 2,
                    values : uvs1
            });

            geoAttribs1.color = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 4,
                    values : colors1
            });

            var geo1 = new Cesium.Geometry({
                attributes : geoAttribs1,
                primitiveType : Cesium.PrimitiveType.TRIANGLES
            });

            var attribLoc1 = Cesium.GeometryPipeline.createAttributeLocations(geo1);

            var vertexArray1 = context.createVertexArrayFromGeometry({
                geometry : geo1,
                attributeLocations : attribLoc1,
                bufferUsage : Cesium.BufferUsage.STATIC_DRAW,
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

            geoAttribs2.position = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 3,
                    values : positions2
            });

            geoAttribs2.uv = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 2,
                    values : uvs2
            });

            geoAttribs2.color = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 4,
                    values : colors2
            });

            var geo2 = new Cesium.Geometry({
                attributes : geoAttribs2,
                primitiveType : Cesium.PrimitiveType.LINES
            });

            var attribLoc2 = Cesium.GeometryPipeline.createAttributeLocations(geo2);

            var vertexArray2 = context.createVertexArrayFromGeometry({
                geometry : geo2,
                attributeLocations : attribLoc2,
                bufferUsage : Cesium.BufferUsage.STATIC_DRAW,
                interleave : true
            });

            var vertexCount3 = 12;
            var positions3 = new Float32Array(vertexCount3 * 3);
            var colors3 = new Float32Array(vertexCount3 * 4);
            var uvs3 = new Float32Array(vertexCount3 * 2);

            var size = radius;
            var start_ofs = 0;
            uv_ofs =  0;

            positions3[start_ofs] = -size;  start_ofs++;
            positions3[start_ofs] = 0;      start_ofs++;
            positions3[start_ofs] = -size;  start_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;

            positions3[start_ofs] = size;  start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = -size; start_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;

            positions3[start_ofs] = size;  start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = size;  start_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;

            positions3[start_ofs] = -size; start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = -size; start_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;

            positions3[start_ofs] = size;  start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = size;  start_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;

            positions3[start_ofs] = -size; start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = size;  start_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;

			// inverted part
            positions3[start_ofs] = size;  start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = size;  start_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;

            positions3[start_ofs] = size;  start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = -size; start_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;

			positions3[start_ofs] = -size;  start_ofs++;
            positions3[start_ofs] = 0;      start_ofs++;
            positions3[start_ofs] = -size;  start_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;

            positions3[start_ofs] = -size; start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = size;  start_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;

            positions3[start_ofs] = size;  start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = size;  start_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;

            positions3[start_ofs] = -size; start_ofs++;
            positions3[start_ofs] = 0;     start_ofs++;
            positions3[start_ofs] = -size; start_ofs++;
            uvs3[uv_ofs] = 0.0; uv_ofs++;
            uvs3[uv_ofs] = 1.0; uv_ofs++;
			
			
            for (var k=0; k<vertexCount3*4; k++)
            {
                colors3[k] = 1.0;
            }

            var geoAttribs3 = function(options) {};

            geoAttribs3.position = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 3,
                    values : positions3
            });

            geoAttribs3.uv = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 2,
                    values : uvs3
            });

            geoAttribs3.color = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 4,
                    values : colors3
            });

            var geo3 = new Cesium.Geometry({
                attributes : geoAttribs3,
                primitiveType : Cesium.PrimitiveType.TRIANGLES
            });

            var attribLoc3 = Cesium.GeometryPipeline.createAttributeLocations(geo3);

            var vertexArray3 = context.createVertexArrayFromGeometry({
                geometry : geo3,
                attributeLocations : attribLoc3,
                bufferUsage : Cesium.BufferUsage.STATIC_DRAW,
                interleave : true
            });
			
//            this._shaderProgram2 = context.createShaderProgram(vs, fs, attribLoc2);

            this._projectionMatrix = new Cesium.Matrix4();
			Cesium.Matrix4.computeOrthographicOffCenter(0.0, 100, 100, 0.0, 0.0, 300, this._projectionMatrix);

            this._modelMatrix = Cesium.Matrix4.IDENTITY;

            this._texture = undefined;

			var that = this;

			var compassImage = new Image();
			compassImage.onerror = function () { console.log("image loading error: "+that._texturePath);};
			compassImage.onload = function () {
				that._texture = context.createTexture2D({source : compassImage});
				console.log('Image '+that._texturePath+' loaded: '+that._texture);
			};
			compassImage.src = that._texturePath;


            this._uniforms = {

                customProjMatrix : function() {
                    return that._projectionMatrix;
                },

                customModelMatrix : function() {
                    return that._modelMatrix;
                },

                out_texture : function() {

					//console.log(that._texture);
					if (Cesium.defined(that._texture)) {
                        return that._texture;
                    }
                    else
                    {
                        return 0;
                    }

                }
            };


            this._drawCommand1 = new Cesium.DrawCommand({ owner : this});
            this._drawCommand1.vertexArray = vertexArray1;
            this._drawCommand1.count = vertexCount1;
            this._drawCommand1.renderState = context.createRenderState(defaults);
            this._drawCommand1.shaderProgram = this._shaderProgram1;
            this._drawCommand1.uniformMap = this._uniforms;
            this._drawCommand1.pass = Cesium.Pass.OVERLAY;

            this._drawCommand2 = new Cesium.DrawCommand({ owner : this});
            this._drawCommand2.vertexArray = vertexArray2;
            this._drawCommand2.count = vertexCount2;
            this._drawCommand2.primitiveType = Cesium.PrimitiveType.LINES;
            this._drawCommand2.renderState = context.createRenderState(defaults);
            this._drawCommand2.shaderProgram = this._shaderProgram1;
            this._drawCommand2.uniformMap = this._uniforms;
            this._drawCommand2.pass = Cesium.Pass.OVERLAY;

            this._drawCommand3 = new Cesium.DrawCommand({ owner : this});
            this._drawCommand3.vertexArray = vertexArray3;
            this._drawCommand3.count = vertexCount3;
            this._drawCommand3.renderState = context.createRenderState(defaults2);
            this._drawCommand3.shaderProgram = this._shaderProgram1;
            this._drawCommand3.uniformMap = this._uniforms;
            this._drawCommand3.pass = Cesium.Pass.OVERLAY;
		}


        var passes = frameState.passes;

        if (passes.render) {

            var heading = getHeading3D(this._camera);
			var tilt = getTiltCV(this._camera);

			var ratio = this._canvas.height/this._canvas.width;
			//console.log(ratio);

			Cesium.Matrix4.computeOrthographicOffCenter(0.0, 100, 100, 0.0, 0.0, 300, this._projectionMatrix);

            var rotationX = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(this._tilt) + tilt);
            var rotationY = Cesium.Matrix3.fromRotationY(heading);
            var finalRotation = new Cesium.Matrix3();
			Cesium.Matrix3.multiply(rotationX, rotationY, finalRotation);
            

			/*var p = new Cesium.Cartesian3(0,0,0);
			var dir = new Cesium.Cartesian3(0,0,0);
			Cesium.Cartesian3.multiplyByScalar(camera.direction	, 10, dir);
			Cesium.Cartesian3.add(camera.position, dir, p);

			var northPole = new Cesium.Cartographic(0, 90, 0.0);
			var LookAt = ellipsoid.cartographicToCartesian(northPole);

			var finalRotation = MatrixLookAt(p, LookAt, camera.up);

			ratio = 1.0;*/
			
		
			var ratioScale = Cesium.Matrix3.fromScale(new Cesium.Cartesian3(this._scale*ratio, this._scale, this._scale*ratio));
            var finalTransform = new Cesium.Matrix3();
			Cesium.Matrix3.multiply(ratioScale, finalRotation, finalTransform);

            var screenOfs = new Cesium.Cartesian3(this._X, this._Y, -100.0);
            this._modelMatrix = Cesium.Matrix4.fromRotationTranslation(finalTransform, screenOfs);

            commandList.push(this._drawCommand1);
			commandList.push(this._drawCommand3);
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
        return Cesium.destroyObject(this);
    };

