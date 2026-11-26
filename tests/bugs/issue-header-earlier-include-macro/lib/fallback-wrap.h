#ifndef FALLBACK_WRAP_H
#define FALLBACK_WRAP_H
/* the config picks main-impl.h: fallback-impl.h, C++ only, is never opened */
#ifdef USE_MAIN_IMPL
#define FALLBACK_IMPL "main-impl.h"
#else
#define FALLBACK_IMPL "fallback-impl.h"
#endif
#include FALLBACK_IMPL
#endif
