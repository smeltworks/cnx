#ifndef CONFIGURED_TRAILING_H
#define CONFIGURED_TRAILING_H
#include <stdint.h>
#if CONFIGURED == 1
extern uint8_t samples[8];
#else
extern uint8_t samples[4];
#endif
extern uint8_t samples[];
#endif
