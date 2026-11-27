#ifndef WLINKED_HPP
#define WLINKED_HPP
#include <stdint.h>
/* g++ reads each width as its enum constant (3), not the later macro (4):
   one declared in an extern "C" block, one behind a single extern "C++" */
extern "C" {
enum { LW = 3 };
}
extern "C++" enum { MW = 3 };
struct LReg {
    uint32_t mode : LW;
    uint32_t kind : MW;
};
#define LW 4
#define MW 4
extern LReg lreg;
#endif
