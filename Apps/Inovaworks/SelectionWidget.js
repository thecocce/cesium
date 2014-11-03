
   function update_selection(obj)
   {
       obj.update();
   }


    /*
     * @alias SelectionWidget
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
    var SelectionWidget = function(container, canvas, camera, ellipsoid, options) {
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

        this._options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);
		
        container = document.getElementById(container);

        var defaultColor = new Cesium.Color(255, 255, 255, 255);

        this._container = container;
        this._canvas = canvas;
        this._camera = camera;
        this._ellipsoid = ellipsoid;
        this._targets = [];

	    var that = this;
        this._timer = setInterval(function(){update_selection(that)}, this._interval);
    };

    Cesium.defineProperties(SelectionWidget.prototype, {
        /**
         * Gets the parent container.
         *
         * @memberof SelectionWidget.prototype
         * @type {Element}
         */
        container : {
            get : function() {
                return this._container;
            }
        }

    });

    SelectionWidget.prototype.update  = function() {
              
        var len = this._targets.length;
        for (var i=0; i<len; i++) {
            this._targets[i].update();
        }        
    };

   SelectionWidget.prototype.add = function(target) {             
        this._targets.push(new SelectionBox(this._container, this._canvas, this._camera, this._ellipsoid, target, this._options));
    };

    SelectionWidget.prototype.remove = function(target) {             
        var len = this._targets.length;
        for (var i=0; i<len; i++) {
            if (this._targets[i]._target ===target){
                var temp = this._targets[i];
                this._targets.splice(i, 1);
                
                temp.destroy();
                return;
            }
        };    
    }    
    
    SelectionWidget.prototype.clear  = function() {             
        var len = this._targets.length;
        for (var i=0; i<len; i++) {
            this._targets[i].destroy();
            this._targets[i] = undefined;
        }
        
        this._targets = [];
    };
    
    
    /**
     * Destroys the SelectionWidget. Should be called if permanently
     * removing the widget from layout.
     * @memberof SelectionWidget
     */
    SelectionWidget.prototype.destroy = function() {		

        this.clear();
        
        //return Cesium.destroyObject(this);
    };

