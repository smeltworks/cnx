#ifndef ISSUE_1114_FIELDS_H
#define ISSUE_1114_FIELDS_H
#include <stdbool.h>
typedef struct {
    unsigned char f;
    unsigned char arr[4];
    bool flag;
    char c;
    char name[4];
    unsigned int one : 1;
    unsigned int three : 3;
} CFields;
extern CFields cs;
#endif
