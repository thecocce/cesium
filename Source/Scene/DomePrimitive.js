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
        '../Core/Cartesian2',
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
        Cartesian2,
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



    /**
     * A dome
     *
     * @alias CompassPrimitive
     * @constructor
     *
     *  location - Cartographic position
     *  options : can contain the following
     *      material - any Cesium material
     *      radius  - dome radius
     *      angle   - cone angle (in degrees)
     *      segments - number of horizontal geometry segments
     *      slices  - number of vertical  geometry slices
     */

    var DomePrimitive = function(location, ellipsoid, options) {
        //>>includeStart('debug', pragmas.debug);

        if (!defined(location)) {
            throw new DeveloperError('location is required');
        }

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

        this._radius = defaultValue(options.radius, 150.0);
        this._angle = defaultValue(options.angle, 30.0);
        this._slices = defaultValue(options.slices, 6);
        this._segments = defaultValue(options.segments, 10);

        this._location =  location;
        this._apex =  new Cartographic(this._location.longitude, this._location.latitude, this._location.height + this._radius);


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
    DomePrimitive.prototype.update = function(context, frameState, commandList) {
        if (!this.show) {
            return;
        }


        if (!defined(this._instance)) {
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
            var up = new Cartesian3(0.0, 1.0, 0.0);

            // calcula percentagem de altura da intersecao da base do cone com a esfera
            // resultado esta no range 0.0 a 1.0
            var dy = (Math.tan(coneAngle) * this._radius) / (this._radius*2);
            dy = 1.0 - dy;

            var direction = Cartesian3.subtract(apex, basePoint);
            direction =  Cartesian3.normalize(direction, direction);

            // calcular dois eixos paralelos ao cone, e perpendiculares entre si
            var axis1 =  Cartesian3.cross(direction, up);
            var axis2 =  Cartesian3.cross(axis1, direction);
            axis1 =  Cartesian3.normalize(axis1, axis1);
            axis2 =  Cartesian3.normalize(axis2, axis2);

            // calcular o centro da base do cone
            var middlePoint = Cartesian3.lerp(basePoint, apex, dy);

            var pos_ofs = 0;
            var normal_ofs = 0;
            var uv_ofs = 0;
            var v_ofs = 0;

            // arrays para guardar a geometria
            var vertexCount = ((slices+1) * segments)*2;
            var positions = new Float64Array(vertexCount * 3);
            var normals = new Float32Array(vertexCount * 3);
            var uvs = new Float32Array(vertexCount * 2);

            // array para guardar as posicoes e usa-las para calcular uma boundind sphere
            var temp = new Array();

            // calcular incremento do angulo longitudinal da superficie conica
            var dx = (360 * (Math.PI/180.0)) / segments;

            // calcular distancia da origem do cone ao centro da base
            var tt = Cartesian3.subtract(middlePoint, basePoint);
            var dist2 = Cartesian3.magnitude(tt);

            // criar geometria da parte conica
            for (var i = 0; i <= slices; i++)
            {
                var angle = 0.0;
                dy = (i/slices); // percentagem da altura actual

                // calcular raio do cone -> diferente do raio da esfera!!
                var r = Math.sqrt((this._radius * this._radius) - (dist2 * dist2));
                r = r * dy; // o raio do cone varia em funcao da altura

                // calcular o centro da interseccao imaginaria do cone com altura = (this._radius*dy)
                var p = Cartesian3.lerp(basePoint, middlePoint, dy);

                for (var j =0; j<segments; j++)
                {
                    var sx = Math.cos(angle);
                    var sy = Math.sin(angle);

                    // calcular vector normal a superficie do cone
                    var nx = axis1.x * sx +axis2.x*sy;
                    var ny = axis1.y * sx +axis2.y*sy;
                    var nz = axis1.z * sx +axis2.z*sy;

                    normals[normal_ofs + 0] = nx;
                    normals[normal_ofs + 1] = ny;
                    normals[normal_ofs + 2] = nz;
                    normal_ofs += 3;

                    // calcular posicao da superficie do cone
                    positions[pos_ofs+0] = nx * r + p.x;
                    positions[pos_ofs+1] = ny * r + p.y;
                    positions[pos_ofs+2] = nz * r + p.z;
                    temp.push(new Cartesian3(positions[pos_ofs+0], positions[pos_ofs+1], positions[pos_ofs+2]));
                    pos_ofs += 3;

                    // calcular UVs para a superfice do cone
                    // necessario para materials com texturas
                    uvs[uv_ofs+0] = j/segments;
                    uvs[uv_ofs+1] = dy;
                    uv_ofs += 2;

                    v_ofs++;
                    angle += dx;
                }
            }

            // importante, agora que acabamos de gerar a geometria da superficie conica
            // guardar o valor do offset dos vertices actual, vai ser necessario mais tarde
            var basevofs = v_ofs;

            // criar cap do cone (superficie curva/seccao duma esfera)
            for (var i = 0; i <= slices; i++)
            {
                var angle = 0.0;
                dy = (i/slices); // percentagem da altura actual

                // calcular o centro da interseccao horizontal da esfera na altura = (this._radius*dy)
                var p = Cartesian3.lerp(middlePoint, apex, dy);

                // calcular a distancia do centro da interseccao ao centro da base
                var tt2 = Cartesian3.subtract(p, basePoint);
                var dist = Cartesian3.magnitude(tt2);

                // calcular raio da seccao de esfera
                var r = Math.sqrt((this._radius * this._radius) - (dist * dist));

                for (var j =0; j<segments; j++)
                {
                    var sx = Math.cos(angle);
                    var sy = Math.sin(angle);

                    // calcular vector normal a superficie da seccao da esfera
                    var nx = axis1.x * sx +axis2.x*sy;
                    var ny = axis1.y * sx +axis2.y*sy;
                    var nz = axis1.z * sx +axis2.z*sy;

                    normals[normal_ofs + 0] = nx;
                    normals[normal_ofs + 1] = ny;
                    normals[normal_ofs + 2] = nz;
                    normal_ofs += 3;

                    // calcular posicao da superficie do cone
                    positions[pos_ofs+0] = nx * r + p.x;
                    positions[pos_ofs+1] = ny * r + p.y;
                    positions[pos_ofs+2] = nz * r + p.z;
                    temp.push(new Cartesian3(positions[pos_ofs+0], positions[pos_ofs+1], positions[pos_ofs+2]));
                    pos_ofs += 3;

                    // calcular UVs para a superfice da esfera
                    // necessario para materials com texturas
                    uvs[uv_ofs+0] = j/segments;
                    uvs[uv_ofs+1] = dy;
                    uv_ofs += 2;

                    v_ofs++;
                    angle += dx;
                }
            }

            // calcular a malha que conecta a geometria
            // magic goes here...
            var indexcount = (slices * segments *  2  * 2 * 3); // 2 triangles per cycle * 2 shapes * 3 indices per triangle
            var indices = new Uint16Array(indexcount);
            var index_ofs = 0;
            // primeiro a superficie conica...
            for (var i = 0; i < slices; i++)
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
            // e agora a superficie curva...
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

            // gerar atributos para o cesium...
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

            // calcular bounding sphere
            var sphere = BoundingSphere.fromPoints(temp);


            // criar vertex buffer
            var geo = new Geometry({
                attributes : geoAttribs,
                indices : indices,
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
     * @memberof CompassPrimitive
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see CompassPrimitive#isDestroyed
     *
     */
    DomePrimitive.prototype.destroy = function() {
        return destroyObject(this);
    };

    return DomePrimitive;
});
