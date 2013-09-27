(function(window) {
    
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
    };
}

defineHiddenProperty(Function.prototype, "__$__setenv", function(env) {
    this.__$__env = env;
    return this;
});
    
defineHiddenProperty(window, "__$__id", function(x) {
    return x;
});
    
})(this);
