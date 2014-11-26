
    function addPolyLine(grid, x1, y1, x2, y2, ellipsoid)
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
        
        var pA = grid._points[ofs1];
        var pB = grid._points[ofs2];
        
        var lineDivisions = 8;
        
        for (var i=0; i<=lineDivisions; i++)
        {
            var alpha = i/lineDivisions;
            var beta = 1.0 - alpha;

            var lat = (pA.latitude * beta) + (pB.latitude * alpha);
            var lon = (pA.longitude * beta) + (pB.longitude * alpha);
                
            var p = new Cesium.Cartographic(lon, lat, 0.0);
            posArray.push(ellipsoid.cartographicToCartesian(p));
        }
                               
        var polyline = grid._polylines.add({
                        positions : posArray,
                        width: 3.0,
                        material : Cesium.Material.fromType('Color', {
                            color : new Cesium.Color(1.0, 1.0, 1.0, 1.0)
                        })
                    });
                    
    }
    
    //coord order
    //A B
    //C D
    
    function interpLat(coordA, coordB, coordC, coordD, deltaX, deltaY) {
        var lat1 = (coordA.latitude * (1.0-deltaY)) + (coordB.latitude * deltaY);
        var lat2 = (coordC.latitude * (1.0-deltaY)) + (coordD.latitude * deltaY);
        return  (lat1 * (1.0-deltaX)) + (lat2 * deltaX);
        
        //return  (coordA.latitude * (1.0-deltaX)) + (coordD.latitude * deltaX);
    }

    function interpLon(coordA, coordB, coordC, coordD, deltaX, deltaY) {
        var lon1 = (coordA.longitude * (1.0 -deltaX)) + (coordC.longitude * deltaX);
        var lon2 = (coordB.longitude * (1.0 -deltaX)) + (coordD.longitude * deltaX);
        return (lon1 * (1.0 -deltaY)) + (lon2 * deltaY);
        
    // return  (coordA.longitude * (1.0-deltaY)) + (coordD.longitude * deltaY);
    }
    
    function createGrid(ellipsoid, coordA, coordB, coordC, coordD, indexX, indexY, divX, divY, subLevels, parent, owner)
    {
        var result = {};
        result._polylines = new Cesium.PolylineCollection();
        result._points = new Array((divX+1) * (divY+1));
        result._indexX = indexX;
        result._indexY = indexY;
        result._divX = divX;
        result._divY = divY;
        result.parent = parent;
        
        var textScale = 0.5;
        var textX = 0.1;
        var textY = 0.25;
        if (subLevels & 1)
        {
            textX = 1.0 - textX;
            textY = 1.0 - textY;
        }
        
        var corners = [];
        corners.push(new Cesium.BoundingSphere(ellipsoid.cartographicToCartesian(coordA), 0.0));
        corners.push(new Cesium.BoundingSphere(ellipsoid.cartographicToCartesian(coordB), 0.0));
        corners.push(new Cesium.BoundingSphere(ellipsoid.cartographicToCartesian(coordC), 0.0));
        corners.push(new Cesium.BoundingSphere(ellipsoid.cartographicToCartesian(coordD), 0.0));
        result._corners = corners;

        result._labels = new Cesium.LabelCollection();

        // the following code generates a grid using the source points as guidelines
        for (var j = 0; j <= divY; j++)        
        {    
            var deltaY = j / divY;        
            for (var i = 0; i <= divX; i++)
            {                
                var deltaX = i / divX;

                var lon = interpLon(coordA, coordB, coordC, coordD, deltaX, deltaY);
                var lat = interpLat(coordA, coordB, coordC, coordD, deltaX, deltaY);
                               
                var ofs = j * (divX+1) + i;
                result._points[ofs] = new Cesium.Cartographic(lon, lat, 0.0);
            }                        
        }

        // now that we built the grid points, join them with lines
        for (var j = 0; j <= divY; j++)
        {
            for (var i = 0; i <= divX; i++)
            {
                addPolyLine(result, i, j, i+1, j, ellipsoid);
                addPolyLine(result, i, j, i, j+1, ellipsoid);
            }
        }

        // recursively create sublevels
        result._children = [];
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
                    var lonA = interpLon(coordA, coordB, coordC, coordD, prevDeltaX, prevDeltaY);
                    var lonB = interpLon(coordA, coordB, coordC, coordD, prevDeltaX, deltaY);
                    var lonC = interpLon(coordA, coordB, coordC, coordD, deltaX, prevDeltaY);
                    var lonD = interpLon(coordA, coordB, coordC, coordD, deltaX, deltaY);

                    var latA = interpLat(coordA, coordB, coordC, coordD, prevDeltaX, prevDeltaY);
                    var latB = interpLat(coordA, coordB, coordC, coordD, prevDeltaX, deltaY);
                    var latC = interpLat(coordA, coordB, coordC, coordD, deltaX, prevDeltaY);
                    var latD = interpLat(coordA, coordB, coordC, coordD, deltaX, deltaY);
                    
                    
                    var center = new Cesium.Cartographic((lonA+lonD)*0.5, (latA+latD)*0.5, 0.0);

                    var n = 1 + (j-1)*divX + (i-1);
                    if (subLevels & 1)
                    {
                        n = ((divX * divY)+1) - n;
                    }
                    
                    var name = n.toString();
                        
                    if (Cesium.defined(owner) && Cesium.defined(owner.name))
                    {
                        name = owner.name + '/' + n;
                    }
                    else
                    {
                        name = String.fromCharCode(65 + j - 1) + i.toString();
                    }

                    var labelPos = new Cesium.Cartographic((lonA*(1.0-textX)+lonB*textX), (latA*(1.0-textY)+latB*textY), 0.0);
                    //var labelPos = new Cesium.Cartographic(lon1, lat1, 0.0);
                    var pp = ellipsoid.cartographicToCartesian(labelPos);
                                                
                    result._labels.add({
                        position : pp,
                        scale: textScale,
                        text     : name
                    });

                    if (subLevels>1)
                    {
                    
                        var child = {};                                                
                        child.coordA = new Cesium.Cartographic(lonA, latA, 0.0);
                        child.coordB = new Cesium.Cartographic(lonB, latB, 0.0);
                        child.coordC = new Cesium.Cartographic(lonC, latC, 0.0);
                        child.coordD = new Cesium.Cartographic(lonD, latD, 0.0);
                        child.indexX = i;
                        child.indexY = j;
                        child.subLevels = subLevels - 1;
                        child.center = center;                                                    
                        child.name = name;
                        
                        result._children.push(child);
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
        //if (distance<250000) {
            grid._labels.update(context, frameState, commandList);          
        //}
    }
    
    // calculates exactly what grid (or subgrid) is closest to the camera and returns it    
    function calculateCurrentSublevel(grid, ellipsoid, frameState)
    {
        var camera = frameState.camera;
        
        var distance = ellipsoid.cartesianToCartographic(camera.position).height;
        //console.log(distance);
        
        if (distance>250000) 
        {
            grid.labelScale  = 0;
        }
        else
        {
            //grid.labelScale = ((grid._distance*200) / distance);
            grid.labelScale = 1.0;
        }
                              
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
            target.grid = createGrid(ellipsoid, target.coordA, target.coordB, target.coordC, target.coordD, target.indexX, target.indexY, grid._divX, grid._divY, target.subLevels, grid, target);              
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
    var GridPrimitive = function(A, B, C, D, ellipsoid, options) {
        //>>includeStart('debug', pragmas.debug);

        if (!Cesium.defined(A) || !Cesium.defined(B) || !Cesium.defined(C) || !Cesium.defined(D)) {
            throw new DeveloperError('A,B, C and D coords are required');
        }

        if (!Cesium.defined(ellipsoid)) {
            throw new DeveloperError('ellipsoid is required');
        }
        //>>includeEnd('debug');

        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

        this._ellipsoid = ellipsoid;
        
        this._divX = Cesium.defaultValue(options.divX, 3);
        this._divY = Cesium.defaultValue(options.divY, 3);
        this._maxLevels = Cesium.defaultValue(options.maxLevels, 10);
        this._subDivDistance = Cesium.defaultValue(options.subDivDistance, 19000);
        
        this._grid = createGrid(ellipsoid, A, B, C, D, 0, 0, this._divX, this._divY,  this._maxLevels);
                     
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
        
        if (Cesium.defined(target._labels) /*&& target.labelScale>0.1*/)
        {
            /*if (target._labels._labelsToUpdate.length<=0)
            {
                var labelCount = target._labels._labels.length;
                for (var i=0; i<labelCount; i++)
                {
                    //target._labels._labels._scale = target.labelScale;
                    target._labels._labelsToUpdate.push(target._labels._labels[i]);                
                }
            }*/
            
            target._labels.update(context, frameState, commandList);
        }
     };


    GridPrimitive.fromTwoPoints = function(topWestCoord, bottomEastCoord, ellipsoid, options) {
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

        var rotAngle = Cesium.defaultValue(options.rotation, 180.0);
        rotAngle = rotAngle * (180 / Math.PI);
        var sinRot = Math.sin(rotAngle);
        var cosRot = Math.sin(rotAngle);
       
        var coords = [];
        coords.push(new Cesium.Cartographic(topWestCoord.longitude, topWestCoord.latitude, 0.0));
        coords.push(new Cesium.Cartographic(bottomEastCoord.longitude, topWestCoord.latitude, 0.0));
        coords.push(new Cesium.Cartographic(topWestCoord.longitude, bottomEastCoord.latitude, 0.0));
        coords.push(new Cesium.Cartographic(bottomEastCoord.longitude, bottomEastCoord.latitude, 0.0));
        
        var center = new Cesium.Cartographic((topWestCoord.longitude + bottomEastCoord.longitude) * 0.5, (topWestCoord.latitude + bottomEastCoord.latitude) * 0.5, 0.0)
        
        // apply 2d rotation
        for (var i=0; i<4; i++)
        {
            coords[i].longitude -= center.longitude;
            coords[i].latitude -= center.latitude;
            var temp = coords[i];
            coords[i] = new Cesium.Cartographic(temp.longitude * cosRot + temp.latitude * sinRot, temp.longitude * -sinRot + temp.latitude * cosRot, 0.0)
            coords[i].longitude += center.longitude;
            coords[i].latitude += center.latitude;
        }        

        return new GridPrimitive(coords[0], coords[1], coords[2], coords[3], ellipsoid, options);
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
