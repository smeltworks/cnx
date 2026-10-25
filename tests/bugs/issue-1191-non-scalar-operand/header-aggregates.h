#ifndef HEADER_AGGREGATES_H
#define HEADER_AGGREGATES_H

#include <stdint.h>

typedef struct {
    char name[16];
    uint32_t n;
} rec_t;

typedef struct Dev Dev;

extern char cbuf[16];
extern rec_t grec;

#endif
