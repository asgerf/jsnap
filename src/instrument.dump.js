(function() {
    
    var window = this;
    var undefined;
    
    var _hasOwnProperty = {}.hasOwnProperty;
    function hasPrty(obj, x) {
        return _hasOwnProperty.call(obj,x);
    }
    
    var immutableObjectKeys = [];
    var immutableObjects = [];
    var nextKey = 1;
    function lookupImmutableObj(obj) {
        var len = immutableObjects.length;
        for (var i=0; i<len; ++i) {
            if (immutableObjects[i] === obj)
                return immutableObjectKeys[i];
        }
        var key = nextKey++;
        immutableObjects.push(obj)
        immutableObjectKeys.push(key)
        return key;
    }
    function getKey(obj) {
        if (!hasPrty(obj, "__$__key")) {
            obj.__$__key = nextKey;
            if (!hasPrty(obj, '__$__key'))
                return lookupImmutableObj(obj); // immutable object; we have to use slow lookup
            nextKey += 1;
        }
        return obj.__$__key;
    }
    
    var worklist = [];
    var heap = [];
    
    function enqueue(obj) {
        if (hasPrty(obj, "__$__visited")) {
            return;
        }
        obj.__$__visited = true
        worklist.push(obj)
    }
    
    function dump(obj) {
        var key = getKey(obj);
        if (key === null)
            return;
        var objDump = heap[key] = { properties: [] }
        var props = Object.getOwnPropertyNames(obj)
        for (var i=0; i<props.length; i++) {
            var prop = props[i];
            if (prop.substring(0,5) === '__$__')
                continue;
            if (prop === '__proto__')
                continue;
            try {
                var desc = Object.getOwnPropertyDescriptor(obj, prop)
            } catch (e) {
                continue; // skip if WebKit security gets angry
            }
            if (!desc)
                continue; // happens to strange objects sometimes
            var descDump = {
                name: prop,
                writable: desc.writable,
                enumerable: desc.enumerable,
                configurable: desc.configurable
            }
            if (hasPrty(desc,'get')) {
                descDump.get = convertValue(desc.get)
            }
            if (hasPrty(desc, 'set')) {
                descDump.set = convertValue(desc.set)
            }
            if (hasPrty(desc,'value')) {
                descDump.value = convertValue(desc.value)
            }
            objDump.properties.push(descDump)
        }
        if (!hasPrty(obj, '__$__isEnv')) {
            objDump.prototype = convertValue(Object.getPrototypeOf(obj));
        }
        if (hasPrty(obj, '__$__env') && obj.__$__env !== window) {
            obj.__$__env.__$__isEnv = true;
            objDump.env = convertValue(obj.__$__env);
        }
        if (hasPrty(obj, '__$__fun') && typeof obj.__$__fun !== 'undefined') {
            objDump.function = convertFun(obj.__$__fun);
        } else if (typeof obj === 'function') {
            objDump.function = {type:'unknown'}
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
                var key = getKey(value)
                if (key === null)
                    return null; // not really correct, but what can you do
                return {key: key}
        }
    }
    function convertFun(fun) {
        switch (fun.type) {
            case 'user':
            case 'native':
            case 'unknown':
                return fun;
            case 'bind':
                fun.target = convertValue(fun.target)
                fun.arguments = fun.arguments.map(convertValue)
                return fun;
        }
        throw new Error("Unknown function ID type: " + fun.type)
    }
    
    enqueue(window);
    while (worklist.length > 0) {
        dump(worklist.pop());
    }
    
    var output = {
        global: getKey(window),
        heap: heap
    }
    
    __$__print(JSON.stringify(output));
    
    // if (process && process.exit) {
    //     process.exit();
    // }
    
})();