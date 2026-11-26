#ifndef BUF_HPP
#define BUF_HPP
#include <stdint.h>
class Buf {
public:
    uint8_t last;
    void fill(uint8_t* p) { last = *p; }
    void fill() { last = 0U; }
};
#endif
