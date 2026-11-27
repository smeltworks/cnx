#ifndef LANES_B_H
#define LANES_B_H
#include <stdint.h>
/* Another lanes_t, which only lanes-reader.cnx's compile reads */
#define LANES_B 5
typedef struct {
    uint8_t d[LANES_B];
} lanes_t;
static lanes_t laneB;
#endif
