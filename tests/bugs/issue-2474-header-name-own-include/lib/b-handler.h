#ifndef B_HANDLER_H
#define B_HANDLER_H
#include <stdint.h>
typedef void (*handler_t)(uint32_t* v);
void registerB(handler_t h);
#endif
