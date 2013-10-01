function f() {
    function g() {
        return 5;
    }
    function h() {
        return g();
    }
    return g();
}

console.log(f());
