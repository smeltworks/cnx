#ifndef CSTRING_CALLBACKS_H
#define CSTRING_CALLBACKS_H
#include <stdint.h>
typedef uint32_t (*op_fn)(uint32_t);
static inline uint32_t twice(uint32_t v) { return v * 2U; }
static inline uint32_t thrice(uint32_t v) { return v * 3U; }
static uint32_t (*g_op)(uint32_t) = twice;
static uint32_t (*g_ops[2])(uint32_t) = { twice, thrice };
static op_fn t_ops[2] = { thrice, twice };
#endif
