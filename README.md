About jsnap
===========
**jsnap** dumps the state of a JavaScript program after executing the top-level code, but before entering the event loop. This state can then be analyzed by other tools.

jsnap is under development and is **not currently functional**!

State Dump Format
================

A state dump is a JSON object, described in the following paragraphs.

A ''value'' in the heap dump satisfies the type:


    type Value = 
      string | number | boolean | undefined | null | { key: number }


That is, all primitive JavaScript values are encoded directly, while objects are indirectly referenced using a numerical key (wrapped inside an object for unambiguity). Function objects are treated like objects in this regard.

Objects in the heap are encoded in the following way:

    type Obj = {
      function?: UserFunc | NativeFunc
      env?: Value
      prototype?: Value
      properties: Array[Property]
    }
    type Property = {
      name: string
      writeable: boolean
      configurable: boolean
      enumerable: boolean
      value?: Value
      get?: Value
      set?: Value
    }
    type UserFunc = {
        type: 'user'
        id: number
    }
    type NativeFunc = {
        type: 'native'
        id: string
    }


The `Property` type corresponds to what you would get from `getOwnPropertyDescriptor`, except with the additional `name` property. The properties occur in the same order as returned by `getOwnPropertyNames`.

An object is a function if and only if it has a `function` property. For user-defined properties, value of `function.id` is a number indicating which function expression (or declaration) was used to create it. Functions are numbered by the order in which they occur in the source code, starting with 1 (so we can use 0 to refer to the top-level, although this is never occurs in a heap dump). For native functions, `function.id` is either a string denoting an access path to that native, e.g. `"String.prototype.substring"`.

The `env` property is used to refer to the *enclosing environment object*. Function objects and environment objects have such a link. For functions, it refers to the environment object that was active when the function was created (binding the free variables of the function). Environment objects also have an `env` property, which refers to the environment object one scope further up.

The `prototype` property refers to the value of the internal prototype link. This property is absent for environment objects; all plain JavaScript objects have the property, although it may have the value `null`.

A state dump consists of a heap and the key identifying the global object:

    type StateDump = {
      global: number
      heap: Array[Obj]
    }
    
The heap is a mapping from keys to objects, represented by an array. Keys should therefore be condensed close to 0, although any number of entries in the array may be null, for unused keys. The `global` property is the key of the global object.

How it Works
============
jsnap instruments the target JavaScript program so that it outputs its own state at the end of its top-level.

JavaScript has reflective capabilities that lets us explore the object graph, although the state of a function object is tricky to capture. Given a function object, it is not generally possible to inspect the free variables of this function (i.e. variables defined in enclosing functions). 
The instrumentation rewrites local variables so they reside inside explicit "environment objects" that we can look at when dumping the state.

For example:
```javascript
function f(x) {
    return function(y) { 
        return x + y;
    }
}
var g = f(5)
```
Given a reference `g`, it is not possible to tell that `x` is bound 5.
The above code function will therefore be re-written to something like this:
```javascript
function f(x) {
    var env1 = {}
    env1.x = x;
    var inner = function(y) { 
        var env2 = { env: env1 }
        env2.y = y;
        return env1.x + env2.y;
    }
    inner.env = env1;
    return inner;
}
var g = f(5)
```
Given a reference to `g`, one can now inspect `g.env` to look at the enclosing variables, and see that `x` is 5.