#ifndef A_STRUCT_H
#define A_STRUCT_H
#include <stdint.h>
typedef struct {
    volatile uint32_t count;
} Counter;
typedef struct {
    uint8_t data[4];
} Frame;
static Counter counter;
static Frame frame;
#endif
