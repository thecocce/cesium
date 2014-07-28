function update_navigator(obj)
{
   obj.update();
};

function getSaneValue(x)
{
	console.log("axis: "+x);
	if (x>100000)
	{
		return -1;
	}
	else
	if (x>1)
	{
		return 1;	
	}
	else
	{
		return x;
	}
}

var SpaceNavigator = function(scene, options) 
{
        //>>includeStart('debug', pragmas.debug);
        if (!Cesium.defined(scene)) {
            throw new Cesium.DeveloperError('scene is required');
        }
        //>>includeEnd('debug');
        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

		this._scene = scene;
        this._camera = scene.camera;
        this._ellipsoid = scene.globe.ellipsoid;
		this._gamepad = null;	
		
		this._interval = Cesium.defaultValue(options.interval, 100);

		scene.screenSpaceCameraController.enableRotate = false;
		scene.screenSpaceCameraController.enableTranslate = false;
		scene.screenSpaceCameraController.enableZoom = false;
		scene.screenSpaceCameraController.enableTilt = false;
		scene.screenSpaceCameraController.enableLook = false;

	
					
		var that = this;
		window.addEventListener("gamepadconnected", function(e) 
		{
			that._gamepad = e.gamepad;
			//alert("Gamepad connected at index %d: %s. %d buttons, %d axes.", e.gamepad.index, e.gamepad.id, e.gamepad.buttons.length, e.gamepad.axes.length);
		});
		
		window.addEventListener("gamepaddisconnected", function(e) 
		{
			that._connected = false;
			//alert("Gamepad disconnected from index %d: %s", e.gamepad.index, e.gamepad.id);
		});		
        
		
        setInterval(function(){update_navigator(that)}, this._interval);
    };

	
	
    SpaceNavigator.prototype.update = function() 
	{
        if (!Cesium.defined(this._gamepad) || this._gamepad==null) 
		{
			var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
			if (gamepads.length>0)
			{
				this._gamepad = navigator.getGamepads()[0];
				alert("Got a gamepad");
			}
			
			return;
		}
				
		var cameraHeight = this._ellipsoid.cartesianToCartographic(camera.position).height;
		var moveRate = cameraHeight / 100.0;
		var lookRate = 0.01;
		var dir = 0;
		
		var zoomAxis = 0;
		var lookAroundAxis = 1;
		var lookVerticalAxis = 2;
		
		dir = getSaneValue(this._gamepad.axes[zoomAxis]);
	
		var speed = moveRate * Math.abs(dir);
		
		if (dir<0.0)
		{
			camera.moveBackward(speed);
		}
		if (dir>0.0)
		{
			camera.moveForward(speed);
		}
        
		
		dir = getSaneValue(this._gamepad.axes[lookAroundAxis]);		

		var rot = lookRate * Math.abs(dir);
		
		if (dir<0.0)
		{
			camera.lookLeft(rot);
		}
		if (dir>0.0)
		{
			camera.lookRight(rot);
		}

		dir = getSaneValue(this._gamepad.axes[lookVerticalAxis]);		

		var rot = lookRate * Math.abs(dir);
		
		if (dir<0.0)
		{
			camera.lookDown(rot);
		}
		if (dir>0.0)
		{
			camera.lookUp(rot);
		}
		
		
    };

/*    SpaceNavigator.prototype.isDestroyed = function() {
        return false;
    };

    SpaceNavigator.prototype.destroy = function() {
        this._container.removeChild(this._svgNode);
        return destroyObject(this);
    };

*/
	