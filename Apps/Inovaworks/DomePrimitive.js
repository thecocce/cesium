    /**
     * A dome
     *
     * @alias DomePrimitive
     * @constructor
     *
     *  location - Cartographic position
     *  options : can contain the following
     *      material - any Cesium material
	 *      wireMaterial - any Cesium material
     *      radius  - dome radius
     *      angle   - cone angle (in degrees)
     *      segments - number of horizontal geometry segments
     *      slices  - number of vertical  geometry slices
	 *		lineWidth - wireframe width
     */

    var DomePrimitive = function(location, ellipsoid, options) {
        //>>includeStart('debug', pragmas.debug);

        if (!Cesium.defined(location)) {
            throw new Cesium.DeveloperError('location is required');
        }

        if (!Cesium.defined(ellipsoid)) {
            throw new Cesium.DeveloperError('ellipsoid is required');
        }

        //>>includeEnd('debug');

        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

        this._ellipsoid = ellipsoid;


        var material = Cesium.Material.fromType(Cesium.Material.ColorType, {
            color : new Cesium.Color(0.0, 0.0, 1.0, 1.0)
        });

        var wirematerial = Cesium.Material.fromType(Cesium.Material.ColorType, {
            color : new Cesium.Color(1.0, 1.0, 1.0, 1.0)
        });

        this._material = Cesium.defaultValue(options.material, material);
        this._wireMaterial = Cesium.defaultValue(options.wireMaterial, wirematerial);

        this._radius = Cesium.defaultValue(options.radius, 150.0);
        this._angle = Cesium.defaultValue(options.angle, 30.0);
        this._slices = Cesium.defaultValue(options.slices, 6);
        this._segments = Cesium.defaultValue(options.segments, 10);
		this._lineWidth = Cesium.defaultValue(options.lineWidth, 1.0);
		
        this._location =  location;
        this._apex =  new Cesium.Cartographic(this._location.longitude, this._location.latitude, this._location.height + this._radius);


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
        this.asynchronous = Cesium.defaultValue(options.asynchronous, false);

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
    DomePrimitive.prototype.update = function(context, frameState, commandList) {
        if (!this.show) {
            return;
        }


        if (!Cesium.defined(this._instance)) {
            // corresponds to an white non transparent pixel on the current texture, edit if texture is changed

            var slices = this._slices;
            var segments = this._segments;
            var coneAngle = this._angle * (Math.PI/180.0);

            // converter coordenadas lat/long pra posicao global
            var basePoint = this._ellipsoid.cartographicToCartesian(this._location);
            var apex = this._ellipsoid.cartographicToCartesian(this._apex);

            var inverted = false;
            if (coneAngle<0)
            {
              coneAngle *= -1.0;
              inverted = true;
            }

            // nota: usar um vector-up constante dá problemas se o apex do cone for paralelo a este vector
            // a corrigir depois~~
            var up = new Cesium.Cartesian3(0.0, 1.0, 0.0);

            // calcula percentagem de altura da intersecao da base do cone com a esfera
            // resultado esta no range 0.0 a 1.0
            var dy = (Math.tan(coneAngle) * this._radius) / (this._radius*2);
            dy = 1.0 - dy;

            var direction = new Cesium.Cartesian3(0, 0, 0);
            Cesium.Cartesian3.subtract(apex, basePoint, direction);
            Cesium.Cartesian3.normalize(direction, direction);

            // calculate two axis paralel to cone, and perpendicular against each other
            var axis1 =  new Cesium.Cartesian3(0, 0, 0);
            Cesium.Cartesian3.cross(direction, up, axis1);
            var axis2 = new Cesium.Cartesian3(0, 0, 0);
            Cesium.Cartesian3.cross(axis1, direction, axis2);
            Cesium.Cartesian3.normalize(axis1, axis1);
            Cesium.Cartesian3.normalize(axis2, axis2);

            // calculate cone base point
            var middlePoint = new Cesium.Cartesian3(0,0,0);
            Cesium.Cartesian3.lerp(basePoint, apex, dy, middlePoint);

            var pos_ofs = 0;
            var normal_ofs = 0;
            var uv_ofs = 0;
            var v_ofs = 0;

            // arrays to store geometry
            var vertexCount = ((slices+1) * segments)*2;
            var positions = new Float64Array(vertexCount * 3);
            var normals = new Float32Array(vertexCount * 3);
            var uvs = new Float32Array(vertexCount * 2);

            // temp array to store coords for generating bounding sphere later
            var temp = new Array();

            // calculate conical surface angle increment
            var dx = (360 * (Math.PI/180.0)) / segments;

            // distance from cone origin to center of cone base
            var tt = new Cesium.Cartesian3(0, 0,0);
            Cesium.Cartesian3.subtract(middlePoint, basePoint, tt);
            var dist2 = Cesium.Cartesian3.magnitude(tt);

            // generate cone surface geometry
            for (var i = 0; i <= slices; i++)
            {
                var angle = 0.0;
                dy = (i/slices); // cone height percentage

                // calculate cone radius -> diferent from sphere radius!
                var r = Math.sqrt((this._radius * this._radius) - (dist2 * dist2));
                r = r * dy; // o raio do cone varia em funcao da altura

                // calculate center of imaginary intersection with height = (this._radius*dy)
                var p = new Cesium.Cartesian3(0,0,0);
                Cesium.Cartesian3.lerp(basePoint, middlePoint, dy, p);

                for (var j =0; j<segments; j++)
                {
                    var sx = Math.cos(angle);
                    var sy = Math.sin(angle);

                    // calculate normal vector to cone surface
                    var nx = axis1.x * sx +axis2.x*sy;
                    var ny = axis1.y * sx +axis2.y*sy;
                    var nz = axis1.z * sx +axis2.z*sy;

                    normals[normal_ofs + 0] = nx;
                    normals[normal_ofs + 1] = ny;
                    normals[normal_ofs + 2] = nz;
                    normal_ofs += 3;

                    // calculate position of cone surface points
                    positions[pos_ofs+0] = nx * r + p.x;
                    positions[pos_ofs+1] = ny * r + p.y;
                    positions[pos_ofs+2] = nz * r + p.z;
                    temp.push(new Cesium.Cartesian3(positions[pos_ofs+0], positions[pos_ofs+1], positions[pos_ofs+2]));
                    pos_ofs += 3;

                    // calculate UVs for cone surface
                    // note - while this works, a better approach would be to generate contigous UVs for both cone and sphere
                    uvs[uv_ofs+0] = j/segments;
                    uvs[uv_ofs+1] = dy;
                    uv_ofs += 2;

                    v_ofs++;
                    angle += dx;
                }
            }

            // important, now that we generated the first geometry part
            // store the vertex offset, will be used later
            var basevofs = v_ofs;

            // create cone cap (curvature/sphere section)
            for (var i = 0; i <= slices; i++)
            {
                var angle = 0.0;
                dy = (i/slices); // percentagem da altura actual

                // get center of horizontal intersection with sphere at height = (this._radius*dy)
                var p = new Cesium.Cartesian3(0,0,0);
                Cesium.Cartesian3.lerp(middlePoint, apex, dy, p);

                // calculate distance to center of intersection with cone base
                var tt2 = new Cesium.Cartesian3(0, 0, 0);
                Cesium.Cartesian3.subtract(p, basePoint, tt2);
                var dist = Cesium.Cartesian3.magnitude(tt2);

                // calculate radius of sphere intersection
                var r = (this._radius * this._radius) - (dist * dist);
                if (r>0)
                    r = Math.sqrt(r);

                for (var j =0; j<segments; j++)
                {
                    var sx = Math.cos(angle);
                    var sy = Math.sin(angle);

                    // get normal vector at curved surface
                    var nx = axis1.x * sx +axis2.x*sy;
                    var ny = axis1.y * sx +axis2.y*sy;
                    var nz = axis1.z * sx +axis2.z*sy;

                    normals[normal_ofs + 0] = nx;
                    normals[normal_ofs + 1] = ny;
                    normals[normal_ofs + 2] = nz;
                    normal_ofs += 3;

                    // calculate curved surface position points
                    positions[pos_ofs+0] = nx * r + p.x;
                    positions[pos_ofs+1] = ny * r + p.y;
                    positions[pos_ofs+2] = nz * r + p.z;
                    temp.push(new Cesium.Cartesian3(positions[pos_ofs+0], positions[pos_ofs+1], positions[pos_ofs+2]));
                    pos_ofs += 3;

                    // calculate UVs for curved surface
                    uvs[uv_ofs+0] = j/segments;
                    uvs[uv_ofs+1] = dy;
                    uv_ofs += 2;

                    v_ofs++;
                    angle += dx;
                }
            }

            // create mesh that connects everything
            // magic goes here...
            var trianglecount = (slices * segments *  2  * 2); // 2 triangles per cycle * 2 shapes
            var indexcount =  trianglecount * 3; // 3 indices per triangle
            var indices = new Uint16Array(indexcount);
            var index_ofs = 0;
            // primeiro a superficie conica...
            for (var i = 0; i <slices; i++)
            {
                for (var j = 0; j < segments; j++)
                {
                    var k = 0;
                    if (j<segments-1)
                    {
                        k = j + 1;
                    }

                    indices[index_ofs+0] = (i*segments) + j;
                    indices[index_ofs+1] = (i*segments) + k;
                    indices[index_ofs+2] = ((i+1)*segments) + j;
                    index_ofs += 3;

                    indices[index_ofs+0] = (i*segments) + k;
                    indices[index_ofs+1] = ((i+1)*segments) + k;
                    indices[index_ofs+2] = ((i+1)*segments) + j;
                    index_ofs += 3;
                }
            }
            // now the curved part...
            for (var i = 0; i < slices; i++)
            {
                for (var j = 0; j < segments; j++)
                {
                    var k = 0;
                    if (j<segments-1)
                    {
                        k = j + 1;
                    }


                    indices[index_ofs+0] = basevofs + (i*segments) + j;
                    indices[index_ofs+1] = basevofs + (i*segments) + k;
                    indices[index_ofs+2] = basevofs + ((i+1)*segments) + j;
                    index_ofs += 3;

                    indices[index_ofs+0] = basevofs + (i*segments) + k;
                    indices[index_ofs+1] = basevofs + ((i+1)*segments) + k;
                    indices[index_ofs+2] = basevofs + ((i+1)*segments) + j;
                    index_ofs += 3;
                }
            }

            // generate wireframe mesh
            var indexcount2 = trianglecount * 2;
            var wireindices = new Uint16Array(indexcount2);
            index_ofs = 0;
            var index_ofs2 = 0;
            for (var i = 0; i < trianglecount; i++)
            {
                wireindices[index_ofs2 + 0] = indices[index_ofs + 0];
                wireindices[index_ofs2 + 1] = indices[index_ofs + 1];
                index_ofs2 += 2;

                /*wireindices[index_ofs2 + 0] = indices[index_ofs + 1];
                wireindices[index_ofs2 + 1] = indices[index_ofs + 2];
                index_ofs2 += 2;*/

                /*wireindices[index_ofs2 + 0] = indices[index_ofs + 2];
                wireindices[index_ofs2 + 1] = indices[index_ofs + 0];
                index_ofs2 += 2;*/

                index_ofs += 3;
            }


            // generated cesium attributes..
            var geoAttribs = function(options) {};

            geoAttribs.position = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.DOUBLE,
                    componentsPerAttribute : 3,
                    values : positions
            });

            geoAttribs.normal = new Cesium.GeometryAttribute({
                    componentDatatype : Cesium.ComponentDatatype.FLOAT,
                    componentsPerAttribute : 3,
                    values : normals
            });

            geoAttribs.st = new Cesium.GeometryAttribute({
                componentDatatype : Cesium.ComponentDatatype.FLOAT,
                componentsPerAttribute : 2,
                values : uvs
            });

            // get a bounding sphere for this geometry
            var sphere = Cesium.BoundingSphere.fromPoints(temp);


            // create vertex buffer 1
            var geo1 = new Cesium.Geometry({
                attributes : geoAttribs,
                indices : indices,
                ellipsoid : this._ellipsoid,
                boundingSphere : sphere,
                primitiveType : Cesium.PrimitiveType.TRIANGLES
            });

            this._instance1 = new Cesium.GeometryInstance({
                geometry : geo1,
                id : this.id,
                modelMatrix : Cesium.Matrix4.IDENTITY,
                pickPrimitive : this
            });

            if (Cesium.defined(this._primitive1)) {
                this._primitive1.destroy();
            }


            // create vertex buffer
            var geo2 = new Cesium.Geometry({
                attributes : geoAttribs,
                indices : wireindices,
                ellipsoid : this._ellipsoid,
                boundingSphere : sphere,
                primitiveType : Cesium.PrimitiveType.LINES
            });

            this._instance2 = new Cesium.GeometryInstance({
                geometry : geo2,
                id : this.id,
                modelMatrix : Cesium.Matrix4.IDENTITY,
                pickPrimitive : this
            });

            if (Cesium.defined(this._primitive2)) {
                this._primitive2.destroy();
            }

             var defaults = {
                  frontFace : Cesium.WindingOrder.COUNTER_CLOCKWISE,
                  cull : {
                      enabled : false,
                      face : Cesium.CullFace.BACK
                   },
                   lineWidth : this._lineWidth,
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
                        enabled : false,
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
			
            this._appearance = new Cesium.MaterialAppearance();
            this._wireAppearance = new Cesium.MaterialAppearance({renderState: defaults});
            //this._appearance.flat = false;

            var options1 = {
                    geometryInstances : this._instance1,
                    appearance : this._appearance,
                    asynchronous : this.asynchronous
                };

            this._primitive1 = new Cesium.Primitive(options1);

            var options2 = {
                    geometryInstances : this._instance2,
                    appearance : this._wireAppearance,
                    asynchronous : this.asynchronous
                };

            this._primitive2 = new Cesium.Primitive(options2);

        }

        this._material.update(context);
        this._primitive1.appearance.material = this._material;
        this._primitive1.update(context, frameState, commandList);
		
        this._wireMaterial.update(context);
        this._primitive2.appearance.material = this._wireMaterial;		
        this._primitive2.update(context, frameState, commandList);
};



    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @memberof DomePrimitive
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see Rectangle#destroy
     */
    DomePrimitive.prototype.isDestroyed = function() {
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
     * @memberof DomePrimitive
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see DomePrimitive#isDestroyed
     *
     */
    DomePrimitive.prototype.destroy = function() {
        return destroyObject(this);
    };

