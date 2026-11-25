#ifndef C_OPS_H
#define C_OPS_H
#include <stdint.h>
typedef void (*writer_t)(uint32_t* out);
typedef uint32_t (*reader_t)(uint32_t v);
typedef uint32_t (*loose_t)();
typedef struct {
    writer_t w;
    reader_t r;
    loose_t u;
} COps;
COps make_ops(uint32_t* seed);
#endif
