# ADR-104: ISR-Safe Queues

**Status:** Research
**Date:** 2026-01-03
**Decision Makers:** cnx Language Design Team
**Parent ADR:** [ADR-009: ISR Safety](adr-009-isr-safety.md)

## Context

The most common ISR pattern is producer-consumer: ISR produces data, main loop consumes it (or vice versa). This pattern appears in:

- **CAN bus**: ISR receives messages, main processes them
- **UART**: ISR fills receive buffer, main reads from it
- **Sensors**: ISR captures samples, main analyzes them
- **Timers**: ISR signals events, main handles them

Atomic types (ADR-049) handle single values. Critical sections (ADR-050) handle multi-variable updates. Queues are so common in embedded systems that they may deserve first-class support.

### Related ADRs

- **ADR-009**: Parent ADR covering overall ISR safety strategy
- **ADR-049**: Atomic types (queue indices could use these)
- **ADR-050**: Critical sections (alternative implementation strategy)

---

## Research Findings

### FlexCAN_T4 Queue Pattern

The [FlexCAN_T4 library](https://github.com/tonton81/FlexCAN_T4) demonstrates production queue usage:

```
ISR → [Ring Buffer] → main calls events() → user callback
```

Key characteristics:

- Pre-allocated fixed-size buffers: `FlexCAN_T4<CAN3, RX_SIZE_256, TX_SIZE_16>`
- ISR only enqueues (never blocks)
- Main loop calls `events()` to process
- Single-producer/single-consumer = lock-free

### Lock-Free SPSC Queue Theory

Single-Producer/Single-Consumer (SPSC) queues are lock-free when:

1. Only one context (e.g., ISR) writes to `write_index`
2. Only one context (e.g., main) writes to `read_index`
3. Both contexts can read both indices (for full/empty checks)
4. Indices are naturally atomic (single-word access)

```c
// Classic SPSC ring buffer structure
struct Queue {
    T buffer[SIZE];
    volatile uint32_t read_index;   // Only consumer writes
    volatile uint32_t write_index;  // Only producer writes
};
```

**Why this works on Cortex-M:**

- 32-bit aligned index reads are atomic (single LDR)
- 32-bit aligned index writes are atomic (single STR)
- No LDREX/STREX needed because single-writer per index
- No critical sections needed

### MPSC and MPMC Queues

| Queue Type | Lock-Free? | Complexity | Use Case                 |
| ---------- | ---------- | ---------- | ------------------------ |
| SPSC       | Yes        | Simple     | ISR ↔ Main (most common) |
| MPSC       | Possible   | Moderate   | Multiple ISRs → Main     |
| SPMC       | Possible   | Moderate   | Main → Multiple tasks    |
| MPMC       | Complex    | High       | General multi-threading  |

Embedded systems typically only need SPSC for ISR patterns.

### Queue Implementations in Other Languages

**C++ `std::queue` / `boost::lockfree::spsc_queue`:**

```cpp
boost::lockfree::spsc_queue<int, boost::lockfree::capacity<1024>> queue;
queue.push(42);
int value;
queue.pop(value);
```

**Rust `heapless::spsc::Queue`:**

```rust
static mut QUEUE: Queue<u32, 8> = Queue::new();
// Producer
queue.enqueue(42);
// Consumer
if let Some(value) = queue.dequeue() { ... }
```

**FreeRTOS Queues:**

```c
QueueHandle_t queue = xQueueCreate(10, sizeof(uint32_t));
xQueueSendFromISR(queue, &value, &woken);
xQueueReceive(queue, &value, portMAX_DELAY);
```

---

## Design Questions

### Q1: Should Queues Be a Language Feature or Library?

**Option A: Built-in language feature with array-like syntax**

```cnx
queue CAN_Message[32] canRxQueue;
```

- Compiler can optimize
- Consistent with cnx array syntax (`type[size] name`)
- More language complexity

**Option B: Standard library**

```cnx
#include <cnx/queue.h>
Queue canRxQueue <- Queue.create(CAN_Message, 32);
```

- Simpler language
- Can be implemented in cnx itself
- Less optimization opportunity

**Option C: Defer to generated C / external libraries**

- Users use existing C queue libraries
- cnx just ensures ISR-safe access patterns

### Q2: What Queue Types to Support?

| Type | Description                      | Complexity        |
| ---- | -------------------------------- | ----------------- |
| SPSC | Single-producer, single-consumer | Simple, lock-free |
| MPSC | Multi-producer, single-consumer  | Moderate          |
| SPMC | Single-producer, multi-consumer  | Moderate          |
| MPMC | Multi-producer, multi-consumer   | Complex           |

**Sub-question:** Is SPSC sufficient for v1, covering ISR ↔ main patterns?

### Q3: Syntax for Queue Declaration

**Option A: Array-like with qualifier**

```cnx
queue u32[8] myQueue;
queue CAN_Message[32] canQueue;
```

**Option B: Dedicated keyword with capacity**

```cnx
queue(8) u32 myQueue;
queue(32) CAN_Message canQueue;
```

**Option C: Function-style initialization**

```cnx
Queue myQueue <- Queue.create(u32, 8);
```

### Q4: Queue Operations

What operations should be supported?

| Operation    | Description           | Question                     |
| ------------ | --------------------- | ---------------------------- |
| push/enqueue | Add item              | Return bool or void?         |
| pop/dequeue  | Remove item           | Return item or fill pointer? |
| peek         | Read without removing | Needed?                      |
| empty        | Check if empty        | Property or method?          |
| full         | Check if full         | Property or method?          |
| count        | Current item count    | Needed?                      |
| capacity     | Maximum capacity      | Compile-time constant?       |
| clear        | Remove all items      | Safe from ISR?               |

### Q5: Handling Full Queue

When `push` is called on a full queue:

**Option A: Return false, drop the item**

```cnx
if (!queue.push(item)) {
    // Handle overflow
}
```

**Option B: Overwrite oldest item**

```cnx
queue.push_overwrite(item);  // Always succeeds
```

**Option C: Block until space (NOT suitable for ISR)**

**Option D: Panic/trap**

### Q6: Handling Empty Queue

When `pop` is called on an empty queue:

**Option A: Return false, don't modify output**

```cnx
u32 value;
if (queue.pop(value)) {
    // Got item
}
```

**Option B: Return optional type (if ADR-047 implemented)**

```cnx
u32? value <- queue.pop();
if (value?) {
    // Got item
}
```

**Option C: Block until item available (NOT suitable for some contexts)**

### Q7: Type Restrictions

What types can be queue elements?

| Type                       | Allowed? | Notes                                    |
| -------------------------- | -------- | ---------------------------------------- |
| Primitives (u8, u32, etc.) | ?        | Simple copy                              |
| Structs                    | ?        | Copy by value, what about large structs? |
| Arrays                     | ?        | Would need special handling              |
| Strings                    | ?        | Depends on string semantics (ADR-045)    |
| Pointers                   | ?        | Requires pointer support in cnx          |

### Q8: Power-of-Two Optimization

If queue capacity is power of 2, modulo can use bitmask:

```c
next = (index + 1) % 8;   // Division (slow on M0)
next = (index + 1) & 7;   // Bitmask (fast)
```

Should cnx:

- Require power-of-two capacity?
- Optimize when power-of-two, use modulo otherwise?
- Always use modulo (simpler)?

### Q9: Thread/ISR Safety Enforcement

Should the compiler enforce which context can call which operations?

```cnx
// Should this warn or error?
interrupt CAN_RX {
    queue.pop(msg);    // Pop from ISR is unusual
}

void main() {
    queue.push(msg);   // Push from main when ISR is consumer
}
```

Or trust the developer to use correctly?

---

## Open Questions Summary

1. Should queues be a language feature, library, or left to C?
2. Which queue types to support (SPSC only, or also MPSC/MPMC)?
3. What syntax for queue declaration?
4. What operations should queues support?
5. How to handle push on full queue?
6. How to handle pop on empty queue?
7. What types can be queue elements?
8. Should power-of-two capacity be required/optimized?
9. Should compiler enforce ISR-safe usage patterns?

---

## References

- [ADR-009: ISR Safety](adr-009-isr-safety.md) - Parent ADR
- [FlexCAN_T4](https://github.com/tonton81/FlexCAN_T4) - Real-world queue usage
- [Lock-Free SPSC Queue](https://www.codeproject.com/Articles/43510/Lock-Free-Single-Producer-Single-Consumer-Circular)
- [Rust heapless::spsc](https://docs.rs/heapless/latest/heapless/spsc/index.html)
- [FreeRTOS Queues](https://www.freertos.org/Embedded-RTOS-Queues.html)
