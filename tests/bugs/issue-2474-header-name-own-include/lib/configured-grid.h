#ifndef CONFIGURED_GRID_H
#define CONFIGURED_GRID_H
#include <stdint.h>
extern uint8_t grid[][3];
#if CONFIGURED == 1
extern uint8_t grid[4][3];
#else
extern uint8_t grid[2][3];
#endif
#endif
