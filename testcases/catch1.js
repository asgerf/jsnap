function f(x) {
    try {
        throw x;
    } catch (e) {
        return function() {
            return e;
        }
    }
    throw "FAIL";
}
console.log(f(5)());
console.log(f(7)());
