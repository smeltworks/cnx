#ifndef CPP_PW_HPP
#define CPP_PW_HPP
#include <stdint.h>
// The writer first: `put(x, 2)` is written `put(&x, 2)` and reaches it
class Pw {
public:
    int32_t calls;
    void put(int32_t* out, int32_t n = 0) { *out = 40 + n; calls = calls + 1; }
    void put(int32_t v, int32_t n) { calls = calls + 10 + v + n; }
};
// The by-value overload first: `put(x, 2)` reaches it, `put(x)` only the writer
class Rv {
public:
    int32_t calls;
    void put(int32_t v, int32_t n) { calls = calls + 10 + v + n; }
    void put(int32_t* out, int32_t n = 0) { *out = 40 + n; calls = calls + 1; }
};
#endif
