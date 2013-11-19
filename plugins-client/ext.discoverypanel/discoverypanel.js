define(function (require, exports, module) {
	"use strict";
	var ide = require("core/ide");
	var ext = require("core/ext");
	//var util = require("core/util");
	//var settings = require("core/settings");
	var panels = require("ext/panels/panels");
	var c9console = require("ext/console/console");
	var markup = require("text!ext/discoverypanel/discoverypanel.xml");
	var commands = require("ext/commands/commands");  
	//var editors = require("ext/editors/editors");
	var menus = require("ext/menus/menus");
	var skin = require("text!ext/discoverypanel/skin.xml");

	module.exports = ext.register("ext/discoverypanel/discoverypanel", {
		name			: "Discovery Panel",
		dev				: "Daniel",
		alone			: true,
		type			: ext.GENERAL,
		markup			: markup,
		nodes			: [],
		defaultWidth    : 150,
		skin :  { 
			id : "discoverypanel",
			data : skin,
			"media-path" : ide.staticPrefix + "/ext/discoverypanel/images/",
			"icon-path" : ide.staticPrefix + "/ext/discoverypanel/images/"
		},
		hook : function () {
			
			var _self = this;
			
			this.markupInsertionPoint = colLeft;

			/*
			var discoveryModel = this.discoveryModel = new apf.model({
						htmlNode 	: document.body,
						id 			: "discoveryModel",
						data		: ""
			});
			var appModel = this.appModel =  new apf.model({
					htmlNode : document.body,
					id 		 : "appModel",
					data	 : ""
			});
			*/

			panels.register(this, {
				position : 7000,
				caption  : "Discovery",
				"class"  : "discovery_panel",
				command  : "discoverypanel"
			});

			commands.addCommand({
				name: "discoverypanel",
				hint: "Show the device discovery panel",
				exec: function () {
					_self.show();
				}
			});

			commands.addCommand({
				name: "deployandrun",
				hint: "Deploys and runs the selected app",
				exec: function () {
					_self.deployAndRun();
				}
			});
			var discoveryModel = this.discoveryModel = new apf.model().load("<data />");
			var appModel = this.appModel =  new apf.model().load("<data />");

			ide.addEventListener("socketMessage", function (e) {
				var msg = e.message;
			    //console.log("Got msg: %j", e.message);
				if (msg.id === 3) {
					if (msg.subId === 0) {
						discoveryModel.load(msg.model);
					}  else if (msg.subId === 1) {
						appModel.load(msg.model);
					}
				} else if (msg.id === 4 && msg.subId === 2)  {
					var stream = c9console.getLogStreamOutObject(Number(msg.pid)); 
					if (!stream.$ext) {
						stream = c9console.getLogStreamOutObject(msg.pid, null, 
							msg.app + ":" + msg.pid + "@" + msg.device);
						apf.setStyleClass(stream.$ext, "loaded");
					}
					c9console.show();
					//c9console.showOutput();
					c9console.write(msg.data, {tracer_id: msg.pid});
					/*
					txtOutput.addValue(msg.app + ":" + msg.pid + "@" + 
						msg.device+ ": ");
					txtOutput.addValue(msg.data);
					txtOutput.addValue("<br />");
					*/


				/*} else if (msg.id === 4 && msg.subId === 4) {
					c9console.show();
					c9console.showOutput();
					if (msg.automatic) {
						txtOutput.addValue("(Automatic) ");
					}
					txtOutput.addValue(msg.app + "@" + msg.device+ " exited with code: " + msg.code + "<br />");
				*/

				} else if (msg.id === 4 && msg.subId === 5) {
					c9console.show();
					c9console.showOutput();
					txtOutput.addValue("Error! " + msg.app + "@" + msg.device + ": ");
					txtOutput.addValue(msg.error);
					txtOutput.addValue("<br />");
				} else {
					return false;
				}
			});
		},


		init : function () {
			this.panel = winDiscoveryPanel;
			this.nodes.push(winDiscoveryPanel);
			// Listen to incoming server messages
			// -> handler this.onMessage
			// send update request to server
			ide.send({id: 5, subId: 1, sender: "discoverypanel" });
			apf.addListener(treeDiscoveryPanel, "afterselect", function (e) {
				var selected = e.selected;
			});
		},

		killApp : function () {
			var msg = {id: 4, subId: 3},
				selection = treeDiscoveryPanel.getSelection();

			for (var i=0; i < selection.length; i++) {
				var pid = selection[i].attributes.getNamedItem("pid"),
					app = selection[i].attributes.getNamedItem("name"),
					url;
				if (typeof pid !== "undefined" && typeof app !== "undefined") {
					msg.pid = Number(pid.value);
					msg.app = app.value;
					url = selection[i].parentNode.attributes.getNamedItem("url");
					if (typeof url !== "undefined")  {
						msg.clients = [{url: url.value}];
					}
				}
			}
			if (typeof msg.clients !== "undefined") {
				msg.sender ="discoverypanel";
				console.log("Sending msg");
				console.log(msg);
				ide.send(msg);
			}
		},

		sendRequest: function () {
			var msg = {id: 4},
				selection = treeDiscoveryPanel.getSelection(),
				app,
				request;
			app = appDropdown.getSelection();
			request = requestDropdown.getSelection();
			/*
			while (selection.nodeName !== "device") {
				selection = selection.parentNode
			};
			console.log(selection);
			*/
			if (app.length === 1 && request.length === 1) {
				msg.app = app[0].attributes.getNamedItem("name").value;
				if (request[0].id === "stopExecutionRequest") {
					msg.subId = 3;
					msg.pid = Number(cmdArgs.getValue());
				} else if (request[0].id === "executionRequest") {
					msg.subId = 1;
					if (cmdArgs.getValue() === "") {
						msg.args = [];
					} else {
						msg.args = cmdArgs.getValue().split(" "); 
					}
				} else {
				}
				msg.clients = [];
				msg.sender ="discoverypanel";
				for (var i=0; i < selection.length; i++) {
					var url = selection[i].attributes.getNamedItem("url");
					if (typeof url !== "undefined") {
						msg.clients.push({url: url.value});
					}
				}
				console.log("Sending msg: ");
				console.log(msg);
				if (msg.clients.length > 0) {
					ide.send(msg);
				}
			} else {
			}
		},

		show : function (e) {
			if (!this.panel || !this.panel.visible) {
				panels.activate(this);
				this.enable();
			} else {
				panels.deactivate(null, true);
			}
			return false;

		},

		enable : function () {
			this.nodes.each(function (item) {
				item.enable();
			});
		},

		disable : function () {
			this.nodes.each(function (item) {
				item.disable();
			});
		},

		destroy : function () {
			commands.removeCommandByName("discoverypanel");

			this.nodes.each(function (item) {
				item.destroy(true, true);
			});
			this.nodes = [];
			
			panels.unregister(this);
		}
	});
});
