#ifndef GENERATED_BUFFER_H
#define GENERATED_BUFFER_H
#include <stdint.h>
#define DECLARE_BUFFER(name) extern uint8_t name[6];
#ifdef SENSOR_WIDE
DECLARE_BUFFER(generated)
#endif
#endif
