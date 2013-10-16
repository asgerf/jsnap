function f(x,y) {
    return {
        get a() { return x; },
        set a(v) { x = v },
        set b(v) { return y; },
        get b() { },
        get c() {},
        set d(v) {},
        get e() {}
    }
}

