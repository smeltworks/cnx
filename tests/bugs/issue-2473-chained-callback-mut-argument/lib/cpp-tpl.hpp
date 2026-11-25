#ifndef CPP_TPL_HPP
#define CPP_TPL_HPP
#include <stdint.h>
// g++ calls the void template for a uint32_t: an exact match over a conversion
class Tpl {
public:
    uint32_t hits;
    uint32_t op(uint64_t a) { hits = (uint32_t)a; return hits; }
    template <typename T> void op(T a) { hits = (uint32_t)a + 100U; }
};
// A template of two arguments cannot take a call of one: `t.set(p)` and
// `t.get(a)` reach only the method
class Tw {
public:
    uint32_t v;
    void set(uint32_t* p) { v = *p; }
    template <typename T> void set(T a, T b) { v = (uint32_t)(a + b); }
};
class Tg {
public:
    uint32_t v;
    uint32_t get(uint32_t a) { v = a; return v; }
    template <typename T> void get(T a, T b) { v = (uint32_t)(a + b); }
    uint32_t any(uint32_t a) { v = a; return v; }
    template <typename... T> void any(T... a) { v = 0U; }
};
#endif
