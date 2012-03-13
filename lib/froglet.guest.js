(function(window,document,undefined) {

var hostWindow = ( window.opener || window ).parent,
	docEl = document.documentElement,
	isPopup = !!window.opener,
	id, position,
	proxy,
	_addEventListener = "addEventListener",
	_message = "message",
	screenProps,
	routes = {},
	container,
	listen, msgEvent, i;

// find the id of this widget in the url
id = getFrag( "flId=(\\w*?)" );

// find the proxy iframe if the widget is loaded in a popup
// a proxy is required in IE, since window.opener.postMessage is forbiden
if ( isPopup ) {
	i = hostWindow.frames.length;
	while ( i-- ) {
		if ( hostWindow.frames[i].froglet.id == id ) {
			proxy = hostWindow.frames[i];
			break;
		}
	}
}

// feature detection
if ( _addEventListener in window ) {
	listen = _addEventListener;
	msgEvent = _message;
	document[ listen ]("DOMContentLoaded", insertControls, false);
} else {
	listen = "attachEvent";
	msgEvent = "on" + _message;
	document[ listen ]("onreadystatechange", function() {
		if ( document.readyState == "complete" ) {
			insertControls();
		}
	});
}
screenProps = window.screenX != undefined ? [ "X", "Y" ] : [ "Left", "Top" ];

function buildControls() {
	var div,
		divs = "",
		btns = { close: [ "Close", "\u2297" ]	},
		style, btn;

	if ( !isPopup ) {
		btns.toggleSize = [ "Minimize", "\u2296" ],
		btns.togglePosition = [ "Alternate Position", "\u2298" ]
	}
	btns.togglePop = isPopup ? [ "Pop-In", "\u2299" ] : [ "Pop-Out", "\u229A" ];

	style =
		"#fl_controls{position:fixed;top:0;left:0;padding:5px;background:#ccc;height:18px;width:100%;cursor:default;border-bottom:1px solid #666} " +
		".flBtn{display:inline-block;font-family:sans-serif;line-height:16px;font-size:26px;cursor:pointer} " +
		"#fl_controls.flMin{padding:1px} .flMin .flBtn{display:none} .flMin #fl_toggleSize{display:block} .flMin #fl_toggleSize:after{content:'\u2295'}";

	for ( btn in btns ) {
		style += " #fl_" + btn + ":after{content:'" + btns[ btn ][1] + "'}";
		divs += "<div id='fl_" + btn + "' class='flBtn' title='" + btns[ btn ][0] + "'></div>\n";
	}

	style += "#fl_togglePosition:hover:after{content:'\u229b'}";

	div = document.createElement( "div" );
	div.id = "fl_controls";
	div.innerHTML = divs + "&nbsp;<style id='fl_style'>" + style + "</style>";

	// event delegation
	div.onclick = _onclick;

	return div;
}

function insertControls() {
	document.body.appendChild( container );
}

// event delegation
function _onclick( e, internal ) {
	var target = e ? e.target : window.event.srcElement,
		type = target.id.replace( /^fl_(\w*?)$/, "$1" ),
		popup, width, height, toClose;

	if ( type == "toggleSize" ) {
		if ( target.title == "Minimize" ) {
			target.title = "Maximize";
			//body.style.overflow = "hidden";
			container.className = "flMin";
		} else {
			target.title = "Minimize";
			//body.style.overflow = "";
			container.className = "";
		}

	} else if ( type == "togglePop" && !isPopup ) {
		// ask host what is the current position of the widget in the iframe
		froglet.emit( "pos", undefined, true );

		width = ( ( internal && internal[0] ) || window.innerWidth || docEl.clientWidth );
		height = ( ( internal && internal[1] ) || window.innerHeight || docEl.clientHeight );

		// open popup
		froglet.popup = popup = open( location, "",
			"width=" + width +
			",height=" + height
		);

		// In Chrome, the size of the popup includes the browser chrome.
		// In all browser, the position of the popup is calculated by the host
		// and only available after the popup has been opened
		// Use a setTimeout to fix the size if needed and set the position of the popup
		setTimeout(function() {
			var diffH = height - popup.innerHeight;
			diffH && popup.resizeBy( 0, diffH );
			popup.moveTo( position[0], position[1] );
		}, 200);

	} else if ( ( type == "close" || type == "togglePop" ) && isPopup ) {
		// "warn" the proxy that there's no more popup
		proxy && ( type == "close" ?
			proxy.froglet.popup = undefined :
			proxy.location.reload()
		);
		// wait for the last message to be emitted before closing
		toClose = true;
	}

	// save current state
	if ( type == "togglePop" && froglet.saveState ) {
		localStorage[ id ] = JSON.stringify( froglet.saveState() );
	}

	!internal && froglet.emit( type, undefined, true );
	toClose && close();
}

// message routing
function _onmessage( e ) {
	var message = JSON.parse( e.data ),
		type = message.type,
		listeners,
		i, l;

	// proxy messages to the popup
	if ( froglet.popup && type != "pos" ) {
		return froglet.popup.froglet._direct( e );

	} else if ( message.internal ) {
		if ( type == "pos" ) {
			// store position
			return position = [ window[ "screen" + screenProps[0] ] + message.payload[0], window[ "screen" + screenProps[1] ] + message.payload[1] ];

		} else {
			// toggleSize, close, etc.
			_onclick( { target: container.querySelector( "#fl_" + type ) }, message.payload || true );
			// add an `fl` prefix to internal events before treating them as public
			type = "fl" + type.substr(0,1).toUpperCase() + type.substr(1);
		}
	}

	// dispatch message to listeners of same "type" and wildcard (*) listeners
	if ( ( listeners = ( routes[ type ] || [] ).concat( routes["*"] ) ) ) {
		for ( l = listeners.length, i = 0; i < l; i++ ) {
			listeners[i] && listeners[i]( message.payload, type );
		}
	}
}

container = buildControls();

// setup message router
window[ listen ](msgEvent, _onmessage, false);

// API availble to guest window
window.froglet = {
	id: id,

	emit: function( type, payload, internal ) {
		var message = { 
			flId: id,
			type: type
		};

		internal && ( message.internal = internal );
		payload != undefined && ( message.payload = payload );

		// make sure postMessage is asynchronous
		//setTimeout(function() {
			( ( proxy && proxy.froglet._host ) || hostWindow ).postMessage( JSON.stringify( message ), "*" );
		//}, 0);
	},

	on: function( type, listener ) {
		// create a new route if necessary
		!routes[ type ] && ( routes[ type ] = [] );

		routes[ type ].push( listener );
	},

	off: function( type, listener ) {
		if ( listener && routes[ type ] ) {
			// remove a single listener
			routes[ type ].splice( routes[ type ].indexOf( listener ), 1 );

		// remove a complete route
		} else {
			delete routes[ type ];
		}
	},

	getState: function() {
		var state = localStorage[ id ];

		if ( state ) {
			// IE8 throws an error when deleting a key that is undefined
			delete localStorage[ id ];
		} else {
			state = getFrag( "flIni=(.*?)" );
			state && ( state = decodeURIComponent( state ) );
		}

		return state && JSON.parse( state );
	},

	_direct: _onmessage,
	_host: hostWindow
};

froglet.emit( "lstn", undefined, true );

function getFrag( fragId ) {
	var val,
		search = location.search;

	search.replace( RegExp( "(?:\\?|&)" + fragId + "(?:&|#|$)" ), function(a,b) {
		val = b;
	});

	return val;
}

})(window,document);
