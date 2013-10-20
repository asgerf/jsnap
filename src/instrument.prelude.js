(function(options) {
    var window = this;
        
    // hijack some of the native functions
    var _String = String;
    var _Object = Object;
    var _ArrayProto = Array.prototype;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    var getOwnPropertyNames = Object.getOwnPropertyNames;
    var preventExtensions = Object.preventExtensions;
    var seal = Object.seal;
    var freeze = Object.freeze;
    var defineProperty = Object.defineProperty;
    
    var indexOf = Array.prototype.indexOf;
    var splice = Array.prototype.splice;
    var join = Array.prototype.join;
    var push = Array.prototype.push;
    
    var _bind = Function.prototype.bind;
    function defineHiddenProperty(obj, prop, val) {
        defineProperty.call(_Object, obj, prop, 
            {   enumerable: false,
                configurable: false,
                writable: false,
                value: val });
    }
    
    function toArray(x) {
        return Array.prototype.slice.call(x, 0);
    }
    
    // ensure synchronous logging in node.js
    if (options.runtime === 'node') {
        var _fs = require('fs')
        console.log = function(msg) {
            var buf = new Buffer(String(msg) + '\n', 'utf8')
            _fs.writeSync(process.stdout.fd, buf, 0, buf.length, process.stdout.pos)
        }
    }
    
    var _log = console.log
    defineHiddenProperty(window, "__$__print", function(x) {
        _log.call(console, x)
    })
    
    if (options.silent) {
        console.log = function() {}
    }
    
    Function.prototype.bind = function() {
        var f = _bind.apply(this, arguments);
        defineHiddenProperty(f, "__$__fun", {type:'bind', target:this, arguments:toArray(arguments)})
        return f;
    }
    
    // hide the injected properties (anything starting with __$__)
    Object.getOwnPropertyNames = function(o) {
        var array = getOwnPropertyNames.call(_Object,o);
        return array.filter(function (x) {
            return x.substring(0,5) !== "__$__";
        });
    }
    
    defineHiddenProperty(Function.prototype, "__$__initFunction", function(env,id) {
        defineHiddenProperty(this, "__$__env", env);
        defineHiddenProperty(this, "__$__fun", {type:'user', id:id});
        return this;
    });
        
    defineHiddenProperty(Object.prototype, "__$__initObject", function(env,ids) {
        var obj = this;
        var names = getOwnPropertyNames.call(_Object, obj);
        var idIdx = 0;
        for (var k=0; k<names.length; k++) {
            var name = names[k];
            var desc = getOwnPropertyDescriptor.call(_Object, obj, name); //getOwnPropertyDescriptor.call(obj, name);
            if (desc.get) {
                defineHiddenProperty(desc.get, "__$__env", env)
                defineHiddenProperty(desc.get, "__$__fun", {type:'user', id:ids[idIdx++]})
            }
            if (desc.set) {
                defineHiddenProperty(desc.set, "__$__env", env)
                defineHiddenProperty(desc.set, "__$__fun", {type:'user', id:ids[idIdx++]})
            }
        }
        return this;
    });
        
    defineHiddenProperty(window, "__$__id", function(x) {
        return x;
    });
        
    defineHiddenProperty(window, "__$__env0", window);
    
    function instrumentNatives(names) {
        names.forEach(function(name) {
            var tokens = name.split('.')
            var obj = window;
            var m;
            for (var i=0; i<tokens.length; i++) {
                var token = tokens[i]
                if (m = token.match(/require\('(.*)'\)/)) {
                    obj = require(m[1])
                }
                else if (m = token.match(/(.*)#(get|set)/)) {
                    var desc = Object.getOwnPropertyDescriptor(obj, m[1])
                    obj = m[2] === 'get' ? desc.get : desc.set;
                }
                else if (token === '__proto__') {
                    obj = Object.getPrototypeOf(obj)
                }
                else {
                    obj = obj[token]
                }
            }
//            if (!obj) {
//                _log.call(console, "Invalid native: " + name)
//            }
            if (obj.hasOwnProperty("__$__fun")) {
                _log.call(console, "Duplicate native: " + name + " vs " + obj.__$__fun.id)
            }
            defineHiddenProperty(obj, "__$__fun", {type:'native', id:name})
        })
    }
    
    instrumentNatives(options.natives)
    
        
})(%ARGS%);
