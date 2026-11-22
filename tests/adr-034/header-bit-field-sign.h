#ifndef HEADER_BIT_FIELD_SIGN_H
#define HEADER_BIT_FIELD_SIGN_H

#include <stdint.h>

typedef int plain_t;
typedef signed int s32_t;

typedef struct {
    int pi : 3;
    short ps : 3;
    long pl : 3;
    char pc : 3;
    int32_t fixed : 3;
    plain_t alias : 3;
    signed int si : 3;
    signed sb : 3;
    s32_t salias : 3;
    unsigned int ui : 3;
    uint32_t u32 : 3;
    int whole;
} SReg;

#endif
