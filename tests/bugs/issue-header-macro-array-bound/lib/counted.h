#ifndef COUNTED_H
#define COUNTED_H
#include <stdint.h>
#define SENSOR_COUNT 3
#define SENSOR_PAIRS (SENSOR_COUNT * 2)
static uint8_t table[SENSOR_COUNT];
static uint8_t pairs[SENSOR_PAIRS];
typedef struct {
    uint8_t data[SENSOR_COUNT + 1];
} frame_t;
static frame_t frame;
#endif
