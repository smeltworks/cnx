#ifndef HEADER_BIT_FIELD_WIDTH_H
#define HEADER_BIT_FIELD_WIDTH_H

#include <stdint.h>

#define MODE_BITS 3
#define LOOSE_BITS 1 + 2
#define WIDE_BITS (MODE_BITS * 2 + 1)
#define LATE_BITS 3

typedef struct {
    uint32_t sum : 1 + 2;
    uint32_t five : LOOSE_BITS * 2;
    uint32_t mode : MODE_BITS;
    uint32_t wide : WIDE_BITS;
    uint32_t sized : sizeof(uint8_t);
    uint32_t late : LATE_BITS;
    uint32_t rest : 10;
    uint32_t lit : 010;
    uint32_t paren : (010);
} WReg;

/* C read `late` as 3 bits; cnx sees only the final 8 */
#undef LATE_BITS
#define LATE_BITS 8

#endif
