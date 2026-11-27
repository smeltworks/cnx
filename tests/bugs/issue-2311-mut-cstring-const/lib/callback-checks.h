#ifndef CSTRING_CALLBACK_CHECKS_H
#define CSTRING_CALLBACK_CHECKS_H
#include <stdint.h>
extern const char* texts_name(void);
extern uint32_t (*g_count)(uint32_t);
extern uint32_t (*g_counts[2])(uint32_t);
extern uint32_t (*g_put)(char* text);
extern uint32_t (*g_puts[2])(char* text);
extern uint32_t (*g_show)(const char* text);
extern void (*g_done)(uint32_t);
#endif
