#ifndef POOL_HPP
#define POOL_HPP
#include <stdint.h>
template <uint32_t Size>
class Pool {
  public:
    uint8_t items[Size];
    uint32_t count;
    Pool() : items(), count(Size) {}
};
#endif
