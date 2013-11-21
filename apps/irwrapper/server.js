#!/usr/bin/env node
(function () {
	"use strict";
	var	discovery = require("utilities").discovery_provider.createDefaultProvider(),
		ir = require("./irwrapper"),
		restify = require("restify"),
		url = require("url"),
		wrapper = ir.createIRWrapper(),
		jsonClient;

	wrapper.on("data", function (data) {
		//console.log("Addr: %j", berry.address());
		var obj = {
			tags: [data], 
			port: 8081
		};
		//console.log("data: " + data);
		if (typeof jsonClient !== "undefined") {
			jsonClient.post("/tags/upload", obj, function (err, req, res, obj) {
				if (err) {
					console.log("Could not upload tags!");
					//throw err;
				}
			});
		}
	});

	discovery.on("up", function (service) {
		if (service.name === "logitag") {
			jsonClient = restify.createJsonClient({
				url: service.url
			});
		}
	});

	discovery.on("down", function (service) {
		if (service.name === "logitag") {
			jsonClient.close();
			jsonClient = undefined;
		}
	});

	discovery.startBrowsing();

})();
