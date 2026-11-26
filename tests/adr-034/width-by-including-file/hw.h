#ifndef WIDTH_BY_INCLUDING_FILE_HW_H
#define WIDTH_BY_INCLUDING_FILE_HW_H
#include <stdint.h>
#define W 3
typedef struct {
    uint32_t a : W;
} HwReg;
#endif
