#ifndef TWICE_H
#define TWICE_H
#include <stdint.h>
#define TWICE 4
static uint8_t twice[TWICE];
typedef struct {
    uint32_t mode : TWICE;
} twice_reg_t;
/* The same body again: C reads 4 either side of it */
#define TWICE 4
#endif
