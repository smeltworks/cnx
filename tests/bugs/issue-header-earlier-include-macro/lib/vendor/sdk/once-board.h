#pragma once
#include <stdint.h>
#ifdef ONCE_WIDE
extern uint8_t once_pins[8];
#else
class OncePins {
public:
    int count;
};
extern uint8_t once_pins[4];
#endif
