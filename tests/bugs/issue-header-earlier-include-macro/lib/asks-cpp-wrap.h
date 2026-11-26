#ifndef ASKS_CPP_WRAP_H
#define ASKS_CPP_WRAP_H
/* After asks-cpp-config.h, C cannot preprocess this header: the C unit drops it */
#if defined(ASKS_FOR_CPP) && !defined(__cplusplus)
#error "asks-cpp-config.h asks for C++"
#endif
#include "asks-cpp-nested.hpp"
#endif
