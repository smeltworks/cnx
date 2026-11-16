// #1402: CppTestClass one header further away -- a file that includes this
// relay reaches the class through two include hops (imported transitive).
#ifndef CPP_TEST_CLASS_RELAY_HPP
#define CPP_TEST_CLASS_RELAY_HPP

#include "CppTestClass.hpp"

#endif
