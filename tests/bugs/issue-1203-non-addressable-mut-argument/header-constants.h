#ifndef HEADER_CONSTANTS_H
#define HEADER_CONSTANTS_H

#include <stdint.h>

#define LIMIT 5U
#define counterAlias headerCounter
#define STATUS_REG (*(volatile uint32_t *)0x40000000U)

enum Color { COLOR_RED, COLOR_GREEN };
typedef enum { C_MODE_A, C_MODE_B } CMode;
enum { ANON_LIMIT = 4 };

extern uint32_t headerCounter;

#endif
