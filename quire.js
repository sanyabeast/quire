"use strict";
!(function(){
	/*Helpers*/
	var Tools = function(){};
	Tools.prototype = {
		each : function(list, iteratee, ctx){
			if (window.Array.isArray(list)){
				for (var a = 0, l = list.length; a < l; a++) iteratee.call(ctx, list[a], a, list);
			} else {
				for (var a in list) iteratee.call(ctx, list[a], a, list);
			}
		},
		merge : function(target, source){
			this.each(source, function(value, key){
				target[key] = value;
			});

			return target;
		},
		typeis : function(it, type){
			return Object.prototype.toString.call(it).match(/\[object (.*?)\]/)[1].toLowerCase() == type;
		},
		log : function(){
			console.log.apply(console, Array.prototype.slice.call(arguments).unshift("Quire: "));
		},
		warn : function(){
			console.warn.apply(console, Array.prototype.slice.call(arguments).unshift("Quire: "));
		},
		error : function(){
			console.error.apply(console, Array.prototype.slice.call(arguments).unshift("Quire: "));
		}
	};

	var _ = new Tools();

	/*exports object*/
	var Exports = function(quire){
		quire.exports[quire.activeScriptID] = this;
	};

	/*Module object*/
	var Module = function(quire){
		this.quire = quire;
	};

	Module.prototype = {
		set exports($module){
			var id = this.quire.activeScriptID;

			if (_.typeis(id, "string")){
				this.quire.registerModule(id, new Promise(function(resolve, reject){
					resolve($module);
				}));
			} else {
				_.warn("Module.exports: Some of loaded modules cannot be identified", $module);
			}
		},
	};

	/*Quire*/
	var Quire = function(){
		for (var k in this){
			if (_.typeis(this[k], "function")){
				this[k] = this[k].bind(this);
			}
		}

		this.module = new Module(this);

		this.inputScriptElement = document.currentScript;
		this.cfg  = {}
		this.modules = {};
		this.exports = {};
	};

	Quire.prototype = {
		get activeScriptID(){
			return document.currentScript ? document.currentScript.dataset.quireID : "?";
		},
		init : function(){
			if (this.inputScriptElement.dataset.main){
				this.loadScript(this.inputScriptElement.dataset.main);
			}
		},
		loadScript : function(id){
			return new Promise(function(resolve, reject){
				var url = id;

				if (id == "exports"){
					var $exports = new Exports(this);

					this.registerModule("exports", new Promise(function(resolve){
						resolve($exports);
					}));

					resolve($exports);
					return;
				}

				if (!_.typeis(this.modules[id], "undefined")){
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

				scriptNode.src = this.processURL(url, true);
				document.head.appendChild(scriptNode);
			}.bind(this));
		},
		registerModule : function(id, $module){
			this.modules[id] = $module;
		},
		config : function(config){
			this.cfg = _.merge(this.cfg, config);
		},
		processURL : function(url, isScript){
			var result;

			if (_.typeis(this.cfg.paths, "object") && _.typeis(this.cfg.paths[url], "string")){
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
			if (_.typeis(callback, "function")){
				resolvedDeps.then(function(resolvedDeps){
					callback.apply(window, resolvedDeps);
				});
			}

			return resolvedDeps;
		},
		define : function(name, deps, factory){
			var scriptNode = document.currentScript;
			var id = scriptNode.dataset.quireID;

			switch (true){
				case _.typeis(name, "string") && _.typeis(deps, "function"):
					factory = deps;
					deps = null;
					name = id;
				break;
				case  _.typeis(name, "array") && _.typeis(deps, "function"):
					factory = deps;
					deps = name; 
					name = id;
				break;
				case _.typeis(name, "function"):
					factory = name;
					deps = null;
					name = id;
				break;
			}

			if (_.typeis(this.modules[id], "undefined")){
				this.registerModule(id, new Promise(function(resolve, reject){

					this.resolveDeps(deps).then(function(resolvedDeps){
						var $module = factory.apply(window, resolvedDeps);
						
						if (_.typeis($module, "undefined") && this.exports[id] instanceof Exports){
							$module = this.exports[id];
							delete this.exports[id];
						}

						resolve($module);
					}.bind(this));
				}.bind(this)));
			}

			
		},
		map : function(deps){
			return new Promise(function(resolve, reject){
				var result = [];
				var totalCount = deps.length;
				var registeredCount = 0;

				_.each(deps, function(id, index){

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

				_.each(deps, function(url, index){
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
	window.module = quire.module;
	window.quire.init();
})()