function f(x,y) {
    return x + y;
}

var g = f.bind(null,3);

console.log(g(10));
console.log(g(20));
