var global = (function() {return this;})();
function foo() {
    function getThis() {
        return this;
    }
    var z = getThis();
    if (z === global) {
        console.log("OK")
    }
}

foo();
