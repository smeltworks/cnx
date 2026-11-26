#ifndef TABLE_OUTER_HPP
#define TABLE_OUTER_HPP
#include <stdint.h>
#ifdef TABLE_NESTED
#include "table-nested.hpp"
#else
extern uint8_t local_rows[2];
#endif
#endif
