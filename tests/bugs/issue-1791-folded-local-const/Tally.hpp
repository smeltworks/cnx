#ifndef TALLY_HPP
#define TALLY_HPP
#include <stdint.h>
class Tally {
  public:
    uint8_t start;
    Tally(uint8_t s) : start(s) {}
};
#endif
