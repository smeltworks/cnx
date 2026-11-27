#ifndef UNIT_REG_H
#define UNIT_REG_H
#include <stdint.h>
#define WIDTH 3
typedef struct {
    uint32_t mode : WIDTH;
} unit_reg_t;
static uint8_t widthTable[WIDTH];
#define SPAN 2
static uint8_t spanTable[SPAN];
#endif
