#ifndef SHADOWED_H
#define SHADOWED_H
#include <stdint.h>
enum { SHADOW_COUNT = 3, SHADOW_BITS = 3 };
static uint8_t shadowed[SHADOW_COUNT];
typedef struct {
    uint32_t mode : SHADOW_BITS;
} SReg;
/* C sized both with the enumerators, 3; cnx's macro dump holds only these */
#define SHADOW_COUNT 8
#define SHADOW_BITS 8
#endif
