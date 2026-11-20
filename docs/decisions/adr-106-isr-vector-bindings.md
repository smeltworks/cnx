# ADR-106: ISR Vector Table Bindings

**Status:** Research
**Date:** 2026-01-07
**Decision Makers:** cnx Language Design Team
**Parent ADR:** [ADR-009: ISR Safety](adr-009-isr-safety.md)

## Context

When an interrupt fires on ARM Cortex-M, the CPU reads a function pointer from the **vector table** - a memory-mapped array of addresses. The key insight is that **the vector table is just another hardware register** with chip-specific addresses defined in the datasheet.

cnx's register binding system (ADR-004) is designed exactly for this: platform-specific memory-mapped definitions. This ADR explores treating ISR vector tables as register bindings.

### The Hardware Mechanism

```
1. Hardware event (UART byte received)
         ↓
2. Peripheral sets interrupt pending flag in NVIC
         ↓
3. CPU looks up IRQ number (e.g., 20 for LPUART1 on IMXRT1062)
         ↓
4. CPU reads address from: VECTOR_TABLE_BASE + (IRQ + 16) × 4
         ↓
5. CPU jumps to that address (your ISR)
```

The "+16" accounts for the 16 ARM exception vectors (Reset, NMI, HardFault, etc.) that precede the vendor-specific IRQs.

### Platform Variation

Each chip family has different IRQ assignments:

| Peripheral | STM32F446 IRQ | IMXRT1062 (Teensy 4) IRQ |
| ---------- | ------------- | ------------------------ |
| UART1      | 37            | 20 (LPUART1)             |
| CAN1       | 20            | 36                       |
| SPI1       | 35            | 32 (LPSPI1)              |
| Timer      | 28 (TIM2)     | Various (GPT, PIT, etc.) |

This is why **register definitions are never portable MCU to MCU** - each platform needs its own definitions.

---

## Proposed Design

### Register Binding for Vector Table

Treat the vector table as a register with ISR-typed fields:

```cnx
// Platform: Teensy 4.1 (IMXRT1062)
// Vector table is in RAM at 0x20000000 (copied at startup)
#ifdef TEENSY41

register VectorTableLayout {
    // ARM Exceptions (0-15)
    0x00 ro u32 StackPointer,
    0x04 ro ISR Reset,
    0x08 rw ISR NMI,
    0x0C rw ISR HardFault,
    0x10 rw ISR MemManage,
    0x14 rw ISR BusFault,
    0x18 rw ISR UsageFault,
    // Reserved 0x1C - 0x2B
    0x2C rw ISR SVCall,
    0x30 rw ISR DebugMonitor,
    // Reserved 0x34
    0x38 rw ISR PendSV,
    0x3C rw ISR SysTick,

    // Vendor IRQs (16+) - IMXRT1062 specific
    // Offset = (16 + IRQ_NUMBER) × 4
    0x40 rw ISR DMA_CH0,   // IRQ 0
    0x44 rw ISR DMA_CH1,   // IRQ 1
    // ... DMA channels 2-15 ...
    0x80 rw ISR DMA_ERROR,   // IRQ 16
    0x90 rw ISR LPUART1,   // IRQ 20
    0x94 rw ISR LPUART2,   // IRQ 21
    0x98 rw ISR LPUART3,   // IRQ 22
    0x9C rw ISR LPUART4,   // IRQ 23
    0xA0 rw ISR LPUART5,   // IRQ 24
    0xA4 rw ISR LPUART6,   // IRQ 25
    0xA8 rw ISR LPUART7,   // IRQ 26
    0xAC rw ISR LPUART8,   // IRQ 27
    0xB0 rw ISR LPI2C1,   // IRQ 28
    0xB4 rw ISR LPI2C2,   // IRQ 29
    0xB8 rw ISR LPI2C3,   // IRQ 30
    0xBC rw ISR LPI2C4,   // IRQ 31
    0xC0 rw ISR LPSPI1,   // IRQ 32
    0xC4 rw ISR LPSPI2,   // IRQ 33
    0xC8 rw ISR LPSPI3,   // IRQ 34
    0xCC rw ISR LPSPI4,   // IRQ 35
    0xD0 rw ISR CAN1,   // IRQ 36
    0xD4 rw ISR CAN2,   // IRQ 37
    // ... continues to IRQ 159 ...
    0x2B4 rw ISR GPIO6789,  // IRQ 157 (high-speed GPIO)
}

VectorTableLayout VectorTable(0x20000000);

// NVIC Interrupt Set-Enable Registers
register NVIC_Type {
    0x00 rw u32 ISER0,   // Enable IRQs 0-31
    0x04 rw u32 ISER1,   // Enable IRQs 32-63
    0x08 rw u32 ISER2,   // Enable IRQs 64-95
    0x0C rw u32 ISER3,   // Enable IRQs 96-127
    0x10 rw u32 ISER4,   // Enable IRQs 128-159
}

NVIC_Type NVIC(0xE000E100);

#endif // TEENSY41
```

### User Code

```cnx
#include "teensy41.cnx"  // Platform-specific registers

void myUartHandler() {
    // Handle LPUART1 interrupt
    u8 data <- LPUART1.DATA;
    // ...
}

void setup() {
    // Assign ISR to vector table
    VectorTable.LPUART1 <- myUartHandler;

    // Enable IRQ 20 in NVIC (bit 20 in ISER0)
    NVIC.ISER0 <- (1 << 20);
}
```

### Generated C Code

