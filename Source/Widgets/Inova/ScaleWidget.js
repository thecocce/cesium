/*global define*/
define([
        '../../Core/defaultValue',
        '../../Core/defined',
        '../../Core/defineProperties',
        '../../Core/destroyObject',
        '../../Core/DeveloperError',
        '../getElement'
    ], function(
        defaultValue,
      defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        getElement) {
    "use strict";

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

   function svgLine(x1, y1, x2, y2, r,g,b,thickness) {
        var line = document.createElementNS (xmlns, 'line');
        line.setAttributeNS(null, 'x1', x1);
        line.setAttributeNS(null, 'y1', y1);
        line.setAttributeNS(null, 'x2', x2);
        line.setAttributeNS(null, 'y2', y2);
      line.setAttribute('style', 'stroke:rgba('+r+','+b+','+g+',255);stroke-width:'+thickness);
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
     */
    var ScaleWidget = function(container, canvas, camera, ellipsoid) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(container)) {
            throw new DeveloperError('container is required.');
        }

        if (!defined(canvas)) {
            throw new DeveloperError('canvas is required');
        }

        if (!defined(camera)) {
            throw new DeveloperError('camera is required');
        }

        if (!defined(ellipsoid)) {
            throw new DeveloperError('ellipsoid is required');
        }

        //>>includeEnd('debug');

        container = getElement(container);

        this._container = container;
      this._canvas = canvas;
      this._camera = camera;
      this._ellipsoid = ellipsoid;

      this._div = document.createElement('div');

  //    this._X = canvas.width - 150;
//      this._Y = canvas.height - 50;
      this._X = 200;
      this._Y = 50;

      var boxWidth = 500;
      var boxHeight = 500;

        var svg = document.createElementNS (xmlns, "svg");
        svg.setAttributeNS (null, "viewBox", "0 0 " + boxWidth + " " + boxHeight);
        svg.setAttributeNS (null, "width", boxWidth);
        svg.setAttributeNS (null, "height", boxHeight);
        svg.style.display = "block";

      this._width = 100;
      this._colorR = 255;
      this._colorG = 255;
      this._colorB = 255;
      this._lineH = 10.0;
      this._scaleValue = 100.0;

      this._myLabel = svgText(this._X, this._Y - 10.0, '500 Km');
      this._lineBase = svgLine(this._X-this._width, this._Y, this._X+this._width, this._Y, this._colorR, this._colorG, this._colorB, 2);
      this._lineLeft = svgLine(this._X-this._width, this._Y, this._X-this._width, this._Y-this._lineH, this._colorR, this._colorG, this._colorB, 2);
      this._lineRight = svgLine(this._X+this._width, this._Y, this._X+this._width, this._Y-this._lineH, this._colorR, this._colorG, this._colorB, 2);
      this._lineMiddle = svgLine(this._X, this._Y, this._X, this._Y-this._lineH*0.5, this._colorR, this._colorG, this._colorB, 1);

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
        setInterval(function(){update_scale(that)}, 100);
    };

    defineProperties(ScaleWidget.prototype, {
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
            return;

        var viewportWidth = this._canvas.width;
        var tanHalfAngle = Math.tan(0.5 * this._camera.frustum.fovy);
        var pixelSizeScale = (2.0 * tanHalfAngle ) / viewportWidth;

        var pixelSize = Math.abs(distance) * pixelSizeScale;

        var scale = 1.0; //computeScale(viewport);
        var scaleSize = pixelSize * this._canvas.width * scale;  // meter
        var unitLabel = "m";

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

        this._width = 100 * divSize / scaleSize;


        updateLine(this._lineBase, this._X-this._width, this._Y, this._X+this._width, this._Y);
        updateLine(this._lineLeft, this._X-this._width, this._Y, this._X-this._width, this._Y-this._lineH);
        updateLine(this._lineRight, this._X+this._width, this._Y, this._X+this._width, this._Y-this._lineH);
        updateLine(this._lineMiddle, this._X, this._Y, this._X, this._Y-this._lineH*0.5);
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

    return ScaleWidget;
});
