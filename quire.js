"use strict";
var isNode = typeof global != "undefined";

(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(factory);
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory(true);
    } else {

    	if (!isNode){
    		var Quire = factory();
	        var quire = window.quire = new Quire();
			window.require = window.requirejs = function(){ return quire.require.apply(quire, arguments) };
			window.require.config = window.requirejs.config = function(){ return quire.config.apply(quire, arguments) };
			window.define = function(){ return quire.define.apply(quire, arguments) };
			window.define.amd = true;
			window.module = quire.module;
			
			quire.init();
    	}
    }
}(this, function(){

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
			var args = Array.prototype.slice.call(arguments);
			args.unshift("Quire:");
			console.log.apply(console, args);
		},
		warn : function(){
			var args = Array.prototype.slice.call(arguments);
			args.unshift("Quire:");
			console.warn.apply(console, args);
		},
		error : function(){
			var args = Array.prototype.slice.call(arguments);
			args.unshift("Quire:");
			console.error.apply(console, args);
		},
		genRandString : function(prefix, length){
			var randString = "";

			while(randString.length < length){
				randString += (Math.random().toString(32).substring(3, 12));
			}

			randString = randString.substring(0, length);

			return prefix ? [prefix, randString].join("-") : randString;
		},
		fetchData : function(url, sync){
			var xhr = new XMLHttpRequest();
			xhr.open("get", url, false);

			if (sync){
				xhr.send();
				return xhr.responseText;
			} else {
				return this.promise(function(resolve, reject){
					xhr.onload = function (e) {
					  	if (xhr.readyState === 4) {
					  	  	if (xhr.status === 200) {
					  	  	  	resolve(xhr.responseText);
					  	  	} else {
					  	  	  	reject(xhr);
					  	  	}
					  	}
					};
					xhr.onerror = function (e) {
					  	reject(xhr);
					};

					xhr.send();
				})
			}
		},
	};

	var _ = new Tools();

	/*exports object*/
	var Exports = function(quire){
		quire.exports[quire.activeScriptId] = this;
	};

	/*Module object*/
	var Module = function(quire){
		this.quire = quire;
	};

	Module.prototype = {
		set exports($module){
			var id = this.quire.activeScriptId;

			if (_.typeis(id, "string")){
				this.quire.registerModule(id, quire.promise(function(resolve, reject){
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
		this.syncId = null;

		this.inputScriptElement = document.currentScript;
		this.cfg  = {}
		this.modules = {};
		this.exports = {};
	};

	Quire.prototype = {
		promise : function(handler){
			var promise = new Promise(function(resolve, reject){
				handler(resolve, reject);
			}).then(function(value){
				promise.value = value;
				return value
			});

			return promise;
		},
		get activeScriptId(){
			var result = null;

			if (this.syncId){
				return this.syncId;
			}

			if (this.activeScript && this.activeScript.dataset.quireId){
				result = this.activeScript.dataset.quireId;
			} else if (this.activeScript){
				result = this.activeScript.src;
			} else {
				result = _.genRandString("anon", 8);
			}

			return result;
		},
		get activeScript(){
			return document.currentScript || null;
		},
		init : function(){
			if (this.inputScriptElement.dataset.main){
				this.loadScript(this.inputScriptElement.dataset.main);
				this.inputScriptElement.remove();
			}
		},
		loadScript : function(id){
			return this.promise(function(resolve, reject){
				var url = id;

				if (id == "exports"){
					var $exports = new Exports(this);

					this.registerModule("exports", this.promise(function(resolve){
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
				scriptNode.dataset.quireId = id;
				scriptNode.async = true;

				scriptNode.addEventListener("load", function(){
					scriptNode.remove();
					resolve(id);
				}.bind(this), false);

				scriptNode.addEventListener("error", function(evt){
					this.loadScriptSync(id, resolve, reject);
				}.bind(this), false);

				scriptNode.src = this.processURL(url, true);
				document.head.appendChild(scriptNode);
			}.bind(this));
		},
		loadScriptSync : function(id, resolve, reject){
			if (!_.typeis(this.modules[id], "undefined")){
				return this.modules[id].value;
			}

			this.syncId = id;

			var url = this.processURL(id);
			var code = _.fetchData(url, true);
			
			try {
				eval(code);
				if (_.typeis(resolve, "function")){
					resolve(id);
				}
			} catch (err){
				_.error("LoadScriptSync: invalid JavaScript at " + url);
				if (_.typeis(reject, "function")){
					reject(id);
				}
			}

			this.syncId = null;

			return this.modules[id].value;

		},
		registerModule : function(id, $module){
			this.modules[id] = $module;
		},
		config : function(config){
			this.cfg = _.merge(this.cfg, config);
		},
		processURL : function(url){
			var result;

			if (url.indexOf("://") > -1){
				result = url;
			} else {
				if (_.typeis(this.cfg.paths, "object")){
					_.each(this.cfg.paths, function(path, alias){
						if (url.indexOf(alias + "/") == 0){
							url = url.replace(alias + "/", path + "/");
						} else if (url == alias){
							url = path;
						}
					});
				}

				if (url.lastIndexOf(".js") == url.length - 3){
					result = [this.cfg.baseUrl || "", url].join("");
				} else {
					result = [this.cfg.baseUrl || "", url, (".js")].join("");
				}

				if (this.cfg.urlArgs){
					result = [result, this.cfg.urlArgs].join("?");
				}
			}

			return result;
		},
		require : function(deps, callback){
			if (_.typeis(deps, "string")){
				var id = deps;
				var m = this.loadScriptSync(id);
				return m;

			} else if (_.typeis(deps, "array")){
				var resolvedDeps = this.resolveDeps(deps);
				if (_.typeis(callback, "function")){
					resolvedDeps.then(function(resolvedDeps){
						callback.apply(window, resolvedDeps);
					});
				}

				return resolvedDeps;
			}

			
		},
		define : function(name, deps, factory){
			var id = this.activeScriptId;

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
				this.registerModule(id, this.promise(function(resolve, reject){

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
			return this.promise(function(resolve, reject){
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
			return this.promise(function(resolve, reject){
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

	return Quire;    
}));

