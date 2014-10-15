
    function addPolyLine(grid, x1, y1, x2, y2)
    {
        if (x2>=grid._divX)
        {
            return;
        }

        if (y2>=grid._divY)
        {
            return;
        }

        var ofs1 = y1 * grid._divX + x1;
        var ofs2 = y2 * grid._divX + x2;
        
        var posArray = new Array();
        posArray.push(grid._points3d[ofs1]);
        posArray.push(grid._points3d[ofs2]);
        
        var polyline = grid._polylines.add({
                        positions : posArray,
                        width: 3.0,
                        material : Cesium.Material.fromType('Color', {
                            color : new Cesium.Color(1.0, 1.0, 1.0, 1.0)
                        })
                    });
                    
    }

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

        this._divX = Cesium.defaultValue(options.divX, 10) + 1;
        this._divY = Cesium.defaultValue(options.divY, 10) + 1;
        this._maxLevels = Cesium.defaultValue(options.maxLevels, 10);

        this._points3d = new Array((this._divX+1) * (this._divY+1));
        
        this._polylines = new Cesium.PolylineCollection();
        this._labels = new Cesium.LabelCollection();
        
        // the following code generates a grid using the source points as guidelines
        for (var j = 0; j <= this._divY; j++)        
        {    
            var deltaY = j / this._divY;        
            for (var i = 0; i <= this._divX; i++)
            {                
                var deltaX = i / this._divX;

                var lat = (this._topWestCoord.longitude * deltaX) + (this._bottomEastCoord.longitude * (1.0 - deltaX));
                var lon = (this._topWestCoord.latitude * deltaY) + (this._bottomEastCoord.latitude * (1.0 - deltaY));
                
                var ofs = j * this._divX + i;
                this._points3d[ofs] = this._ellipsoid.cartographicToCartesian(new Cesium.Cartographic(lon, lat, 0.0));
                
                if (i==0 && j<this._divY-1)
                {
                    tempDeltaY = (j+0.5) / this._divY;
                    lon = (this._topWestCoord.latitude * tempDeltaY) + (this._bottomEastCoord.latitude * (1.0 - tempDeltaY));
                    var pp = this._ellipsoid.cartographicToCartesian(new Cesium.Cartographic(lon, lat, 0.0));

                    this._labels.add({
                        position : pp,
                        text     : String.fromCharCode(65 + j)
                    });
                }

                if (j==0 && i<this._divX-1)
                {
                    tempDeltaX = (i+0.5) / this._divX;
                    lat = (this._topWestCoord.longitude * tempDeltaX) + (this._bottomEastCoord.longitude * (1.0 - tempDeltaX));
                    lon = (this._topWestCoord.latitude * deltaY) + (this._bottomEastCoord.latitude * (1.0 - deltaY));
                    var pp = this._ellipsoid.cartographicToCartesian(new Cesium.Cartographic(lon, lat, 0.0));

                    var n = (i+1);
                    this._labels.add({
                        position : pp,
                        text     : n.toString()
                    });
                }
                
            }                        
        }

        for (var j = 0; j < this._divY; j++)
        {
            for (var i = 0; i < this._divX; i++)
            {
                addPolyLine(this, i, j, i+1, j);
                addPolyLine(this, i, j, i, j+1);
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


        this._polylines.update(context, frameState, commandList);
        this._labels.update(context, frameState, commandList);
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
