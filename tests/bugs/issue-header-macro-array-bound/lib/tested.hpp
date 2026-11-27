#ifndef TESTED_HPP
#define TESTED_HPP
#include <stdint.h>
int probe();
/* C++ reads the function: its address is never null, so the bound is 1 + 2 */
static uint8_t tested[(probe && 1) + 2];
#define probe 0
#endif
