#ifndef CSTRING_CONST_PLACES_H
#define CSTRING_CONST_PLACES_H
#include <string.h>
#include <stdint.h>
typedef const char* const_text_ptr;
typedef struct { const char* name; int id; } Label;
typedef struct { const char* (*get)(void); int id; } ConstGetter;
static const char* g_label;
static const char* g_labels[2];
static const char* (*g_cmake)(void);
static uint32_t twice(uint32_t x) { return x * 2U; }
typedef uint32_t (*op_fn)(uint32_t);
static uint32_t (*g_op)(uint32_t) = twice;
static op_fn g_top = twice;
static inline uint32_t cmade(void) { return g_cmake ? (uint32_t) strlen(g_cmake()) : 0U; }
static inline uint32_t const_len(const_text_ptr t) { return (uint32_t) strlen(t); }
static inline uint32_t const_call_len(const char* (*make)(void)) { return (uint32_t) strlen(make()); }
static inline uint32_t const_getter_len(const ConstGetter* g) { return (uint32_t) strlen(g->get()); }
static inline uint32_t label_len(void) { return g_label ? (uint32_t) strlen(g_label) : 0U; }
#endif
