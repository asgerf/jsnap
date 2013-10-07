function f() {
    var foo = 12, bar = 13;
    var i;
    foo:
    for (i=0; i<10; i++) {
        bar:
        for (var j=0; j<5; j++) {
            break foo;
        }
    }
    return i;
}
console.log(f());
