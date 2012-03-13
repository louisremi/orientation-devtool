(function(window){

var guest = froglet( "orientation.bookmarklet.html", {
		bottom: 0,
		right: 0,
		height: 360,
		width: 320
	}),
	dispatchEvent,
	_deviceorientation = "deviceorientation",
	_devicemotion = "devicemotion",
	_DeviceOrientationEvent = "DeviceOrientationEvent";

try {
	// Feature detection: browser not supporting this should throw
	document.createEvent( _DeviceOrientationEvent );

	// use Device<type>Event (Chrome/Firefox)
	dispatchEvent = function( type, data ) {
		var isOrientation = type === _deviceorientation,
			deviceEvent = isOrientation ?
				_DeviceOrientationEvent:
				"DeviceMotionEvent",
			event = document.createEvent( deviceEvent );

		isOrientation ?
			event["init" + deviceEvent]( type, true, true,
    		data.alpha,
    		data.beta,
    		data.gamma,
    		true
    	):
    	event["init" + deviceEvent]( type, true, true,
    		null,
    		data.accelerationIncludingGravity,
    		null,
    		null
    	);

		window.dispatchEvent( event );
	}

} catch (e) {
	// use HTMLEvents (Safari/Opera)
	dispatchEvent = function( type, data ) {
		var event = document.createEvent( "HTMLEvents" ),
			key;

    event.initEvent( type, true, true );
    event.eventName = type;
    for ( key in data ) {
      event[key] = data[key];
    }

		window.dispatchEvent( event );
	}
};

guest.on( _deviceorientation, function( message ) {
	dispatchEvent( _deviceorientation, message );
});

guest.on( _devicemotion, function( message ) {
	dispatchEvent( _devicemotion, message );
});

window.orientationDevtool = guest;

})(window);