#ifndef TABLE_BUFFER_HPP
#define TABLE_BUFFER_HPP
#include <stdint.h>
#ifdef TABLE_WIDE
extern uint8_t table[8];
#else
extern uint8_t table[4];
#endif
#endif
