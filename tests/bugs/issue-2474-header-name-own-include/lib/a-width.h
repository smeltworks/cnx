#ifndef A_WIDTH_H
#define A_WIDTH_H
#include <stdint.h>
#define REG_BITS 3
typedef struct {
    uint32_t mode : REG_BITS;
} wreg_t;
static wreg_t areg;
#endif
