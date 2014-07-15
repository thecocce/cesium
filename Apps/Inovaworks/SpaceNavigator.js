    /*
     * @alias SpaceNavigator
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
    var SpaceNavigator = function(camera, ellipsoid, options) {
        //>>includeStart('debug', pragmas.debug);
        if (!Cesium.defined(camera)) {
            throw new Cesium.DeveloperError('camera is required');
        }

        if (!Cesium.defined(ellipsoid)) {
            throw new Cesium.DeveloperError('ellipsoid is required');
        }
        //>>includeEnd('debug');
        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

        this._camera = camera;
        this._ellipsoid = ellipsoid;
		this._connected = false;

		var that = this;
		window.addEventListener("gamepadconnected", function(e) 
		{
			that._connected = true;
			that._index = e.gamepad.index;
			alert("Gamepad connected at index %d: %s. %d buttons, %d axes.", e.gamepad.index, e.gamepad.id, e.gamepad.buttons.length, e.gamepad.axes.length);
		});
		
		window.addEventListener("gamepaddisconnected", function(e) 
		{
			that._connected = false;
			alert("Gamepad disconnected from index %d: %s", e.gamepad.index, e.gamepad.id);
		});		
        
        setInterval(function(){update_scale(that)}, this._interval);
    };

    Cesium.defineProperties(SpaceNavigator.prototype, {
        /**
         * Gets the parent container.
         *
         * @memberof SpaceNavigator.prototype
         * @type {Element}
         */
        container : {
            get : function() {
                return this._container;
            }
        }

    });

    /**
     * @memberof SpaceNavigator
     */
    SpaceNavigator.prototype.update = function() {

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
     * @memberof SpaceNavigator
     * @returns {Boolean} true if object has been destroyed, false otherwise.
     */
    SpaceNavigator.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the SpaceNavigator. Should be called if permanently
     * removing the widget from layout.
     * @memberof SpaceNavigator
     */
    SpaceNavigator.prototype.destroy = function() {
        this._container.removeChild(this._svgNode);
        return destroyObject(this);
    };

