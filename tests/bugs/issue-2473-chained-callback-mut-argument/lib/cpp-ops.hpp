#ifndef CPP_OPS_HPP
#define CPP_OPS_HPP
#include <stdint.h>
typedef void Status;
using Done = void;
class Ops {
public:
    int op(int a, int b = 0);
    void op();
    void put(int32_t& out, int32_t n = 0);
    void put();
    int read(void) const;
    Status stop(void);
    Done finish();
    void put(int32_t v, int32_t n);
    template <typename T> void op(T a, T b, T c) {}
};
#endif
