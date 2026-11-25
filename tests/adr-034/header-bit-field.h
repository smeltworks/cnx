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
    uint_fast8_t fast : 3;
} CReg;

typedef struct {
    CReg reg;
    uint32_t tag;
} COuter;

typedef struct {
    uint8_t data[4];
    CReg regs[2];
} CBank;

typedef struct {
    uint8_t octal[010];
    char name[8];
    char tag[3];
} CNamed;

#endif
