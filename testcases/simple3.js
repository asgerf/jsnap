function f(x) {
    return {
        get x() {
            return x;
        }
    }
}

var obj = f(5);
console.log(obj.x);

obj = f(7);
console.log(obj.x);
