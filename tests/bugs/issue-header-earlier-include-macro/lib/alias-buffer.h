#include <stdint.h>
#define DECLARE_ALIASED(name) extern uint8_t name[6];
#define DECLARE DECLARE_ALIASED
#ifdef SENSOR_WIDE
DECLARE(aliased)
#endif
