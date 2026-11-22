#ifndef HEADER_BIT_FIELD_H
#define HEADER_BIT_FIELD_H

#include <stdint.h>

typedef struct {
    unsigned int mode : 3;
    unsigned int wide : 12;
    signed int level : 3;
    unsigned int flag : 1;
    unsigned int rest : 13;
    uint32_t count;
} CReg;

#endif
