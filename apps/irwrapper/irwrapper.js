(function () {
	"use strict";
	var events = require("events"),
	    IRWrapper,
	    device = "/dev/ttyAMA0",
	    fs = require("fs"),
	    stream = fs.createReadStream(device);

	/**
	 * This wrapper listens
	 * for IR signals on UART
	 * and emits data messages
         * when there is new data.
	 * @class IRWrapper
	 * @constructor
	 **/
	IRWrapper = function () {
		var self = this,
		    timeout,
		    emit = true,
			buffer_hash = {},
		    interval = 800;
		/**
		 * This events is fired whenever
		 * there is data on UART.
		 * @param {String} data The string
		 * of the mapped IR signal.
		 * @event data 
		 **/
		stream.on("data", function (data) {
			if (data.length === 1) {
				buffer_hash["cateye_" + data.toString("hex")] = true;
				if (emit) { 
					clearTimeout(timeout);
					for (var tag in buffer_hash) {
						if (buffer_hash.hasOwnProperty(tag)) {
							self.emit("data", tag);
						}
					}
					buffer_hash = {};
					//self.emit("data", "cateye_" + data.toString("hex"));
					emit = false;
					timeout = setTimeout(function () {
						emit = true;
					}, interval);
				}
			}
		});

		/**
		 * This closes the input stream.
		 * @method close
		 **/
		this.close = function () {
			stream.push(null);
		};

		/**
		 * When the stream has beeen closed 
		 * this event will be fired.
		 * @event end 
		 **/
		stream.on("end", function () {
			self.emit("end");
		});
	};

	require("util").inherits(IRWrapper, events.EventEmitter);

	/**
	 * Factory method which returns a 
	 * new IRWrapper object.
	 * @method createIRWrapper
	 **/
	exports.createIRWrapper = function () {
		return new IRWrapper();
	};
})();