```c
void myUartHandler(void) {
    uint8_t data = LPUART1_DATA;
    // ...
}

void setup(void) {
    // Vector table write (RAM-based on Teensy)
    ((void(**)(void))0x20000000)[16 + 20] = myUartHandler;

    // NVIC enable
    (*(volatile uint32_t*)0xE000E100) = (1 << 20);
}
```

---

## Platform Considerations

### Flash vs RAM Vector Tables

| Platform          | Vector Table     | Writable at Runtime? | cnx Strategy                  |
| ----------------- | ---------------- | -------------------- | ----------------------------- |
| Teensy 4.x        | RAM (0x20000000) | Yes                  | Direct write via register     |
| STM32 (default)   | Flash            | No                   | Link-time binding (see below) |
| STM32 (relocated) | RAM              | Yes                  | Direct write via register     |
| Cortex-M0         | Flash only       | No                   | Link-time binding only        |

### Link-Time Binding for Flash Tables

For platforms where the vector table is in Flash, cnx could support a `link` access modifier:

```cnx
// STM32F4 - vector table in Flash
register VectorTableLayout {
    USART1:           ISR  link @ 0xD4,   // IRQ 37
}

VectorTableLayout VectorTable(0x08000000);

// This assignment:
VectorTable.USART1 <- myHandler;

// Generates a function with the CMSIS handler name:
void USART1_IRQHandler(void) {
    myHandler();  // Or inlines the body
}
// Linker places it in vector table via weak symbol override
```

The `link` modifier indicates "resolved at link time, not runtime."

---

## Open Questions

### Q1: Platform Definition Files

How should platform-specific register definitions be distributed?

**Options:**

- A) Built into cnx compiler (requires updates for new chips)
- B) External `.cnx` header files (community-maintained)
- C) Generated from vendor SVD/CMSIS-SVD files (automated)

### Q2: IRQ Number Calculation

Should cnx support computed offsets?

```cnx
// Option A: Explicit offset for each IRQ
LPUART1:          ISR  rw @ 0x90,   // (16+20)*4 = 0x90

// Option B: Computed from IRQ number
LPUART1:          ISR  rw @ irq(20),   // Compiler computes (16+20)*4
```

### Q3: NVIC Enable Integration

Should assigning an ISR automatically enable the IRQ?

```cnx
// Option A: Explicit (current)
VectorTable.LPUART1 <- myHandler;
NVIC.ISER0 <- (1 << 20);

// Option B: Automatic
VectorTable.LPUART1 <- myHandler;  // Also enables IRQ

// Option C: Combined syntax
VectorTable.LPUART1.enable <- myHandler;
```

### Q4: Priority Configuration

How should interrupt priorities be set?

```cnx
// NVIC Interrupt Priority Registers
register NvicPriority {
    0x00 rw u32 IPR0,   // Priorities for IRQs 0-3
    0x04 rw u32 IPR1,   // Priorities for IRQs 4-7
    // ...
}

NvicPriority NVIC_IPR(0xE000E400);

// Possible syntax?
VectorTable.LPUART1.priority <- 64;  // Lower = higher priority
```

### Q5: Link-Time vs Runtime Detection

Can cnx detect whether the vector table is writable and choose the appropriate strategy automatically?

---

## Teensy 4.1 IRQ Reference

From [imxrt.h](https://github.com/PaulStoffregen/cores/blob/master/teensy4/imxrt.h):

| IRQ   | Name       | Offset      | Description       |
| ----- | ---------- | ----------- | ----------------- |
| 0-15  | DMA_CH0-15 | 0x40-0x7C   | DMA channels      |
| 16    | DMA_ERROR  | 0x80        | DMA error         |
| 20-27 | LPUART1-8  | 0x90-0xAC   | Low-power UART    |
| 28-31 | LPI2C1-4   | 0xB0-0xBC   | Low-power I2C     |
| 32-35 | LPSPI1-4   | 0xC0-0xCC   | Low-power SPI     |
| 36-37 | CAN1-2     | 0xD0-0xD4   | FlexCAN           |
| 80-89 | GPIO1-5    | 0x180-0x1A4 | Slow GPIO (split) |
| 157   | GPIO6789   | 0x2B4       | High-speed GPIO   |

Full list: 160 IRQs (0-159)

---

## Related ADRs

- **ADR-004**: Register Bindings (foundation for this approach)
- **ADR-009**: ISR Safety (parent ADR)
- **ADR-040**: ISR Type (defines `ISR` type for function pointers)
- **ADR-049**: Atomic Types (target configuration mechanism)

---

## References

- [ARM Cortex-M Vector Table](https://developer.arm.com/documentation/107565/latest/Use-case-examples/Generic-Information/What-is-inside-a-program-image-/Vector-table)
- [ARM Cortex-M Startup Code](https://allthingsembedded.com/post/2019-01-03-arm-cortex-m-startup-code-for-c-and-c/)
- [Teensyduino startup.c](https://github.com/PaulStoffregen/cores/blob/master/teensy4/startup.c)
- [IMXRT1062 imxrt.h IRQ definitions](https://github.com/PaulStoffregen/cores/blob/master/teensy4/imxrt.h)
- [PJRC attachInterruptVector](https://forum.pjrc.com/index.php?threads/attachinterruptvector-with-teensy-4-0.58544/)
- [IMXRT1060 Reference Manual](https://www.pjrc.com/teensy/IMXRT1060RM_rev3.pdf) (IRQ table starts page 44)
