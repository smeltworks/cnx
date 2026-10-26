#ifndef ISSUE_1114_FIELDS_H
#define ISSUE_1114_FIELDS_H
#include <stdbool.h>
typedef struct {
    unsigned char f;
    unsigned char arr[4];
    bool flag;
} CFields;
extern CFields cs;
#endif
