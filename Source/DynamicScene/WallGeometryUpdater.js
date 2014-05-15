/*global define*/
define([
        '../Core/Color',
        '../Core/ColorGeometryInstanceAttribute',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/Event',
        '../Core/GeometryInstance',
        '../Core/Iso8601',
        '../Core/ShowGeometryInstanceAttribute',
        '../Core/WallGeometry',
        '../Core/WallOutlineGeometry',
        '../DynamicScene/ColorMaterialProperty',
        '../DynamicScene/ConstantProperty',
        '../DynamicScene/MaterialProperty',
        '../DynamicScene/Property',
        '../Scene/MaterialAppearance',
        '../Scene/PerInstanceColorAppearance',
        '../Scene/Primitive'
    ], function(
        Color,
        ColorGeometryInstanceAttribute,
        defaultValue,
        defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        Event,
        GeometryInstance,
        Iso8601,
        ShowGeometryInstanceAttribute,
        WallGeometry,
        WallOutlineGeometry,
        ColorMaterialProperty,
        ConstantProperty,
        MaterialProperty,
        Property,
        MaterialAppearance,
        PerInstanceColorAppearance,
        Primitive) {
    "use strict";

    var defaultMaterial = ColorMaterialProperty.fromColor(Color.WHITE);
    var defaultShow = new ConstantProperty(true);
    var defaultFill = new ConstantProperty(true);
    var defaultOutline = new ConstantProperty(false);
    var defaultOutlineColor = new ConstantProperty(Color.BLACK);

    var GeometryOptions = function(dynamicObject) {
        this.id = dynamicObject;
        this.vertexFormat = undefined;
        this.positions = undefined;
        this.minimumHeights = undefined;
        this.maximumHeights = undefined;
        this.granularity = undefined;
    };

    /**
     * A {@link GeometryUpdater} for walls.
     * Clients do not normally create this class directly, but instead rely on {@link DataSourceDisplay}.
     * @alias WallGeometryUpdater
     * @constructor
     *
     * @param {DynamicObject} dynamicObject The object containing the geometry to be visualized.
     */
    var WallGeometryUpdater = function(dynamicObject) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(dynamicObject)) {
            throw new DeveloperError('dynamicObject is required');
        }
        //>>includeEnd('debug');

        this._dynamicObject = dynamicObject;
        this._dynamicObjectSubscription = dynamicObject.definitionChanged.addEventListener(WallGeometryUpdater.prototype._onDynamicObjectPropertyChanged, this);
        this._fillEnabled = false;
        this._dynamic = false;
        this._outlineEnabled = false;
        this._geometryChanged = new Event();
        this._showProperty = undefined;
        this._materialProperty = undefined;
        this._hasConstantOutline = true;
        this._showOutlineProperty = undefined;
        this._outlineColorProperty = undefined;
        this._options = new GeometryOptions(dynamicObject);
        this._onDynamicObjectPropertyChanged(dynamicObject, 'wall', dynamicObject.wall, undefined);
    };

    defineProperties(WallGeometryUpdater, {
        /**
         * Gets the type of Appearance to use for simple color-based geometry.
         * @memberof WallGeometryUpdater
         * @type {Appearance}
         */
        perInstanceColorAppearanceType : {
            value : PerInstanceColorAppearance
        },
        /**
         * Gets the type of Appearance to use for material-based geometry.
         * @memberof WallGeometryUpdater
         * @type {Appearance}
         */
        materialAppearanceType : {
            value : MaterialAppearance
        }
    });

    defineProperties(WallGeometryUpdater.prototype, {
        /**
         * Gets the object associated with this geometry.
         * @memberof WallGeometryUpdater.prototype
         * @type {DynamicObject}
         */
        dynamicObject :{
            get : function() {
                return this._dynamicObject;
            }
        },
        /**
         * Gets a value indicating if the geometry has a fill component.
         * @memberof WallGeometryUpdater.prototype
         * @type {Boolean}
         */
        fillEnabled : {
            get : function() {
                return this._fillEnabled;
            }
        },
        /**
         * Gets a value indicating if fill visibility varies with simulation time.
         * @memberof WallGeometryUpdater.prototype
         * @type {Boolean}
         */
        hasConstantFill : {
            get : function() {
                return !this._fillEnabled ||
                       (!defined(this._dynamicObject.availability) &&
                        Property.isConstant(this._showProperty) &&
                        Property.isConstant(this._fillProperty));
            }
        },
        /**
         * Gets the material property used to fill the geometry.
         * @memberof WallGeometryUpdater.prototype
         * @type {MaterialProperty}
         */
        fillMaterialProperty : {
            get : function() {
                return this._materialProperty;
            }
        },
        /**
         * Gets a value indicating if the geometry has an outline component.
         * @memberof WallGeometryUpdater.prototype
         * @type {Boolean}
         */
        outlineEnabled : {
            get : function() {
                return this._outlineEnabled;
            }
        },
        /**
         * Gets a value indicating if the geometry has an outline component.
         * @memberof WallGeometryUpdater.prototype
         * @type {Boolean}
         */
        hasConstantOutline : {
            get : function() {
                return !this._outlineEnabled ||
                       (!defined(this._dynamicObject.availability) &&
                        Property.isConstant(this._showProperty) &&
                        Property.isConstant(this._showOutlineProperty));
            }
        },
        /**
         * Gets the {@link Color} property for the geometry outline.
         * @memberof WallGeometryUpdater.prototype
         * @type {Property}
         */
        outlineColorProperty : {
            get : function() {
                return this._outlineColorProperty;
            }
        },
        /**
         * Gets a value indicating if the geometry is time-varying.
         * If true, all visualization is delegated to the {@link DynamicGeometryUpdater}
         * returned by GeometryUpdater#createDynamicUpdater.
         *
         * @memberof WallGeometryUpdater.prototype
         * @type {Boolean}
         */
        isDynamic : {
            get : function() {
                return this._dynamic;
            }
        },
        /**
         * Gets a value indicating if the geometry is closed.
         * This property is only valid for static geometry.
         * @memberof WallGeometryUpdater.prototype
         * @type {Boolean}
         */
        isClosed : {
            get : function() {
                return false;
            }
        },
        /**
         * Gets an event that is raised whenever the public properties
         * of this updater change.
         * @memberof WallGeometryUpdater.prototype
         * @type {Boolean}
         */
        geometryChanged : {
            get : function() {
                return this._geometryChanged;
            }
        }
    });

    /**
     * Checks if the geometry is outlined at the provided time.
     * @memberof WallGeometryUpdater
     * @function
     *
     * @param {JulianDate} time The time for which to retrieve visibility.
     * @returns {Boolean} true if geometry is outlined at the provided time, false otherwise.
     */
    WallGeometryUpdater.prototype.isOutlineVisible = function(time) {
        var dynamicObject = this._dynamicObject;
        return this._outlineEnabled && dynamicObject.isAvailable(time) && this._showProperty.getValue(time) && this._showOutlineProperty.getValue(time);
    };

    /**
     * Checks if the geometry is filled at the provided time.
     * @memberof WallGeometryUpdater
     * @function
     *
     * @param {JulianDate} time The time for which to retrieve visibility.
     * @returns {Boolean} true if geometry is filled at the provided time, false otherwise.
     */
    WallGeometryUpdater.prototype.isFilled = function(time) {
        var dynamicObject = this._dynamicObject;
        return this._fillEnabled && dynamicObject.isAvailable(time) && this._showProperty.getValue(time) && this._fillProperty.getValue(time);
    };

    /**
     * Creates the geometry instance which represents the fill of the geometry.
     * @memberof WallGeometryUpdater
     * @function
     *
     * @param {JulianDate} time The time to use when retrieving initial attribute values.
     * @returns {GeometryInstance} The geometry instance representing the filled portion of the geometry.
     *
     * @exception {DeveloperError} This instance does not represent a filled geometry.
     */
    WallGeometryUpdater.prototype.createFillGeometryInstance = function(time) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(time)) {
            throw new DeveloperError('time is required.');
        }

        if (!this._fillEnabled) {
            throw new DeveloperError('This instance does not represent a filled geometry.');
        }
        //>>includeEnd('debug');

        var dynamicObject = this._dynamicObject;
        var isAvailable = dynamicObject.isAvailable(time);

        var attributes;

        var color;
        var show = new ShowGeometryInstanceAttribute(isAvailable && this._showProperty.getValue(time) && this._fillProperty.getValue(time));
        if (this._materialProperty instanceof ColorMaterialProperty) {
            var currentColor = Color.WHITE;
            if (defined(this._materialProperty.color) && (this._materialProperty.color.isConstant || isAvailable)) {
                currentColor = this._materialProperty.color.getValue(time);
            }
            color = ColorGeometryInstanceAttribute.fromColor(currentColor);
            attributes = {
                show : show,
                color : color
            };
        } else {
            attributes = {
                show : show
            };
        }

        return new GeometryInstance({
            id : dynamicObject,
            geometry : new WallGeometry(this._options),
            attributes : attributes
        });
    };

    /**
     * Creates the geometry instance which represents the outline of the geometry.
     * @memberof WallGeometryUpdater
     * @function
     *
     * @param {JulianDate} time The time to use when retrieving initial attribute values.
     * @returns {GeometryInstance} The geometry instance representing the outline portion of the geometry.
     *
     * @exception {DeveloperError} This instance does not represent an outlined geometry.
     */
    WallGeometryUpdater.prototype.createOutlineGeometryInstance = function(time) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(time)) {
            throw new DeveloperError('time is required.');
        }

        if (!this._outlineEnabled) {
            throw new DeveloperError('This instance does not represent an outlined geometry.');
        }
        //>>includeEnd('debug');

        var dynamicObject = this._dynamicObject;
        var isAvailable = dynamicObject.isAvailable(time);

        return new GeometryInstance({
            id : dynamicObject,
            geometry : new WallOutlineGeometry(this._options),
            attributes : {
                show : new ShowGeometryInstanceAttribute(isAvailable && this._showProperty.getValue(time) && this._showOutlineProperty.getValue(time)),
                color : ColorGeometryInstanceAttribute.fromColor(isAvailable ? this._outlineColorProperty.getValue(time) : Color.BLACK)
            }
        });
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     * @memberof WallGeometryUpdater
     * @function
     *
     * @returns {Boolean} True if this object was destroyed; otherwise, false.
     */
    WallGeometryUpdater.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys and resources used by the object.  Once an object is destroyed, it should not be used.
     * @memberof WallGeometryUpdater
     * @function
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     */
    WallGeometryUpdater.prototype.destroy = function() {
        this._dynamicObjectSubscription();
        destroyObject(this);
    };

    WallGeometryUpdater.prototype._onDynamicObjectPropertyChanged = function(dynamicObject, propertyName, newValue, oldValue) {
        if (!(propertyName === 'availability' || propertyName === 'vertexPositions' || propertyName === 'wall')) {
            return;
        }

        var wall = this._dynamicObject.wall;

        if (!defined(wall)) {
            if (this._fillEnabled || this._outlineEnabled) {
                this._fillEnabled = false;
                this._outlineEnabled = false;
                this._geometryChanged.raiseEvent(this);
            }
            return;
        }

        var fillProperty = wall.fill;
        var fillEnabled = defined(fillProperty) && fillProperty.isConstant ? fillProperty.getValue(Iso8601.MINIMUM_VALUE) : true;

        var outlineProperty = wall.outline;
        var outlineEnabled = defined(outlineProperty);
        if (outlineEnabled && outlineProperty.isConstant) {
            outlineEnabled = outlineProperty.getValue(Iso8601.MINIMUM_VALUE);
        }

        if (!fillEnabled && !outlineEnabled) {
            if (this._fillEnabled || this._outlineEnabled) {
                this._fillEnabled = false;
                this._outlineEnabled = false;
                this._geometryChanged.raiseEvent(this);
            }
            return;
        }

        var vertexPositions = this._dynamicObject.vertexPositions;

        var show = wall.show;
        if ((defined(show) && show.isConstant && !show.getValue(Iso8601.MINIMUM_VALUE)) || //
            (!defined(vertexPositions))) {
            if (this._fillEnabled || this._outlineEnabled) {
                this._fillEnabled = false;
                this._outlineEnabled = false;
                this._geometryChanged.raiseEvent(this);
            }
            return;
        }

        var material = defaultValue(wall.material, defaultMaterial);
        var isColorMaterial = material instanceof ColorMaterialProperty;
        this._materialProperty = material;
        this._fillProperty = defaultValue(fillProperty, defaultFill);
        this._showProperty = defaultValue(show, defaultShow);
        this._showOutlineProperty = defaultValue(wall.outline, defaultOutline);
        this._outlineColorProperty = outlineEnabled ? defaultValue(wall.outlineColor, defaultOutlineColor) : undefined;

        var minimumHeights = wall.minimumHeights;
        var maximumHeights = wall.maximumHeights;
        var granularity = wall.granularity;

        this._fillEnabled = fillEnabled;
        this._outlineEnabled = outlineEnabled;

        if (!vertexPositions.isConstant || //
            !Property.isConstant(minimumHeights) || //
            !Property.isConstant(maximumHeights) || //
            !Property.isConstant(granularity)) {
            if (!this._dynamic) {
                this._dynamic = true;
                this._geometryChanged.raiseEvent(this);
            }
        } else {
            var options = this._options;
            options.vertexFormat = isColorMaterial ? PerInstanceColorAppearance.VERTEX_FORMAT : MaterialAppearance.VERTEX_FORMAT;
            options.positions = vertexPositions.getValue(Iso8601.MINIMUM_VALUE, options.positions);
            options.minimumHeights = defined(minimumHeights) ? minimumHeights.getValue(Iso8601.MINIMUM_VALUE, options.minimumHeights) : undefined;
            options.maximumHeights = defined(maximumHeights) ? maximumHeights.getValue(Iso8601.MINIMUM_VALUE, options.maximumHeights) : undefined;
            options.granularity = defined(granularity) ? granularity.getValue(Iso8601.MINIMUM_VALUE) : undefined;
            this._dynamic = false;
            this._geometryChanged.raiseEvent(this);
        }
    };

    /**
     * Creates the dynamic updater to be used when GeometryUpdater#isDynamic is true.
     * @memberof WallGeometryUpdater
     * @function
     *
     * @param {CompositePrimitive} primitives The primitive collection to use.
     * @returns {DynamicGeometryUpdater} The dynamic updater used to update the geometry each frame.
     *
     * @exception {DeveloperError} This instance does not represent dynamic geometry.
     */
    WallGeometryUpdater.prototype.createDynamicUpdater = function(primitives) {
        //>>includeStart('debug', pragmas.debug);
        if (!this._dynamic) {
            throw new DeveloperError('This instance does not represent dynamic geometry.');
        }

        if (!defined(primitives)) {
            throw new DeveloperError('primitives is required.');
        }
        //>>includeEnd('debug');

        return new DynamicGeometryUpdater(primitives, this);
    };

    /**
     * @private
     */
    var DynamicGeometryUpdater = function(primitives, geometryUpdater) {
        this._primitives = primitives;
        this._primitive = undefined;
        this._outlinePrimitive = undefined;
        this._geometryUpdater = geometryUpdater;
        this._options = new GeometryOptions(geometryUpdater._dynamicObject);
    };

    DynamicGeometryUpdater.prototype.update = function(time) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(time)) {
            throw new DeveloperError('time is required.');
        }
        //>>includeEnd('debug');

        var geometryUpdater = this._geometryUpdater;

        if (defined(this._primitive)) {
            this._primitives.remove(this._primitive);
        }

        if (defined(this._outlinePrimitive)) {
            this._primitives.remove(this._outlinePrimitive);
        }

        var dynamicObject = geometryUpdater._dynamicObject;
        var wall = dynamicObject.wall;
        var show = wall.show;

        if (!dynamicObject.isAvailable(time) || (defined(show) && !show.getValue(time))) {
            return;
        }

        var options = this._options;

        var vertexPositions = dynamicObject.vertexPositions;
        var minimumHeights = wall.minimumHeights;
        var maximumHeights = wall.maximumHeights;
        var granularity = wall.granularity;

        options.positions = vertexPositions.getValue(time, options.positions);
        options.minimumHeights = defined(minimumHeights) ? minimumHeights.getValue(time, options.minimumHeights) : undefined;
        options.maximumHeights = defined(maximumHeights) ? maximumHeights.getValue(time, options.maximumHeights) : undefined;
        options.granularity = defined(granularity) ? granularity.getValue(time) : undefined;

        if (!defined(wall.fill) || wall.fill.getValue(time)) {
            this._material = MaterialProperty.getValue(time, geometryUpdater.fillMaterialProperty, this._material);
            var material = this._material;
            var appearance = new MaterialAppearance({
                material : material,
                translucent : material.isTranslucent(),
                closed : false
            });
            options.vertexFormat = appearance.vertexFormat;

            this._primitive = new Primitive({
                geometryInstances : new GeometryInstance({
                    id : dynamicObject,
                    geometry : new WallGeometry(options)
                }),
                appearance : appearance,
                asynchronous : false
            });
            this._primitives.add(this._primitive);
        }

        if (defined(wall.outline) && wall.outline.getValue(time)) {
            options.vertexFormat = PerInstanceColorAppearance.VERTEX_FORMAT;

            var outlineColor = defined(wall.outlineColor) ? wall.outlineColor.getValue(time) : Color.BLACK;
            this._outlinePrimitive = new Primitive({
                geometryInstances : new GeometryInstance({
                    id : dynamicObject,
                    geometry : new WallOutlineGeometry(options),
                    attributes : {
                        color : ColorGeometryInstanceAttribute.fromColor(outlineColor)
                    }
                }),
                appearance : new PerInstanceColorAppearance({
                    flat : true,
                    translucent : outlineColor.alpha !== 1.0
                }),
                asynchronous : false
            });
            this._primitives.add(this._outlinePrimitive);
        }
    };

    DynamicGeometryUpdater.prototype.isDestroyed = function() {
        return false;
    };

    DynamicGeometryUpdater.prototype.destroy = function() {
        if (defined(this._primitive)) {
            this._primitives.remove(this._primitive);
        }

        if (defined(this._outlinePrimitive)) {
            this._primitives.remove(this._outlinePrimitive);
        }
        destroyObject(this);
    };

    return WallGeometryUpdater;
});