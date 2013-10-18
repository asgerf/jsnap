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
    var heap = [];
    
    // TODO: identify functions created by Function.prototype.bind
    
    function enqueue(obj) {
        if (obj.hasOwnProperty("__$__visited")) {
            return;
        }
        obj.__$__visited = true
        worklist.push(obj)
    }
    
    function dump(obj) {
        var key = getKey(obj);
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
            if (desc.get) {
                descDump.get = convertValue(desc.get)
            }
            if (desc.set) {
                descDump.set = convertValue(desc.set)
            }
            if (desc.value) {
                descDump.value = convertValue(desc.value)
            }
            objDump.properties.push(descDump)
        }
        if (!obj.__$__isEnv) {
            objDump.prototype = convertValue(Object.getPrototypeOf(obj));
        }
        if (obj.__$__env && obj.__$__env !== window) {
            obj.__$__env.__$__isEnv = true;
            objDump.env = convertValue(obj.__$__env);
        }
        if (typeof obj.__$__functionId !== 'undefined') {
            objDump.function = convertFun(obj.__$__functionId);
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
    function convertFun(fun) {
        switch (fun.type) {
            case 'user':
            case 'native':
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
    
    console.log(JSON.stringify(output));
    
    
})();