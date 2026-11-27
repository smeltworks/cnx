#ifndef B_STRUCT_H
#define B_STRUCT_H
#include <stdint.h>
typedef struct {
    uint32_t count;
} Counter;
typedef struct {
    uint8_t data[8];
} Frame;
static Counter counter;
static Frame frame;
#endif
