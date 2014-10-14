

    /**
     * A renderable Grid with subdivisions.
     *
     * @alias GridPrimitive
     * @constructor
     *
     *  Options:
     */
    var GridPrimitive = function(topWestCoord, bottomEastCoord, ellipsoid, options) {
        //>>includeStart('debug', pragmas.debug);

        if (!Cesium.defined(topWestCoord)) {
            throw new DeveloperError('topWestCoord is required');
        }

        if (!Cesium.defined(bottomEastCoord)) {
            throw new DeveloperError('bottomEastCoord is required');
        }

        if (!Cesium.defined(ellipsoid)) {
            throw new DeveloperError('ellipsoid is required');
        }
        //>>includeEnd('debug');

        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

        this._topWestCoord = topWestCoord;
        this._bottomEastCoord = bottomEastCoord;
        this._ellipsoid = ellipsoid;

        this._divX = Cesium.defaultValue(options.divX, 10);
        this._divY = Cesium.defaultValue(options.divY, 10);
        this._maxLevels = Cesium.defaultValue(options.maxLevels, 10);

        this._points3d = new Array();
        
        // the following code generates a grid using the source points as guidelines
        for (var j = 0; j < this._divY; j++)        
        {
            var deltaY = (j+1) / this._divY;
        
            for (var i = 0; i < this._divX; i++)
            {
                var deltaX = (i+1) / this._divX;

                var cx = (this._topWestCoord.x * deltaX) + (this._bottomEastCoord.x * (1.0 - deltaX));
                var cy = (this._topWestCoord.y * deltaY) + (this._bottomEastCoord.y * (1.0 - deltaY));
                
                this._points3d.push(this._ellipsoid.cartographicToCartesian(new Cartographic(cx, cy, 0.0)));
            }
        }

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
    GridPrimitive.prototype.update = function(context, frameState, commandList) {
        if (!this.show) {
            return;
        }


        if (!Cesium.defined(this._instance)) {
            var vertexCount = this._divX * this._divY;
            var temp = new Array();
            var positions = new Float64Array(vertexCount * 3);
            var normals = new Float32Array(vertexCount * 3);
            var uvs = new Float32Array(vertexCount * 2);


            for (var i = 0; i < vertexCount; i++)
            {
                // calculate left normal
                var nx = 0.0;
                var ny = 1.0;
                var nz = 0.0;

                normals[normal_ofs + 0] = nx;
                normals[normal_ofs + 1] = ny;
                normals[normal_ofs + 2] = nz;
                normal_ofs += 3;

                // calculate left position
                positions[pos_ofs+0] = this._points3d[i].x;
                positions[pos_ofs+1] = this._points3d[i].y;
                positions[pos_ofs+2] = this._points3d[i].z;
                temp.push(new Cesium.Cartesian3(this._points3d[i]));
                pos_ofs += 3;

                // uvs multiply along the path
                var u = i % this._divX;
                var v = i / this._divX;

                uvs[uv_ofs+0] = u;
                uvs[uv_ofs+1] = v;
                uv_ofs += 2;
            }

            // 3 indices per triangle
            // 2 triangles per segment
            var indexcount = (this._divX+1) * (this._divY+1);
            var gridIndices = new Uint16Array(indexcount);
            var index_ofs = 0;
            for (var j = 0; j < this._divY; j++)
            {
                for (var i = 0; i < this._divX; i++)
                {
                    if (i<this._divX-1)
                    {
                        gridIndices[index_ofs+0] = getGridVertexIndex(i, j);
                        gridIndices[index_ofs+1] = getGridVertexIndex(i+1, j);
                        index_ofs += 2;
                    }

                    if (j<this._divY-1)
                    {
                        gridIndices[index_ofs+0] = getGridVertexIndex(i, j);
                        gridIndices[index_ofs+1] = getGridVertexIndex(i, j+1);
                        index_ofs += 2;
                    }
                }
            }

            // create cesium renderer stuff
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

            // bounding sphere from collected 3d points
            var sphere = Cesium.BoundingSphere.fromPoints(temp);

            // vertex array creation
            var geo = new Cesium.Geometry({
                attributes : geoAttribs,
                indices : gridIndices,
                ellipsoid : this._ellipsoid,
                boundingSphere : sphere,
                primitiveType : Cesium.PrimitiveType.TRIANGLES
            });

            this._instance = new Cesium.GeometryInstance({
                geometry : geo,
                id : this.id,
                modelMatrix : Cesium.Matrix4.IDENTITY,
                pickPrimitive : this
            });

            if (Cesium.defined(this._primitive)) {
                this._primitive.destroy();
            }

            this._appearance = new Cesium.MaterialAppearance();
            //this._appearance.flat = false;

            var options = {
                    geometryInstances : this._instance,
                    appearance : this._appearance,
                    asynchronous : this.asynchronous
                };

            this._primitive = new Cesium.Primitive(options);
        }

        this._animationOffset += 0.025;
        if (this._animationOffset>1.0)
            this._animationOffset -= 1.0;

        this._material.uniforms.uvoffset.y = this._animationOffset;

        this._material.update(context);

        this._primitive.appearance.material = this._material;
        this._primitive.update(context, frameState, commandList);
     };



    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @memberof GridPrimitive
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see Rectangle#destroy
     */
    GridPrimitive.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
     * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>unCesium.defined</code>) to the object as done in the example.
     *
     * @memberof GridPrimitive
     *
     * @returns {unCesium.defined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see GridPrimitive#isDestroyed
     *
     */
    GridPrimitive.prototype.destroy = function() {
        return Cesium.destroyObject(this);
    };
