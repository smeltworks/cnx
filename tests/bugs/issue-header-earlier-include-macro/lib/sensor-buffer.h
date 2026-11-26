#ifndef SENSOR_BUFFER_H
#define SENSOR_BUFFER_H
#include <stdint.h>
#ifdef SENSOR_WIDE
extern uint8_t samples[8];
#else
extern uint8_t samples[4];
#endif
#endif
