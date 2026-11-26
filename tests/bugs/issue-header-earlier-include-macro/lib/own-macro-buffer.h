#ifndef OWN_MACRO_BUFFER_H
#define OWN_MACRO_BUFFER_H
#include <stdint.h>
#define DECLARE_OWN(name) extern uint8_t name[6];
DECLARE_OWN(own_buffer)
#endif
