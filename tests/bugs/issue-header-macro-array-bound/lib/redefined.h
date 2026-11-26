#ifndef REDEFINED_H
#define REDEFINED_H
#include <stdint.h>
#define SLOTS 3
static uint8_t slots[SLOTS];
/* C sized slots with 3; cnx sees only the last SLOTS, 8 */
#undef SLOTS
#define SLOTS 8
#endif
