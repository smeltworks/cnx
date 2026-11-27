#ifndef CONFIGURED_SAMPLES_H
#define CONFIGURED_SAMPLES_H
#include <stdint.h>
extern uint8_t samples[];
#if CONFIGURED == 1
extern uint8_t samples[8];
#else
extern uint8_t samples[4];
#endif
#endif
