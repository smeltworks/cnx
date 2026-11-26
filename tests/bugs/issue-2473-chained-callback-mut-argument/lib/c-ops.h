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
typedef void VOID_T;
VOID_T vf(uint32_t v);
typedef VOID_T (*vcb_t)(uint32_t v);
typedef struct {
    vcb_t cb;
} VOps;
VOps make_vops(void);
#endif
