(function() {
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
    
    function defineHiddenProperty(obj, prop, val) {
        defineProperty.call(_Object, obj, prop, 
            {   enumerable: false,
                configurable: false,
                writable: false,
                value: val });
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
        defineHiddenProperty(this, "__$__fun", id);
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
                defineHiddenProperty(desc.get, "__$__fun", ids[idIdx++])
            }
            if (desc.set) {
                defineHiddenProperty(desc.set, "__$__env", env)
                defineHiddenProperty(desc.set, "__$__fun", ids[idIdx++])
            }
        }
        return this;
    });
        
    defineHiddenProperty(window, "__$__id", function(x) {
        return x;
    });
        
    defineHiddenProperty(window, "__$__env0", window);
        
})();
