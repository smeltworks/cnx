#ifndef B_WIDTH_H
#define B_WIDTH_H
#include <stdint.h>
#define REG_BITS 5
typedef struct {
    uint32_t mode : REG_BITS;
} wreg_t;
static wreg_t breg;
#endif
