#ifndef COUNTED_BUFFER_H
#define COUNTED_BUFFER_H
#include <stdint.h>
#define SENSOR_COUNT 3
extern uint8_t table[SENSOR_COUNT];
#ifdef SENSOR_WIDE
extern uint8_t wide_samples[8];
#else
extern uint8_t wide_samples[4];
#endif
#endif
