#ifndef LINKED_HPP
#define LINKED_HPP
#include <stdint.h>
/* g++ reads each bound as its enum constant (3), not the later macro (8):
   one declared in an extern "C" block, one behind a single extern "C++" */
extern "C" {
enum { LN = 3 };
}
extern "C++" enum { LM = 3 };
static uint8_t ltable[LN];
static uint8_t mtable[LM];
#define LN 8
#define LM 8
#endif
