#ifndef CSTRING_CALLBACK_CHECKS_H
#define CSTRING_CALLBACK_CHECKS_H
#include <stdint.h>
extern const char* texts_name(void);
extern uint32_t (*g_count)(uint32_t);
extern uint32_t (*g_counts[2])(uint32_t);
extern uint32_t (*g_put)(char* text);
extern uint32_t (*g_puts[2])(char* text);
extern uint32_t (*g_show)(const char* text);
/* A macro named like `char const` run together is its expansion, char */
#define charconst char
extern uint32_t (*g_macro)(charconst* text);
extern uint32_t (*g_east)(char const* text);
typedef uint32_t (*east_fn)(char const* text);
extern east_fn t_east;
extern void (*g_done)(uint32_t);
#endif
