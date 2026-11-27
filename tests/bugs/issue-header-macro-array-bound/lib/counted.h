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
typedef uint8_t buf_t[SENSOR_COUNT];
static buf_t typed;
/* an enum tag inside a struct names no value: lanes is the array */
typedef struct {
    enum lanes { LANE_A, LANE_B } which;
} lane_pick_t;
static uint8_t lanes[SENSOR_COUNT];
/* An enum tag sizes nothing either, so KIND_COUNT is the macro's 2 */
enum KIND_COUNT { KIND_ONE };
#define KIND_COUNT 2
static uint8_t kinds[KIND_COUNT];
#endif
