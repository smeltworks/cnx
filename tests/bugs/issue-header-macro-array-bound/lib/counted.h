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
/* A struct tag cannot size anything, so PAIR_COUNT is the macro's 2 */
struct PAIR_COUNT { uint8_t unused; };
#define PAIR_COUNT 2
static uint8_t duo[PAIR_COUNT];
typedef struct {
    uint32_t two : PAIR_COUNT;
} duo_bits_t;
#endif
