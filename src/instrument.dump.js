(function() {
    
    var window = this;
    var undefined;
    
    var nextKey = 1;
    function getKey(obj) {
        if (!obj.__$__key) {
            obj.__$__key = nextKey++;
        }
        return obj.__$__key;
    }
    
    var worklist = [];
    var heap = {};
    
    function enqueue(obj) {
        if (obj.__$__visited) {
            return;
        }
        obj.__$__visited = true
        worklist.push(obj)
    }
    
    // TODO: identify function objects in dump
    
    function dump(obj) {
        var key = getKey(obj);
        var objDump = heap[key] = {}
        var props = Object.getOwnPropertyNames(obj)
        for (var i=0; i<props.length; i++) {
            var prop = props[i];
            if (prop.substring(0,5) === '__$__')
                continue;
            if (prop === '__proto__')
                continue;
            var desc = Object.getOwnPropertyDescriptor(obj, prop)
            var descDump = {
                writable: desc.writable,
                enumerable: desc.enumerable,
                configurable: desc.configurable
            }
            if (desc.get) {
                descDump.get = convertValue(desc.get)
            }
            if (desc.set) {
                descDump.set = convertValue(desc.set)
            }
            if (desc.value) {
                descDump.value = convertValue(desc.value)
            }
            objDump[prop] = descDump
        }
        if (!obj.__$__isEnv) {
            objDump.__$__prototype = convertValue(Object.getPrototypeOf(obj));
        }
        if (obj.__$__env && obj.__$__env !== window) {
            obj.__$__env.__$__isEnv = true;
            objDump.__$__env = convertValue(obj.__$__env);
        }
    }
    function convertValue(value) {
        switch (typeof value) {
            case 'undefined':
            case 'null':
            case 'boolean':
            case 'number':
            case 'string':
                return value;
            case 'object':
            case 'function':
                if (value === null)
                    return null;
                enqueue(value)
                return {key: getKey(value)}
        }
    }
    
    enqueue(window);
    while (worklist.length > 0) {
        dump(worklist.pop());
    }
    
    console.log(heap);
    
    
})();