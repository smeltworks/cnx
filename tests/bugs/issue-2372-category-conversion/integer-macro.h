#ifndef ISSUE_2372_INTEGER_MACRO_H
#define ISSUE_2372_INTEGER_MACRO_H
#define MODE 2
#define ON_FLAG 1
#define READY (1 && 1)
#define EITHER (MODE || ON_FLAG)
#define COUNT ((MODE && ON_FLAG) + 1)
#define READY_ALIAS READY
#endif
