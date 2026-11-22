#ifndef HEADER_BIT_FIELD_WIDTH_H
#define HEADER_BIT_FIELD_WIDTH_H

#include <stdint.h>

#define MODE_BITS 3
#define WIDE_BITS (MODE_BITS * 2 + 1)

typedef struct {
    uint32_t sum : 1 + 2;
    uint32_t mode : MODE_BITS;
    uint32_t wide : WIDE_BITS;
    uint32_t sized : sizeof(uint8_t);
    uint32_t rest : 18;
} WReg;

#endif
