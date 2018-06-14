"use strict";
var Quire = function(){
	for (var k in this){
		if (typeof this[k] == "function"){
			this[k] = this[k].bind(this);
		}
	}

	this.scriptElement = document.currentScript;
	this.cfg  = {}
	this.modules = {};
	this.exports = {};
};

Quire.prototype = {
	Exports : function(){
		this.$quireID = document.currentScript ? document.currentScript.dataset.quireID : "?";
	},
	init : function(){
		if (this.scriptElement.dataset.main){
			this.loadScript(this.scriptElement.dataset.main);
		}
	},
	each : function(list, iteratee, ctx){
		if (window.Array.isArray(list)){
			for (var a = 0, l = list.length; a < l; a++){
				iteratee.call(ctx, list[a], a, list);
			}
		} else {
			for (var a in list){
				iteratee.call(ctx, list[a], a, list);
			}
		}
	},
	merge : function(target, source){
		this.each(source, function(value, key){
			target[key] = value;
		});

		return target;
	},
	loadScript : function(id){
		return new Promise(function(resolve, reject){
			var url = id;

			if (id == "exports"){
				var $exports = new this.Exports();
				this.exports[$exports.$quireID] = $exports;
				resolve($exports);

				this.register(new Promise(function(resolve){
					resolve($exports);
				}.bind(this)), "exports");

				resolve($exports);

				return;
			}

			if (typeof this.modules[id] != "undefined"){
				resolve(this.modules[id]);
				return;
			}

			var scriptNode = document.createElement("script");
			scriptNode.dataset.quireID = id;
			scriptNode.async = true;

			scriptNode.addEventListener("load", function(){
				resolve(id);
			}.bind(this), false);

			scriptNode.addEventListener("error", function(){
				reject(id);
			}.bind(this), false);

			scriptNode.src = this.normalizeScriptURL(url);
			document.head.appendChild(scriptNode);
		}.bind(this));
	},
	register : function($module, id){
		this.modules[id] = $module;
	},
	config : function(config){
		this.cfg = this.merge(this.cfg, config);
	},
	normalizeScriptURL : function(url){
		var result;

		if (typeof this.cfg.paths == "object" && typeof this.cfg.paths[url] == "string"){
			url = this.cfg.paths[url];
		}

		if (url.lastIndexOf(".js") == url.length - 3){
			result = [this.cfg.baseUrl || "", url].join("");
		} else {
			result = [this.cfg.baseUrl || "", url, (".js")].join("");
		}

		if (this.cfg.urlArgs){
			result = [result, this.cfg.urlArgs].join("?");
		}


		return result;
		
	},
	require : function(deps, callback){
		var resolvedDeps = this.resolveDeps(deps);
		if (typeof callback == "function"){
			resolvedDeps.then(function(resolvedDeps){
				callback.apply(window, resolvedDeps);
			});
		}

		return resolvedDeps;
	},
	define : function(name, deps, factory){
		var scriptNode = document.currentScript;
		var id = scriptNode.dataset.quireID;

		if (!this.modules[id]){
			this.register(new Promise(function(resolve, reject){
				if (Array.isArray(name)){
					factory = deps;
					deps = name;
					name = id;
				}

				if (typeof name == "function"){
					factory = name;
					deps = null;
					name = id;
				}

				this.resolveDeps(deps).then(function(resolvedDeps){
					var $module = factory.apply(window, resolvedDeps);
					
					if (typeof $module == "undefined" && this.exports[id] instanceof this.Exports){
						$module = this.exports[id];
						delete this.exports[id];
					}

					resolve($module);
				}.bind(this));
			}.bind(this)), id);
		}

		
	},
	map : function(deps){
		return new Promise(function(resolve, reject){
			var result = [];
			var totalCount = deps.length;
			var registeredCount = 0;

			this.each(deps, function(id, index){

				if (this.modules[id]){
					this.modules[id].then(function($module){
						result[index] = $module;
						registeredCount++;
						if (registeredCount >= totalCount){
							resolve(result);
						}
					});	
				} else {
					result[index] = null;
					registeredCount++;
					if (registeredCount >= totalCount){
						resolve(result);
					}
				}

						
			}, this);

		}.bind(this));
	},
	resolveDeps : function(deps){
		return new Promise(function(resolve, reject){
			if (!deps || !deps.length){
				resolve([]);
				return;
			}

			var totalCount = deps.length;
			var loadedCount = 0;

			this.each(deps, function(url, index){
				this.loadScript(url).then(function(id){
					loadedCount++;
					if (loadedCount >= totalCount){
						this.map(deps).then(function(resolvedDeps){
							resolve(resolvedDeps);;
						});
					}
				}.bind(this));
			}, this);
		}.bind(this));
	}	
};

window.quire = new Quire();
window.require = window.requirejs = window.quire.require;
window.require.config = window.requirejs.config = window.quire.config;
window.define = window.quire.define;
window.define.amd = true;
window.quire.init();