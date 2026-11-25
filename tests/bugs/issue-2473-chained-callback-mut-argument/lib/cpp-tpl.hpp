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
#endif
