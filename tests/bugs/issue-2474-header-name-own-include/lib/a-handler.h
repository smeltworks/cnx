#ifndef A_HANDLER_H
#define A_HANDLER_H
#include <stdint.h>
typedef void (*handler_t)(const uint32_t* v);
void registerA(handler_t h);
#endif
