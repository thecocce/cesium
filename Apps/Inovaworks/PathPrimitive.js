
    function CatmullRomInterpolate(y0, y1, y2, y3, mu)
    {
      var a0,a1,a2,a3,mu2;

       mu2 = (mu*mu);
       a0 = (-0.5 * y0) + (1.5 * y1) - (1.5 * y2) + (0.5 * y3);
       a1 = y0 - (2.5 * y1) + (2.0 * y2) - (0.5 * y3);
       a2 = (-0.5 * y0) + (0.5 * y2);
       a3 = y1;
       return (a0 * mu * mu2) + (a1 * mu2) + (a2 * mu) + a3;
    }

    // p is a Cesium.Cartographic point
    function getUpVector(p, ellipsoid)
    {
        var temp = new Cesium.Cartographic(p.longitude, p.latitude, p.height + 100.0);

        var a = ellipsoid.cartographicToCartesian(p);
        var b = ellipsoid.cartographicToCartesian(temp);
        var direction = new Cesium.Cartesian3(0.0, 0.0, 0.0);
        Cesium.Cartesian3.subtract(a, b, direction);
        Cesium.Cartesian3.normalize(direction, direction);
        return direction;
    }

    /**
     * A renderable Path.
     *
     * @alias PathPrimitive
     * @constructor
     *
     *  Options:
     *  divisions : Number of divisions per segment
     *  width :     Width of the path
     *  material :  Cesium material
     *  speed:      animation update speed (in miliseconds)
     */
    var PathPrimitive = function(points, ellipsoid, options) {
        //>>includeStart('debug', pragmas.debug);

        if (!Cesium.defined(points)) {
            throw new DeveloperError('points are required');
        }

        if (!Cesium.defined(ellipsoid)) {
            throw new DeveloperError('ellipsoid is required');
        }
        //>>includeEnd('debug');

        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

        this._ellipsoid = ellipsoid;


        // create shared material if necessary
        var animated_path_material = new Cesium.Material({
            fabric : {
                type : 'AnimatedImage',
                uniforms : {
                    image : 'radiowaves.png',
                    repeat : new Cesium.Cartesian2(1.0, 1.0),
                    uvoffset: new Cesium.Cartesian2(0.0, 0.0)
                },

               components : {
                       diffuse : 'texture2D(image, fract(repeat * materialInput.st+ uvoffset.xy) ).rgb',
                       alpha : 'texture2D(image, fract(repeat * materialInput.st+ uvoffset.xy)).a'
                   }
            },
            translucent : true
            });
            // setup animation timer
            //var that = animated_path_material;
            //setInterval(function(){update_animation(that)}, this._speed);
        


        this._animationOffset = 0.0;
        this._material = Cesium.defaultValue(options.material, animated_path_material);

        this._divisions = Cesium.defaultValue(options.divisions, 50);
        this._radius = Cesium.defaultValue(options.width, 50);
        this._speed = Cesium.defaultValue(options.speed, 30);

        this._points = points;
        this._points3d = new Array();
        this._ups = new Array();
        // the following code generates a path using the source points as guidelines
        // the subdivision is done using Catmull-Rom spline interpolation
        // the "up" vectors at each point is also interpolated in the same way
        for (var index = 0; index < this._points.length-1; ++index)
        {
            var a, b, c, d;
            var ua, ub, uc, ud;

            b = this._ellipsoid.cartographicToCartesian(this._points[index]);
            ub = getUpVector(this._points[index], this._ellipsoid);

            c = this._ellipsoid.cartographicToCartesian(this._points[index+1]);
            uc = getUpVector(this._points[index+1], this._ellipsoid);

            if (index>0)
            {
                a = this._ellipsoid.cartographicToCartesian(this._points[index-1]);
                ua = getUpVector(this._points[index-1], this._ellipsoid);
            }
            else
            {
                a = b;
                ua = ub;
            }

            if (index<this._points.length-2)
            {
                d = this._ellipsoid.cartographicToCartesian(this._points[index+2]);
                ud = getUpVector(this._points[index+2], this._ellipsoid);
            }
            else
            {
                d = c;
                ud = uc;
            }


            for (var i=0; i<=this._divisions; i++)
            {
                var t = i / this._divisions;

                var px = CatmullRomInterpolate(a.x, b.x, c.x, d.x, t);
                var py = CatmullRomInterpolate(a.y, b.y, c.y, d.y, t);
                var pz = CatmullRomInterpolate(a.z, b.z, c.z, d.z, t);

                var p = new Cesium.Cartesian3(px, py, pz);

                this._points3d.push(p);

                px = CatmullRomInterpolate(ua.x, ub.x, uc.x, ud.x, t);
                py = CatmullRomInterpolate(ua.y, ub.y, uc.y, ud.y, t);
                pz = CatmullRomInterpolate(ua.z, ub.z, uc.z, ud.z, t);

                p = new Cesium.Cartesian3(px, py, pz);
                this._ups.push(p);
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
    PathPrimitive.prototype.update = function(context, frameState, commandList) {
        if (!this.show) {
            return;
        }


        if (!Cesium.defined(this._instance)) {
            // corresponds to an white non transparent pixel on the current texture, edit if texture is changed

            var slices = this._points3d.length - 1;

            var pos_ofs = 0;
            var normal_ofs = 0;
            var uv_ofs = 0;

            var vertexCount = (slices+1) * 2;
            var temp = new Array();
            var positions = new Float64Array(vertexCount * 3);
            var normals = new Float32Array(vertexCount * 3);
            var uvs = new Float32Array(vertexCount * 2);


            for (var i = 0; i <= slices; i++)
            {
                var direction = new Cesium.Cartesian3(0, 0, 0);
                var axis1, axis2;
                var up = this._ups[i];

                // path direction is calculated by taking a normal vector
                // this vector is obtained from the current point and next path point
                if (i<slices)
                {
                   Cesium.Cartesian3.subtract(this._points3d[i+1], this._points3d[i], direction);
                  Cesium.Cartesian3.normalize(direction, direction);

                  axis1 = new Cesium.Cartesian3(0, 0, 0);
                  Cesium.Cartesian3.cross(direction, up, axis1);
                  axis2 =  new Cesium.Cartesian3(0, 0, 0);
                  Cesium.Cartesian3.cross(axis1, direction, axis2);

                  axis1 =  Cesium.Cartesian3.normalize(axis1, axis1);
                  axis2 =  Cesium.Cartesian3.normalize(axis2, axis2);
                }

                var sx = 1.0;
                var sy = 0.0;

                // calculate left normal
                var nx = axis1.x * sx +axis2.x*sy;
                var ny = axis1.y * sx +axis2.y*sy;
                var nz = axis1.z * sx +axis2.z*sy;

                normals[normal_ofs + 0] = nx;
                normals[normal_ofs + 1] = ny;
                normals[normal_ofs + 2] = nz;
                normal_ofs += 3;

                // right normal is the same, just inverted
                normals[normal_ofs + 0] = -nx;
                normals[normal_ofs + 1] = -ny;
                normals[normal_ofs + 2] = -nz;
                normal_ofs += 3;

                // calculate left position
                positions[pos_ofs+0] = nx * this._radius  + this._points3d[i].x;
                positions[pos_ofs+1] = ny * this._radius + this._points3d[i].y + this._radius;
                positions[pos_ofs+2] = nz * this._radius + this._points3d[i].z;
                temp.push(new Cesium.Cartesian3(positions[pos_ofs+0], positions[pos_ofs+1], positions[pos_ofs+2]));
                pos_ofs += 3;

                // calculate right position
                positions[pos_ofs+0] = nx * -this._radius  + this._points3d[i].x;
                positions[pos_ofs+1] = ny * -this._radius + this._points3d[i].y + this._radius;
                positions[pos_ofs+2] = nz * -this._radius + this._points3d[i].z;
                temp.push(new Cesium.Cartesian3(positions[pos_ofs+0], positions[pos_ofs+1], positions[pos_ofs+2]));
                pos_ofs += 3;


                // uvs multiply along the path
                var v = i * 4.0;

                uvs[uv_ofs+0] = 0;
                uvs[uv_ofs+1] = v;
                uv_ofs += 2;

                uvs[uv_ofs+0] = 1;
                uvs[uv_ofs+1] = v;
                uv_ofs += 2;
            }

            // 3 indices per triangle
            // 2 triangles per segment
            var indexcount = slices * 3 * 2;
            var Pathindices = new Uint16Array(indexcount);
            var index_ofs = 0;
            for (var i = 0; i < slices; i++)
            {
                Pathindices[index_ofs+2] = i;
                Pathindices[index_ofs+1] = i+1;
                Pathindices[index_ofs+0] = i+2;
                index_ofs += 3;

                Pathindices[index_ofs+2] = i+1;
                Pathindices[index_ofs+1] = i+2;
                Pathindices[index_ofs+0] = i+3;
                index_ofs += 3;
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
                indices : Pathindices,
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
     * @memberof PathPrimitive
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see Rectangle#destroy
     */
    PathPrimitive.prototype.isDestroyed = function() {
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
     * @memberof PathPrimitive
     *
     * @returns {unCesium.defined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see PathPrimitive#isDestroyed
     *
     */
    PathPrimitive.prototype.destroy = function() {
        return Cesium.destroyObject(this);
    };
