#ifndef HW_GLOBALS_H
#define HW_GLOBALS_H
#include <stdint.h>
extern volatile uint32_t hw_flag;
extern uint32_t hw_plain;
typedef volatile uint32_t reg32_t;
extern reg32_t hw_reg;
typedef uint32_t plain32_t;
extern plain32_t hw_plain_reg;
typedef struct {
    volatile uint32_t status;
    uint32_t config;
} regs_t;
extern regs_t regs;
extern volatile uint32_t hw_arr[4];
extern uint32_t hw_plain_arr[4];
extern regs_t regs_table[2];
typedef struct {
    regs_t regs;
    uint32_t* buffer;
} device_t;
extern volatile device_t device;
#endif
