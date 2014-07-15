
    var xmlns = "http://www.w3.org/2000/svg";

   function svgText(x, y, msg) {
        var text = document.createElementNS (xmlns, "text");
        text.setAttributeNS(null, 'x', x);
        text.setAttributeNS(null, 'y', y);
        text.setAttributeNS(null, 'class', 'inova-scale-svgText');


        text.caption = document.createElementNS (xmlns, 'tspan');
        text.caption.textContent = msg;
        text.appendChild(text.caption);
        return text;
    }

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


   function update_scale(obj)
   {
       obj.update();
   }


    /*
     * @alias ScaleWidget
     * @constructor
     *
     * @param {Element|String} container The DOM element or ID that will contain the widget.
     *
     * @exception {DeveloperError} container is required.
     *
     * Options
     *  x : Horizontal position (in pixels)
     *  y : Vertical position (in pixels)
     *  color: Color of the scale lines (to change text color/font, use css)
     *  interval: Invertal in miliseconds to update the scale (default: 100ms)
     *
     */
    var ScaleWidget = function(container, canvas, camera, ellipsoid, options) {
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
        //>>includeEnd('debug');

        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);
		
        container = document.getElementById(container);

        var defaultColor = new Cesium.Color(255, 255, 255, 255);

        this._container = container;
        this._canvas = canvas;
        this._camera = camera;
        this._ellipsoid = ellipsoid;

        this._maxWidth = 100.0;
        this._X = Cesium.defaultValue(options.x, 0.0);
        this._Y = Cesium.defaultValue(options.y, 0.0);
        this._color = Cesium.defaultValue(options.color, defaultColor);
        this._interval = Cesium.defaultValue(options.interval, 100);

        this._ofsX = this._maxWidth;
        this._ofsY = 50;

        var boxWidth = this._maxWidth * 2;
        var boxHeight = 500;

        this._div = document.createElement('div');
        this._div.setAttribute("id", "scaleWidget");
        this._div.setAttribute("style", "position:absolute; top:"+this._Y+"px; left:"+this._X+"px; width:"+boxWidth+"px;height:"+boxHeight+"px; pointer-events: none; z-index: 9999");

        var svg = document.createElementNS (xmlns, "svg");
        //svg.setAttributeNS (null, "viewBox", "0 0 " + boxWidth + " " + boxHeight);
        svg.setAttributeNS (null, "width", boxWidth);
        svg.setAttributeNS (null, "height", boxHeight);
        svg.style.display = "block";

        this._width = this._maxWidth;
        this._lineH = 10.0;
        this._scaleValue = 100.0;

        this._myLabel = svgText(this._ofsX, this._ofsY- 14.0, 'Loading...');
        this._lineBase = svgLine(this._color, 2);
        this._lineLeft = svgLine(this._color, 2);
        this._lineRight = svgLine(this._color, 2);
        this._lineMiddle = svgLine(this._color, 1);

        svg.appendChild(this._myLabel);
        svg.appendChild(this._lineBase);
        svg.appendChild(this._lineRight);
        svg.appendChild(this._lineLeft);
        svg.appendChild(this._lineMiddle);
        this._div.appendChild(svg);
		container.appendChild(this._div);

        this._svgNode = svg;
        this._lastDistance = 0.0;

        var that = this;
        setInterval(function(){update_scale(that)}, this._interval);
    };

    Cesium.defineProperties(ScaleWidget.prototype, {
        /**
         * Gets the parent container.
         *
         * @memberof ScaleWidget.prototype
         * @type {Element}
         */
        container : {
            get : function() {
                return this._container;
            }
        }

    });

    /**
     * @memberof ScaleWidget
     */
    ScaleWidget.prototype.update = function() {

        var distance = this._ellipsoid.cartesianToCartographic(this._camera.position).height;
        if (Math.abs(distance-this._lastDistance)<1.0)
        {
            return;
        }

        var viewportWidth = this._canvas.width;
        var viewportHeight = this._canvas.height;
        var ratio = viewportWidth / viewportHeight;
        var tanHalfAngle = Math.tan(0.5 * this._camera.frustum.fovy);
        var pixelSizeScale = (2.0 * tanHalfAngle ) / viewportWidth;

        var pixelSize = Math.abs(distance) * pixelSizeScale;



        var scaleSize = 2 * pixelSize * this._canvas.width;  // meter
        var unitLabel = "m";


        scaleSize = (scaleSize * this._maxWidth) / viewportWidth;

        if (scaleSize > 10000)
        {
            scaleSize /= 1000;
            unitLabel = "Km";
        }

        var pot = Math.floor(Math.log(scaleSize)/ Math.LN10);
        var ff = scaleSize.toString();
        var digit = parseInt(ff.charAt(0), 10);
        var divSize = digit * Math.pow(10, pot);
        if (digit >= 5)
        {
            divSize = 5 * Math.pow(10, pot);
        }
        else
        if (digit >= 2)
        {
            divSize = 2 * Math.pow(10, pot);
        }

        this._width = this._maxWidth * divSize / scaleSize;


        updateLine(this._lineBase,
                    this._ofsX -this._width, this._ofsY,
                    this._ofsX +this._width, this._ofsY);

        updateLine(this._lineLeft,
                    this._ofsX -this._width, this._ofsY,
                    this._ofsX -this._width, this._ofsY-this._lineH);

        updateLine(this._lineRight,
                    this._ofsX + this._width, this._ofsY,
                    this._ofsX + this._width, this._ofsY-this._lineH);

        updateLine(this._lineMiddle,
                    this._ofsX , this._ofsY,
                    this._ofsX , this._ofsY-this._lineH*0.5);


        this._myLabel.caption.textContent = divSize + ' '+ unitLabel;
    };

    /**
     * @memberof ScaleWidget
     * @returns {Boolean} true if object has been destroyed, false otherwise.
     */
    ScaleWidget.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the ScaleWidget. Should be called if permanently
     * removing the widget from layout.
     * @memberof ScaleWidget
     */
    ScaleWidget.prototype.destroy = function() {
        this._container.removeChild(this._svgNode);
        return destroyObject(this);
    };

