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
        '../Core/GeometryInstance',
        '../Core/ComponentDatatype',
        '../Core/GeometryPipeline',
        '../Core/Math',
        '../Core/Matrix3',
        '../Core/Matrix4',
        '../Core/Cartesian3',
        '../Core/Cartographic',
        '../Core/BoundingSphere',
        '../Renderer/Texture',
        '../Renderer/DrawCommand',
        '../Renderer/BufferUsage',
        '../Core/WindingOrder',
        './CameraController',
        './Pass',
        './Material',
        './Primitive',
        './MaterialAppearance',
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
        GeometryInstance,
        ComponentDatatype,
        GeometryPipeline,
        CesiumMath,
        Matrix3,
        Matrix4,
        Cartesian3,
        Cartographic,
        BoundingSphere,
        Texture,
        DrawCommand,
        BufferUsage,
        WindingOrder,
        CameraController,
        Pass,
        Material,
        Primitive,
        MaterialAppearance,
        BlendEquation,
        BlendFunction,
        CullFace,
        StencilFunction,
        StencilOperation,
        DepthFunction,
        when) {
    "use strict";


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


    /**
     * A renderable pipe.
     *
     * @alias PipePrimitive
     * @constructor
     *
     *  Options:
     *  x : Horizontal position on canvas (in percentage, from 0 to 100)
     *  y : Vertical position on canvas (in percentage, from 0 to 100)
     *  scale : Pipe scale (1.0 means normal size, 0.5 means half of the size, etc)
     *  tilt : Pipe tilt, default is 45 degrees
     */
    var PipePrimitive = function(ellipsoid, options) {
        //>>includeStart('debug', pragmas.debug);

        if (!defined(ellipsoid)) {
            throw new DeveloperError('ellipsoid is required');
        }
        //>>includeEnd('debug');

        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        this._ellipsoid = ellipsoid;

        var material = Material.fromType(Material.ColorType, {
            color : new Color(0.0, 0.0, 1.0, 1.0)
        });

        this._material = defaultValue(options.material, material);

        /*this._scale = defaultValue(options.scale, 1.0);
        this._X = defaultValue(options.x, 90.0);
        this._Y = defaultValue(options.x, 10.0);
        this._tilt = defaultValue(options.tilt, 45.0);*/

        this._points = new Array();
        this._points.push(Cartographic.fromDegrees(-9.1394, 38.7138));
        this._points.push(Cartographic.fromDegrees(-9.4206, 38.6969));
        this._points.push(Cartographic.fromDegrees(-9.3606, 38.8355));

        /*this._points.push(Cartographic.fromDegrees(-9.1394, 38.7138));
        this._points.push(Cartographic.fromDegrees(13.3833, 52.5167));
        this._points.push(Cartographic.fromDegrees(37.6167, 55.7500));
        this._points.push(Cartographic.fromDegrees(139.6917, 35.6895));*/

        this._divisions = 50;
        this._points3d = new Array();
        for (var index = 0; index < this._points.length-1; ++index)
        {
            var a, b, c, d;

            b = this._ellipsoid.cartographicToCartesian(this._points[index]);
            c = this._ellipsoid.cartographicToCartesian(this._points[index+1]);

            if (index>0)
            {
                a = this._ellipsoid.cartographicToCartesian(this._points[index-1]);
            }
            else
            {
                a = b;
            }

            if (index<this._points.length-2)
            {
                d = this._ellipsoid.cartographicToCartesian(this._points[index+2]);
            }
            else
            {
                d = c;
            }


            for (var i=0; i<=this._divisions; i++)
            {
                var t = i / this._divisions;

                var px = CatmullRomInterpolate(a.x, b.x, c.x, d.x, t);
                var py = CatmullRomInterpolate(a.y, b.y, c.y, d.y, t);
                var pz = CatmullRomInterpolate(a.z, b.z, c.z, d.z, t);

                var p = new Cartesian3(px, py, pz);

                this._points3d.push(p);
            }
        }

        this._radius = 50;


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
        this.asynchronous = defaultValue(options.asynchronous, false);

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
    PipePrimitive.prototype.update = function(context, frameState, commandList) {
        if (!this.show) {
            return;
        }


        if (!defined(this._instance)) {
            // corresponds to an white non transparent pixel on the current texture, edit if texture is changed

            var slices = this._points3d.length - 1;
            var segments = 10;

            var pos_ofs = 0;
            var normal_ofs = 0;
            var uv_ofs = 0;

            var vertexCount = (slices+1) * segments;
            var temp = new Array();
            var positions = new Float64Array(vertexCount * 3);
            var normals = new Float32Array(vertexCount * 3);
            var uvs = new Float32Array(vertexCount * 2);

            var up = new Cartesian3(0.0, 1.0, 0.0);
            var dx = (360* (Math.PI/180.0)) / segments;

            for (var i = 0; i <= slices; i++)
            {
                var direction;
                var axis1, axis2;

                if (i<slices)
                {
                  direction = Cartesian3.subtract(this._points3d[i+1], this._points3d[i]);
                  direction =  Cartesian3.normalize(direction, direction);

                  axis1 =  Cartesian3.cross(direction, up);
                  axis2 =  Cartesian3.cross(axis1, direction);

                  axis1 =  Cartesian3.normalize(axis1, axis1);
                  axis2 =  Cartesian3.normalize(axis2, axis2);
                }

                var angle = 0;
                for (var j = 0; j < segments; j++)
                {
                    var sx = Math.cos(angle);
                    var sy = Math.sin(angle);
                    angle += dx;

                    var nx = axis1.x * sx +axis2.x*sy;
                    var ny = axis1.y * sx +axis2.y*sy;
                    var nz = axis1.z * sx +axis2.z*sy;

                    normals[normal_ofs + 0] = nx;
                    normals[normal_ofs + 1] = ny;
                    normals[normal_ofs + 2] = nz;
                    normal_ofs += 3;

                    positions[pos_ofs+0] = nx * this._radius  + this._points3d[i].x;
                    positions[pos_ofs+1] = ny * this._radius + this._points3d[i].y + this._radius;
                    positions[pos_ofs+2] = nz * this._radius + this._points3d[i].z;


                    temp.push(new Cartesian3(positions[pos_ofs+0], positions[pos_ofs+1], positions[pos_ofs+2]));

                    pos_ofs += 3;

                    var v = 0.0;
                    if (i % 2)
                    {
                        v = 1.0;
                    }

                    uvs[uv_ofs+0] = j/segments;
                    uvs[uv_ofs+1] = v;
                    uv_ofs += 2;
                }
            }

            var indexcount = slices * segments * 6;
            var pipeindices = new Uint16Array(indexcount);
            var index_ofs = 0;
            for (var i = 0; i < slices; i++)
            {
                for (var j = 0; j < segments; j++)
                {
                    var k = 0;
                    if (j<segments-1)
                    {
                        k = j +1;
                    }

                    pipeindices[index_ofs+2] = (i*segments) + j;
                    pipeindices[index_ofs+1] = (i*segments) + k;
                    pipeindices[index_ofs+0] = ((i+1)*segments) + j;
                    index_ofs += 3;

                    pipeindices[index_ofs+2] = (i*segments) + k;
                    pipeindices[index_ofs+1] = ((i+1)*segments) + k;
                    pipeindices[index_ofs+0] = ((i+1)*segments) + j;
                    index_ofs += 3;
                }
            }

            var geoAttribs = function(options) {};

            geoAttribs.position = new GeometryAttribute({
                    componentDatatype : ComponentDatatype.DOUBLE,
                    componentsPerAttribute : 3,
                    values : positions
            });

            geoAttribs.normal = new GeometryAttribute({
                    componentDatatype : ComponentDatatype.FLOAT,
                    componentsPerAttribute : 3,
                    values : normals
            });

            geoAttribs.st = new GeometryAttribute({
                componentDatatype : ComponentDatatype.FLOAT,
                componentsPerAttribute : 2,
                values : uvs
            });

            var sphere = BoundingSphere.fromPoints(temp);


            var geo = new Geometry({
                attributes : geoAttribs,
                indices : pipeindices,
                ellipsoid : this._ellipsoid,
                boundingSphere : sphere,
                primitiveType : PrimitiveType.TRIANGLES
            });

            var attribLoc = GeometryPipeline.createAttributeLocations(geo);

            /*this._vertexArray = context.createVertexArrayFromGeometry({
                geometry : geo,
                attributeLocations : attribLoc,
                bufferUsage : BufferUsage.STATIC_DRAW,
                interleave : true
            });*/

            this._instance = new GeometryInstance({
                geometry : geo,
                id : this.id,
                modelMatrix : Matrix4.IDENTITY,
                pickPrimitive : this
            });

            if (defined(this._primitive)) {
                this._primitive.destroy();
            }

            this._appearance = new MaterialAppearance();
            this._appearance.flat = false;

            var options = {
                    geometryInstances : this._instance,
                    appearance : this._appearance,
                    asynchronous : this.asynchronous
                };

            this._primitive = new Primitive(options);

        }

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
     * @memberof PipePrimitive
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see Rectangle#destroy
     */
    PipePrimitive.prototype.isDestroyed = function() {
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
     * @memberof PipePrimitive
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see PipePrimitive#isDestroyed
     *
     */
    PipePrimitive.prototype.destroy = function() {
        return destroyObject(this);
    };

    return PipePrimitive;
});
