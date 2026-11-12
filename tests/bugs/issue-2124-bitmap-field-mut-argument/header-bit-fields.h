#ifndef HEADER_BIT_FIELDS_H
#define HEADER_BIT_FIELDS_H

#include <stdint.h>

typedef struct {
    uint32_t mode : 3;
    uint32_t count;
} Control;

#endif
