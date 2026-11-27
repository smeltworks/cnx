#ifndef RESPELLED_H
#define RESPELLED_H
#include <stdint.h>
#define SPOTS 3
static uint8_t spots[SPOTS];
typedef struct {
    uint32_t mode : SPOTS;
} spot_reg_t;
/* C sized spots and mode with 3; the macro dump holds only this SPOTS, 8 */
#define SPOTS 8
#endif
