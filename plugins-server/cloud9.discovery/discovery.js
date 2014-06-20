/**
 * Discovery Module for the Cloud9 IDE
 *
 */
"use strict";

var util = require("util"),
	utilities = require("utilities"),
	discovery = utilities.discovery_provider.createDefaultProvider(),
	app_index = utilities.app_index,
	pkg_transfer = utilities.pkg_transfer,
	npm_util = utilities.npm_util,
	restify = require("restify"),
	fs = require("fs"),
	path = require("path"),
	dns = require("dns"),
	url = require("url"),
	Plugin = require("../cloud9.core/plugin"),
	DAV;


var DiscoveryPlugin = function(ide, workspace) {
	Plugin.call(this, ide, workspace);
	// initialize plugin variables
	this.name = "discovery";
	this.hooks = ["command"];
	this.dav = DAV;
	this.updateApps = function () {
		app_index.index(workspace.workspaceDir || process.cwd());
	};
	this.updateApps();
	npm_util.setPrefix(workspace.workspaceDir || process.cwd());
};

module.exports = function setup(options, imports, register) {
	var name = "discovery";
	DAV = imports.dav.getServer();
	imports.ide.register(name, DiscoveryPlugin, register);
};

util.inherits(DiscoveryPlugin, Plugin);

(function() {
	var update_apps_model,
		update_devices_model,
		check_if_alive,
		HandlerCollection;

	this.init = function () {
		var self = this;
		self.clients = {};
		this.handler = new HandlerCollection();

		discovery.createBrowser("http");
		discovery.on("up", function (service) {
			//console.log("up %j", service);
			if (service.name === "berry") {
				dns.reverse(url.parse(service.url).hostname, function (err, domains) {
					if(!err && util.isArray(domains) && domains.length > 0) {
						self.clients[service.url] = domains[0];
					} else {
						self.clients[service.url] = true;
					}
					update_devices_model();
				});
			}
			//console.log(self.clients);
		});
		discovery.on("down", function (service) {
			//console.log("down %j", service);
			if (service.name === "berry") {
				delete self.clients[service.url];
				update_devices_model();
			}
			//check_clients();
		});
		discovery.startBrowsing();

		update_apps_model = function () {
			var apps,
				model = "<data>",
				msg = {id: 3, subId: 1};
			self.updateApps();
			apps = app_index.getApps();
			apps.forEach(function (app) {
				model += "<app name=\"" + app.name + "\" />";
			});
			model += "</data>";
			msg.model = model;
			//console.log("Updated model: %j", model);
			self.ide.broadcast(JSON.stringify(msg), self.name);
		};

		check_if_alive = function (device) {
			var jsonClient = restify.createJsonClient({url: device.url});
			jsonClient.get("/apps", function (err) {
				if (err) {
					setTimeout(function () {
						delete self.clients[device.url];
						update_devices_model();
					}, 1000);
				}
			});
		};

		update_devices_model = function () {
			var model = "<data>",
				msg,
				jsonClient,
				checked = 0,
				devices = [],
				check_running;
			model += "<element name=\"Local\">";
			check_running = function (device) {
				return function (err, req, res, obj) {
						if (!err) {
							device.running = obj;
						} else {
							device.running = false;
						}
						checked++;
				};
			};
			for (var url in self.clients) {
				if (self.clients.hasOwnProperty(url)) {
					var device = {url: url, running: []};
					if (typeof self.clients[url] !== 'boolean') {
						device.domain = self.clients[url];
					}
					devices.push(device);
					jsonClient = restify.createJsonClient({url: url});
					jsonClient.get("/running", check_running(device));
				}
			}
			(function () {
				var interval = setInterval(function () {
					var model;
					if (checked === devices.length) {
						clearInterval(interval);
						model = "<data>";
						//console.log(devices);
						devices.forEach(function (device) {
							model += "<device ";
							if (typeof device.domain !== "undefined") {
								model += " domain=\"" + device.domain + "\"";
							}
							model += " url=\"" + device.url + "\" >";
							if (device.running === false) {
								check_if_alive(device);
							} else {
								device.running.forEach(function (app) {
									model += "<app name=\"" + app.name + "\" pid=\"" +
									app.pid + "\" debug=\"" + app.debug + "\" />";
								});
							}
							model += "</device>";
						});
						model += "</data>";
						msg = {id: 3, subId: 0, model: model};
						self.ide.broadcast(JSON.stringify(msg), self.name);
						//console.log("Updated model: %j", model);
					}
			}, 250);
		})();
		};
	};


	this.command = function (user, message, client) {
		var self = this,
			device_handler;
		//console.log("Received message");
		//console.log(message);
		device_handler = function (url, subId, app_name, pid) {
			var httpClient = restify.createHttpClient({
				url: url
			});
			var jsonClient = restify.createJsonClient({
				url: url
			});
			if (subId === 1 || subId === 2) {
				var apps = app_index.getAppsByName(app_name);
				// TODO: npm requires app names to be unique!
				// -> makes no sense to install two apps with
				// the same name, because the first app will
				// be overriden by the second one!
				if (util.isArray(apps) && apps.length > 0) {
					// TODO: npm pack takes several seconds, even
					// for small apps.
					npm_util.pack(apps[0].dir,
							self.handler.pack(url, apps[0], function (err) {
								var cmd = (subId === 1) ? "/run" : "/debug";
								if (!err) {
									jsonClient.post("/apps/" + apps[0].name + cmd,
										function (err, req, res, obj) {
											if (err) {
												self.handler.error(url, app_name, null, client, err);
											} else {
												httpClient.get(obj.created.path,
													self.handler.http_req(url, app_name, obj.created.pid, client));
												update_devices_model();
											}
										});
								} else {
									check_if_alive({url: url});
									console.log(err);
								}
					}));
				} else {
					console.log("No such app: %j", app_name);
				}
			} else if (subId === 3) {
				if (typeof pid !== "undefined" && !Number.isNaN(pid)) {
					console.log("Killing " + pid);
					jsonClient.del("/running/" + pid, function (err) {
						if (!err) {
							update_devices_model();
						} else {
							console.log(err);
							check_if_alive({url: url});
						}
					});
				}
			}
		};

		if (message.id === 4) {
			message.clients.forEach(function(device) {
				device_handler(device.url, message.subId, message.app, message.pid);
			});
		} else if (message.id === 5 && message.subId === 1) {
			//console.log("Update message!");
			// Update Request
			update_apps_model();
			update_devices_model();
			return true;
		}
		return false;
	};

	HandlerCollection = function () {
		var error_handler,
			data_handler,
			http_req_handler,
			pack_handler,
			isErr,
			self = this;

		this.error = error_handler = function (url, app_name, pid, client, err) {
			var msg = { id: 4, subId: 5, pid: pid,
				app: app_name, device: url, error: err};
			console.log("Error! %j", err);
			client.send(JSON.stringify(msg, self.name));
			check_if_alive({url: url});
		};
		this.data = data_handler = function (url, app_name, pid, client, data) {
			var msg = {id: 4, subId: 2, pid: pid};
			msg.data = data.toString();
			msg.app = app_name;
			msg.device = url;
			if (typeof client !== "undefined") {
				client.send(JSON.stringify(msg), self.name);
			}  else {
				self.ide.broadcast(JSON.stringify(msg), self.name);
			}
		};
		this.http_req = http_req_handler = function (url, app, pid, client) {
			return function (err, req) {
				if (err) {

					error_handler(url, app, pid, client, err);
				} else {
					req.on("result", function (err, res) {
						if (err) {
							error_handler(url, app, pid, client, err);
						} else {
							res.on("data", function (chunk) {
								data_handler(url, app, pid, client, chunk);
							});
							res.on("end", function () {
								update_devices_model();
								//exit_handler(url, app, false, client);
							});
						}
					});
				}
			};
		};
		isErr = function (err, cb) {
			if (err) {
				if (typeof cb === "function") {
					cb(err);
				}
				return true;
			}
			return false;
		};
		this.pack = pack_handler = function (url, app, cb) {
			return function (err) {
				var pkg_path = path.resolve(process.cwd(),
						app.name + "-" + app.version + ".tgz");
				if(!isErr(err, cb)) {
					pkg_transfer.upload(url, pkg_path, function (err) {
						if(!isErr(err, cb)) {
							if (typeof cb === "function") {
								cb();
							}
							fs.unlink(pkg_path);
						}
					});
				}
			};
		};
	};
}).call(DiscoveryPlugin.prototype);
