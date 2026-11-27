#ifndef SCOPED_H
#define SCOPED_H
#include <stdint.h>
/* data's bound reads the struct's own SLOT_N (3) in C and C++ alike, not the
   later macro (8) */
typedef struct {
    enum { SLOT_N = 3 } kind;
    uint8_t data[SLOT_N];
} slot_t;
#define SLOT_N 8
static slot_t slot;
#endif
