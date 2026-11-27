#ifndef LANES_A_H
#define LANES_A_H
#include <stdint.h>
#define LANES_A 2
typedef struct {
    uint8_t d[LANES_A];
} lanes_t;
static lanes_t laneA;
#endif
