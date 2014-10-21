
    function addPolyLine(grid, x1, y1, x2, y2)
    {
        if (x2>grid._divX)
        {
            return;
        }

        if (y2>grid._divY)
        {
            return;
        }

        var ofs1 = y1 * (grid._divX+1) + x1;
        var ofs2 = y2 * (grid._divX+1) + x2;
        
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
    
    function createGrid(ellipsoid, topWestCoord, bottomEastCoord, indexX, indexY, divX, divY, labelsType, subLevels, distance)
    {
        var result = {};
        result._polylines = new Cesium.PolylineCollection();
        result._points3d = new Array((divX+1) * (divY+1));
        result._indexX = indexX;
        result._indexY = indexY;
        result._divX = divX;
        result._divY = divY;
        result._distance = distance;
        
        var textScale = 0.25;
        
        var corners = [];
        corners.push(new Cesium.BoundingSphere(ellipsoid.cartographicToCartesian(topWestCoord), 0.0));
        corners.push(new Cesium.BoundingSphere(ellipsoid.cartographicToCartesian(new Cesium.Cartographic(topWestCoord.longitude, bottomEastCoord.latitude, 0.0)), 0.0));
        corners.push(new Cesium.BoundingSphere(ellipsoid.cartographicToCartesian(bottomEastCoord), 0.0));
        corners.push(new Cesium.BoundingSphere(ellipsoid.cartographicToCartesian(new Cesium.Cartographic(bottomEastCoord.longitude, topWestCoord.latitude, 0.0)), 0.0));
        result._corners = corners;
                
        if (labelsType !=0)
        {
            result._labels = new Cesium.LabelCollection();
        }

        // the following code generates a grid using the source points as guidelines
        for (var j = 0; j <= divY; j++)        
        {    
            var deltaY = j / divY;        
            for (var i = 0; i <= divX; i++)
            {                
                var deltaX = i / divX;

                var lat = (topWestCoord.latitude * deltaY) + (bottomEastCoord.latitude * (1.0 - deltaY));
                var lon = (topWestCoord.longitude * deltaX) + (bottomEastCoord.longitude * (1.0 - deltaX));                
                
                var ofs = j * (divX+1) + i;
                result._points3d[ofs] = ellipsoid.cartographicToCartesian(new Cesium.Cartographic(lon, lat, 0.0));
                
                if (labelsType == 1)
                {
                    if (i==0 && j<divY)
                    {
                        tempDeltaY = (j+0.5) / divY;
                        lat = (topWestCoord.latitude * tempDeltaY) + (bottomEastCoord.latitude * (1.0 - tempDeltaY));
                        var pp = ellipsoid.cartographicToCartesian(new Cesium.Cartographic(lon, lat, 0.0));

                        result._labels.add({
                            position : pp,
                            scale: textScale,
                            text     : String.fromCharCode(65 + j)
                        });
                    }

                    if (j==0 && i<divX)
                    {
                        tempDeltaX = (i+0.5) / divX;
                        lon = (topWestCoord.longitude * tempDeltaX) + (bottomEastCoord.longitude * (1.0 - tempDeltaX));
                        lat = (topWestCoord.latitude * deltaY) + (bottomEastCoord.latitude * (1.0 - deltaY));
                        var pp = ellipsoid.cartographicToCartesian(new Cesium.Cartographic(lon, lat, 0.0));

                        var n = (i+1);
                        result._labels.add({
                            position : pp,
                            scale: textScale,
                            text     : n.toString()
                        });
                    }
                }
                
            }                        
        }

        // now that we built the grid points, join them with lines
        for (var j = 0; j <= divY; j++)
        {
            for (var i = 0; i <= divX; i++)
            {
                addPolyLine(result, i, j, i+1, j);
                addPolyLine(result, i, j, i, j+1);
            }
        }

        // recursively create sublevels
        result._children = [];
        if (subLevels>0 || labelsType == 2)
        {
            var prevDeltaX = 0;
            var deltaX = 0;
            
            var prevDeltaY = 0;
            var deltaY = 0;
            
            for (var j = 0; j <= divY; j++)
            {
                prevDeltaY = deltaY;
                deltaY = j / divY;        
                for (var i = 0; i <= divX; i++)
                {
                    prevDeltaX = deltaX;
                    deltaX = i / divX;
           
                    if (i>0 && j>0)
                    {
                        var lon1 = (topWestCoord.longitude * prevDeltaX) + (bottomEastCoord.longitude * (1.0 - prevDeltaX));
                        var lat1 = (topWestCoord.latitude * prevDeltaY) + (bottomEastCoord.latitude * (1.0 - prevDeltaY));

                        var lon2 = (topWestCoord.longitude * deltaX) + (bottomEastCoord.longitude * (1.0 - deltaX));
                        var lat2 = (topWestCoord.latitude * deltaY) + (bottomEastCoord.latitude * (1.0 - deltaY));

                        var coord1 = new Cesium.Cartographic(lon1, lat1, 0.0);
                        var coord2 = new Cesium.Cartographic(lon2, lat2, 0.0);
                        var center = new Cesium.Cartographic((lon1+lon2)*0.5, (lat1+lat2)*0.5, 0.0);
                        
                        if (labelsType == 2)
                        {
                            var n = 1 + (j-1)*divX + (i-1);
                            var pp = ellipsoid.cartographicToCartesian(center);
                            
                            if (subLevels & 1)
                            {
                                n = 10 - n;
                            }
                            
                            result._labels.add({
                                position : pp,
                                scale: textScale,
                                text     : n.toString()
                            });
                        }
                        
                        if (subLevels>0)
                        {
                            var child = {};                                                
                            child.coord1 = coord1;
                            child.coord2 = coord2;
                            child.indexX = i;
                            child.indexY = j;
                            child.subLevels = subLevels - 1;
                            child.center = center;                        
                            
                            result._children.push(child);
                        }
                    }
                }
            }
        }

        return result;
    }
    
    // draws grids recursively
    function drawGrid(grid, context, frameState, commandList)
    {   
        if (!Cesium.defined(grid)) {
            return;
        }
    
        var childCount = grid._children.length;
        if (childCount>0) {
            
            //grid._polylines.show = false;
                
            for (var i=0; i<childCount; i++)
            {
                drawGrid(grid._children[i], context, frameState, commandList);
            }
        
            return;
        }
        
        grid._polylines.show = true;
        grid._polylines.update(context, frameState, commandList);
        if (distance<250000) {
            grid._labels.update(context, frameState, commandList);
        }
    }
    
    // calculates next distance to subdivide
    function getNextDistance(baseDistance)
    {
        return baseDistance * 0.5;
    }
    
    // calculates exactly what grid (or subgrid) is closest to the camera and returns it    
    function calculateCurrentSublevel(grid, ellipsoid, frameState)
    {
        var camera = frameState.camera;
        
        var distance = ellipsoid.cartesianToCartographic(camera.position).height;
        console.log(distance);
        
        /*if (distance>grid._distance)
        {
            return grid; // we're not too close to subdivide, so use this level
        }*/
        
        var cullingVolume = frameState.cullingVolume;
        var cornerPoints = grid._corners; 
        var cornerCount = cornerPoints.length;
        var insideView = true;
        for (var i=0; i<cornerCount; i++) {        
            if (cullingVolume.computeVisibility(cornerPoints[i]) != Cesium.Intersect.INSIDE) {
                insideView = false;
                break;
            }
        }    

        if (insideView)
        {
            return grid;
        }
        
        // we got too close, so let's 
        var children = grid._children;
        var childCount = children.length;
        
        if (childCount<=0)
        {
            return grid; // if we don't have children, then can't subdivide, just use this level
        }
        
        var minIndex = -1;
        var minDistance = 0;
        
        var dd = {};
        Cesium.Cartesian3.multiplyByScalar(camera.direction, distance, dd);
        var pp = {};
        Cesium.Cartesian3.add(camera.position, dd, pp);
        var camPos = ellipsoid.cartesianToCartographic(pp);
        //var camPos = camera.positionCartographic;
        
        for (var i = 0; i < childCount; i++) 
        {
            var center = children[i].center;
            var latdist = Math.abs(camPos.latitude - center.latitude);
            var londist = Math.abs(camPos.longitude - center.longitude);
            var pdist = (latdist + londist) * 0.5;
            
            if (minIndex<0 || pdist<minDistance) 
            {
                minDistance = pdist;
                minIndex = i;
            }
        }
        
        var target = children[minIndex];
        
        if (!Cesium.defined(target.grid))
        {   // we don't have a subgrid yet, so lets create one
            target.grid = createGrid(ellipsoid, target.coord1, target.coord2, target.indexX, target.indexY, grid._divX, grid._divY, 2, target.subLevels, getNextDistance(grid._distance));  
            target.grid.parent = grid;
        }
        
        return calculateCurrentSublevel(target.grid, ellipsoid, frameState);
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

        this._divX = Cesium.defaultValue(options.divX, 3);
        this._divY = Cesium.defaultValue(options.divY, 3);
        this._maxLevels = Cesium.defaultValue(options.maxLevels, 10);
        this._subDivDistance = Cesium.defaultValue(options.subDivDistance, 19000);

        
        this._grid = createGrid(ellipsoid, topWestCoord, bottomEastCoord, 0, 0, this._divX, this._divY, 1, this._maxLevels, this._subDivDistance);
                     
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

        
        var target = calculateCurrentSublevel(this._grid, this._ellipsoid, frameState);
        
        //drawGrid(this._grid, context, frameState, commandList);
        target._polylines.update(context, frameState, commandList);               

        var next = target.parent;
        while (Cesium.defined(next))
        {
            next._polylines.update(context, frameState, commandList);               
            next = next.parent;
        }
        
        if (Cesium.defined(target._labels))
        {
            target._labels.update(context, frameState, commandList);
        }
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
