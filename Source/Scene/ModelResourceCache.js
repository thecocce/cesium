/*global define*/
define([
        '../Core/Cartesian3',
        '../Core/defined',
        '../Core/LinearSpline',
        '../Core/Quaternion',
        '../Core/QuaternionSpline',
        './getModelAccessor'
    ], function(
        Cartesian3,
        defined,
        LinearSpline,
        Quaternion,
        QuaternionSpline,
        getModelAccessor) {
    "use strict";
    /*global WebGLRenderingContext*/


    var ModelResourcesCache = function(options) {
        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

        this._modelList = [];
    };

    ModelResourcesCache.prototype.getModel = function(modelUrl) {
        
		var arrayLength = this._modelList.length;
		for (var i = 0; i < arrayLength; i++) {
			if (this._modelList[i]._url == modelUrl)
			{
				return this._modelList[i];
			}
		}
		
		var result = ModelResources.fromGltf({
			url : modelUrl
		});
		
		this._modelList[i].push(result);
		
		return result;
    };
	
});
