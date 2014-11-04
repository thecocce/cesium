    var xmlns = "http://www.w3.org/2000/svg";

   function svgLine(color,thickness) {
        var line = document.createElementNS (xmlns, 'line');
        /*line.setAttributeNS(null, 'x1', x1);
        line.setAttributeNS(null, 'y1', y1);
        line.setAttributeNS(null, 'x2', x2);
        line.setAttributeNS(null, 'y2', y2);*/
      line.setAttribute('style', 'stroke:rgba('+color.red+','+color.green+','+color.blue+','+color.alpha+');stroke-width:'+thickness);
        return line;
    }

   function updateLine(line, x1, y1, x2, y2) {
       line.setAttribute('x1', x1);
       line.setAttribute('y1', y1);
       line.setAttribute('x2', x2);
       line.setAttribute('y2', y2);
   }

   // duplicated code...because Cesium does not expose the modified scale 
    var scratchDrawingBufferDimensions = new Cesium.Cartesian2();
    var scratchToCenter = new Cesium.Cartesian3();
    var scratchProj = new Cesium.Cartesian3();
   
    function scaleInPixels(positionWC, radius, canvasWidth, canvasHeight, camera) {
        var frustum = camera.frustum;

        var toCenter = Cesium.Cartesian3.subtract(camera.positionWC, positionWC, scratchToCenter);
        var proj = Cesium.Cartesian3.multiplyByScalar(camera.directionWC, Cesium.Cartesian3.dot(toCenter, camera.directionWC), scratchProj);
        var distance = Math.max(frustum.near, Cesium.Cartesian3.magnitude(proj) - radius);

        scratchDrawingBufferDimensions.x = canvasWidth;
        scratchDrawingBufferDimensions.y = canvasHeight;
        var pixelSize = frustum.getPixelSize(scratchDrawingBufferDimensions, distance);
        var pixelScale = Math.max(pixelSize.x, pixelSize.y);

        return pixelScale;
    }
   
    var scratchPosition = new Cesium.Cartesian3();
   
   function getScale(model,  canvasWidth, canvasHeight, camera) {
        var scale = model._scale;

        if (model.minimumPixelSize !== 0.0) {
            // Compute size of bounding sphere in pixels
            var maxPixelSize = Math.max(canvasWidth, canvasHeight);
            var m = model.modelMatrix;
            scratchPosition.x = m[12];
            scratchPosition.y = m[13];
            scratchPosition.z = m[14];
            var radius = model.boundingSphere.radius;
            var metersPerPixel = scaleInPixels(scratchPosition, radius,  canvasWidth, canvasHeight, camera);

            // metersPerPixel is always > 0.0
            var pixelsPerMeter = 1.0 / metersPerPixel;
            var diameterInPixels = Math.min(pixelsPerMeter * (2.0 * radius), maxPixelSize);

            // Maintain model's minimum pixel size
            if (diameterInPixels < model.minimumPixelSize) {
                scale = (model.minimumPixelSize * metersPerPixel) / (2.0 * model._initialRadius);
            }
        }

        return scale;
    }

    var SelectionBox = function(container, canvas, camera, ellipsoid, target, options) {
        //>>includeStart('debug', pragmas.debug);
        if (!Cesium.defined(container)) {
            throw new Cesium.DeveloperError('container is required.');
        }

        if (!Cesium.defined(canvas)) {
            throw new Cesium.DeveloperError('canvas is required');
        }

        if (!Cesium.defined(camera)) {
            throw new Cesium.DeveloperError('camera is required');
        }

        if (!Cesium.defined(ellipsoid)) {
            throw new Cesium.DeveloperError('ellipsoid is required');
        }

        if (!Cesium.defined(target)) {
            throw new Cesium.DeveloperError('target is required');
        }
        //>>includeEnd('debug');

        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

        var defaultColor = new Cesium.Color(255, 255, 255, 255);

        this._container = container;
        this._canvas = canvas;
        this._camera = camera;
        this._ellipsoid = ellipsoid;
        this._target = target;

	  
        this._X = Cesium.defaultValue(options.x, 0.0);
        this._Y = Cesium.defaultValue(options.y, 0.0);
        this._color = Cesium.defaultValue(options.color, defaultColor);
        this._interval = Cesium.defaultValue(options.interval, 10);
		
        this._ofsX = 50;
        this._ofsY = 50;

        this._boxWidth = 100;
        this._boxHeight = 100;
        this._scaleValue = 100.0;

        this._div = document.createElement('div');
        this._div.setAttribute("id", "SelectionBox");
        
        this._show = true;

        this._svg = document.createElementNS (xmlns, "svg");
        //this._svg.setAttributeNS (null, "viewBox", "0 0 " + boxWidth + " " + boxHeight);
        this._svg.setAttributeNS (null, "width", this._boxWidth);
        this._svg.setAttributeNS (null, "height", this._boxHeight);
        this._svg.style.display = "block";


        this._lineA1 = svgLine(this._color, 2);
        this._lineB1 = svgLine(this._color, 2);
        this._lineC1 = svgLine(this._color, 2);
        this._lineD1 = svgLine(this._color, 2);

        this._lineA2 = svgLine(this._color, 2);
        this._lineB2 = svgLine(this._color, 2);
        this._lineC2 = svgLine(this._color, 2);
        this._lineD2 = svgLine(this._color, 2);

        this._svg.appendChild(this._lineA1);
        this._svg.appendChild(this._lineB1);
        this._svg.appendChild(this._lineC1);
        this._svg.appendChild(this._lineD1);

        this._svg.appendChild(this._lineA2);
        this._svg.appendChild(this._lineB2);
        this._svg.appendChild(this._lineC2);
        this._svg.appendChild(this._lineD2);

        this._div.appendChild(this._svg);
		container.appendChild(this._div);
    };

    /**
     * @memberof SelectionBox
     */
    SelectionBox.prototype.update = function() {

        var viewportWidth = this._container.parentNode.clientWidth;
        var viewportHeight = this._container.parentNode.clientHeight;

		if (viewportHeight<=0) {
            viewportHeight = this._container.clientHeight;
        }

		if (viewportWidth<=0 || viewportHeight<=0)
			return;
        
        if (!Cesium.defined(this._target) || this._target.ready==false) {
            return;
        }
        
        if (this._target.show !== this._show)
        {
            this._show = this._target.show;
            
            if (this._show)
            {
                this._div.style.display = 'block';
            }
            else
            {
                this._div.style.display = 'none';
            }
        }
        
        if (!this._show) {
            return;
        }
        
        var pos;
        
        var frustum = this._camera.frustum;
                
        var isBillboard = Cesium.defined(this._target.pixelOffset); // test if billboard (change this later)
        var isModel = Cesium.defined(this._target.modelMatrix); // test if model (change this later)
        
        var minSize;
        var model;
        if (isBillboard)    
        {
            model = Cesium.Matrix4.IDENTITY; 
            minSize = 50;
        }
        else
        if (isModel)
        {
            model = this._target.modelMatrix;
            minSize = 5;
        }
        else {
            return;
        }
        
        var view = this._camera.viewMatrix;
        var projection = frustum.projectionMatrix;
        var modelView = Cesium.Matrix4.multiply(view, model, new Cesium.Matrix4());
        var modelViewProjectionMatrix = Cesium.Matrix4.multiply(projection, modelView, new Cesium.Matrix4());
        var viewportTransformation = Cesium.Matrix4.computeViewportTransformation({ x : 0, y:0,  width : viewportWidth, height : viewportHeight}, 0.0, 1.0, new Cesium.Matrix4());
        
        var positions = [];

        if (isBillboard)
        {
            var pos = this._target.position;
            positions.push(new Cesium.Cartesian4(pos.x, pos.y, pos.z, 0));        
        }
        else
        if (isModel)
        {
        
            if (!Cesium.defined(this._target.boundingSphere)) {
                return;
            }
        
            var sphere = this._target.boundingSphere;                       
            var radius = sphere.radius;
            
            var changedScale = getScale(this._target,  this._canvas.width, this._canvas.height, this._camera);            
            if (changedScale!=this._target.scale)
            {
                radius *= (changedScale / this._target.scale);
            }
            
            positions.push(new Cesium.Cartesian4( radius, 0,0, 0));
            positions.push(new Cesium.Cartesian4(- radius, 0, 0, 0));
            positions.push(new Cesium.Cartesian4(0,  radius, 0, 0));
            positions.push(new Cesium.Cartesian4(0,  - radius, 0, 0));
            positions.push(new Cesium.Cartesian4(0, 0,  radius, 0));
            positions.push(new Cesium.Cartesian4(0, 0, - radius, 0));
        }
        else {
            return;
        }
        //positions.push(new Cesium.Cartesian4(sphere.center.x, sphere.center.y, sphere.center.z, 0));
                
        var pos = new Cesium.Cartesian4(0, 0, 0);
        var count = positions.length;
        var minx = 99999;
        var miny = 99999;
        var maxx = -99999;
        var maxy = -99999;
        var minz = -99999;
        var maxz = -99999;
        for (var i=0; i<count; i++)
        {
            var tempPos = Cesium.Transforms.pointToWindowCoordinates(modelViewProjectionMatrix, viewportTransformation, positions[i]);            
            if (tempPos.x>maxx) { maxx = tempPos.x; }
            if (tempPos.x<minx) { minx = tempPos.x; }
            if (tempPos.y>maxy) { maxy = tempPos.y; }
            if (tempPos.y<miny) { miny = tempPos.y; }
            if (tempPos.z>maxz) { maxz = tempPos.z; }
            if (tempPos.z<minz) { minz = tempPos.z; }
        }                      
        
        if (minz<-1 || maxz>1)
        {
            this._div.style.display = 'none';
            this._show = false;
            return;
        }
        
        var sizex = maxx - minx; 
        var sizey = maxy - miny;
        
        if (sizex<minSize) 
        { 
            sizex = minSize; 
            minx -= sizex * 0.5;
            maxx -= sizex * 0.5;
        }
        if (sizey<minSize) 
        { 
            sizey = minSize;
            miny -= sizey * 0.5;
            maxy -= sizey * 0.5;
        }
            

        updateLine(this._lineA1,
                    0, 0,
                    0, sizey*0.25);

        updateLine(this._lineA2,
                    0, sizey*0.75,
                    0, sizey);
                    
        updateLine(this._lineB1,
                    sizex, 0,
                    sizex, sizey*0.25);

        updateLine(this._lineB2,
                    sizex, sizey*0.75,
                    sizex, sizey);
                    
        updateLine(this._lineC1,
                    0, 0,
                    sizex*0.25, 0);

        updateLine(this._lineC2,
                    sizex*0.75, 0,
                    sizex, 0);
                    
        updateLine(this._lineD1,
                    0, sizey,
                    sizex*0.25, sizey);

        updateLine(this._lineD2,
                    sizex*0.75, sizey,
                    sizex, sizey);
                    
        this._X = minx;
        this._Y = miny;
        this._boxWidth = sizex+5;
        this._boxHeight = sizey+5;
        this._svg.setAttributeNS (null, "width", this._boxWidth);
        this._svg.setAttributeNS (null, "height", this._boxHeight);
        this._div.setAttribute("style", "position:absolute; top:"+this._Y+"px; left:"+this._X+"px; width:"+this._boxWidth+"px;height:"+this._boxHeight+"px; pointer-events: none; z-index: 9999");
    };

    /**
     * Destroys the SelectionBox. Should be called if permanently
     * removing the widget from layout.
     * @memberof SelectionBox
     */
    SelectionBox.prototype.destroy = function() {		
    
        if (Cesium.defined(this._container))
        {
            this._container.removeChild(this._div);
            this._container = undefined;
        }
        
        //return Cesium.destroyObject(this);
    };

    