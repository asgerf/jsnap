function foo(x) {
    return function(y) {
        return x + y;
    }
}

console.log(foo(5)(7));
