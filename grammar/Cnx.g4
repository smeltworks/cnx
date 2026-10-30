/*
 * cnx grammar
 * A safer C for embedded systems development
 *
 * Key differences from C:
 * - Assignment: <- (not =)
 * - Comparison: = (not ==)
 * - No pointer syntax (* for dereference)
 * - & is read-only (get address, cannot reassign)
 * - Fixed-width types: u8, i32, f64, etc.
 * - scope for organization (ADR-016)
 * - struct for data containers (ADR-014)
 * - register bindings for hardware
 */

grammar Cnx;

// ============================================================================
// Parser Rules
// ============================================================================

// Entry point
program
    : (includeDirective | preprocessorDirective)* declaration* EOF
    ;

// Include directives (passed through to generated C)
// Uses same syntax as C: #include <header.h> or #include "header.h"
includeDirective
    : INCLUDE_DIRECTIVE
    ;

// Preprocessor directives (ADR-037)
// cnx takes a safety-first approach:
// - #define FLAG (no value) - allowed for conditional compilation
// - #define FLAG value - ERROR, must use const
// - #define NAME(args) - ERROR, function macros forbidden
// - #pragma KEY VALUE... - the program's target (ADR-049)
preprocessorDirective
    : defineDirective
    | conditionalDirective
    | pragmaDirective
    ;

defineDirective
    : DEFINE_FLAG          // Flag-only: #define PLATFORM
    | DEFINE_WITH_VALUE    // Error: #define SIZE 256
    | DEFINE_FUNCTION      // Error: #define MAX(a,b) ...
    ;

conditionalDirective
    : IFDEF_DIRECTIVE
    | IFNDEF_DIRECTIVE
    | ELSE_DIRECTIVE
    | ENDIF_DIRECTIVE
    ;

// ADR-049: a pragma is a key and its values, all on one line. The keys are
// `target` and the target description's fields; which keys exist is the
// target schema's business, not the grammar's, so adding a field never
// changes this rule.
pragmaDirective
    : PRAGMA_DIRECTIVE
    ;

// Top-level declarations
declaration
    : scopeDeclaration
    | registerDeclaration
    | structDeclaration
    | enumDeclaration
    | bitmapDeclaration
    | functionDeclaration
    | variableDeclaration
    ;

// ----------------------------------------------------------------------------
// Scope (ADR-016: Organization with visibility control)
// ----------------------------------------------------------------------------
scopeDeclaration
    : 'scope' IDENTIFIER '{' scopeMember* '}'
    ;

scopeMember
    : visibilityModifier? variableDeclaration
    | visibilityModifier? functionDeclaration
    | visibilityModifier? enumDeclaration
    | visibilityModifier? bitmapDeclaration
    | visibilityModifier? registerDeclaration
    | visibilityModifier? structDeclaration
    ;

visibilityModifier
    : 'private'
    | 'public'
    ;

// ----------------------------------------------------------------------------
// Register Bindings (ADR-004: Type-safe hardware access)
// ----------------------------------------------------------------------------
registerDeclaration
    : 'register' IDENTIFIER '@' expression '{' registerMember* '}'
    ;

registerMember
    : IDENTIFIER ':' type accessModifier '@' expression ','?
    ;

accessModifier
    : 'rw'      // Read-Write
    | 'ro'      // Read-Only
    | 'wo'      // Write-Only
    | 'w1c'     // Write-1-to-Clear
    | 'w1s'     // Write-1-to-Set
    ;

// ----------------------------------------------------------------------------
// Struct (ADR-014: Data containers without methods)
// ----------------------------------------------------------------------------
structDeclaration
    : 'struct' IDENTIFIER '{' structMember* '}'
    ;

structMember
    : overflowModifier? type IDENTIFIER arrayDimension* ';'   // ADR-044: a field's own clamp/wrap
    ;

// ----------------------------------------------------------------------------
// Enum (ADR-017: Type-safe enums)
// ----------------------------------------------------------------------------
enumDeclaration
    : 'enum' IDENTIFIER '{' enumMember (',' enumMember)* ','? '}'
    ;

enumMember
    : IDENTIFIER ('<-' expression)?
    ;

// ----------------------------------------------------------------------------
// Bitmap (ADR-034: Portable bit-packed data types)
// ----------------------------------------------------------------------------
bitmapDeclaration
    : bitmapType IDENTIFIER '{' bitmapMember (',' bitmapMember)* ','? '}'
    ;

bitmapType
    : 'bitmap8'     // 8 bits, backed by u8
    | 'bitmap16'    // 16 bits, backed by u16
    | 'bitmap24'    // 24 bits, backed by u32 (3 bytes)
    | 'bitmap32'    // 32 bits, backed by u32
    ;

bitmapMember
    : IDENTIFIER ('[' INTEGER_LITERAL ']')?  // FieldName or FieldName[N]
    ;

// ----------------------------------------------------------------------------
// Functions
// ----------------------------------------------------------------------------
functionDeclaration
    : overflowModifier? type IDENTIFIER '(' parameterList? ')' block   // ADR-044: the result's clamp/wrap
    ;

parameterList
    : parameter (',' parameter)*
    ;

parameter
    : constModifier? mutModifier? type IDENTIFIER arrayDimension*
    ;

// ADR-071 parses `const` only to reject it: read-only is the default
constModifier
    : 'const'
    ;

// ADR-071: a binding that is written is declared `mut`
mutModifier
    : 'mut'
    ;

volatileModifier
    : 'volatile'
    ;

// ADR-044: Overflow behavior modifier
overflowModifier
    : 'clamp'    // Saturating arithmetic (safe default)
    | 'wrap'     // Two's complement wrap (opt-in)
    ;

// ADR-049: Atomic modifier for ISR-safe variables
atomicModifier
    : 'atomic'
    ;

arrayDimension
    : '[' expression? ']'
    ;

// ----------------------------------------------------------------------------
// Variables (ADR-003: Static allocation, ADR-044: Overflow behavior, ADR-049: Atomic)
// ----------------------------------------------------------------------------
variableDeclaration
    : atomicModifier? volatileModifier? constModifier? mutModifier? overflowModifier? type IDENTIFIER arrayDimension* ('<-' expression)? ';'
    | type IDENTIFIER '(' constructorArgumentList ')' ';'   // Issue #375: C++ constructor
    ;

// Issue #375: Constructor argument list - identifiers only (must be const variables)
constructorArgumentList
    : IDENTIFIER (',' IDENTIFIER)*
    ;

// ----------------------------------------------------------------------------
// Statements
// ----------------------------------------------------------------------------
block
    : '{' statement* '}'
    ;

statement
    : variableDeclaration
    | assignmentStatement
    | expressionStatement
    | ifStatement
    | whileStatement
    | doWhileStatement
    | forStatement
    | foreverStatement     // ADR-068: Infinite loops
    | switchStatement
    | returnStatement
    | criticalStatement    // ADR-050: Critical sections
    | block
    ;

// ADR-050: Critical section for atomic multi-variable operations
criticalStatement
    : 'critical' block
    ;

// ADR-001: <- for assignment, with compound assignment operators
assignmentStatement
    : assignmentTarget assignmentOperator expression ';'
    ;

assignmentOperator
    : '<-'      // Simple assignment
    | '+<-'     // Addition assignment
    | '-<-'     // Subtraction assignment
    | '*<-'     // Multiplication assignment
    | '/<-'     // Division assignment
    | '%<-'     // Modulo assignment
    | '&<-'     // Bitwise AND assignment
    | '|<-'     // Bitwise OR assignment
    | '^<-'     // Bitwise XOR assignment
    | '<<<-'    // Left shift assignment
    | '>><-'    // Right shift assignment
    ;

// Assignment target with unified postfix chain approach (Issue #387)
// All patterns use postfixTargetOp* for member/array access chains
assignmentTarget
    : 'global' '.' IDENTIFIER postfixTargetOp*    // global.x, global.x[i][j].y, etc.
    | 'this' '.' IDENTIFIER postfixTargetOp*      // this.x, this.x[i].y, etc.
    | IDENTIFIER postfixTargetOp*                  // x, arr[i], obj.field, arr[i].field, etc.
    ;

// Unified postfix operation for assignment targets (Issue #387)
postfixTargetOp
    : '.' IDENTIFIER                           // Member access
    | '[' expression ']'                       // Array subscript / single bit
    | '[' expression ',' expression ']'        // Bit range [start, width]
    ;

expressionStatement
    : expression ';'
    ;

ifStatement
    : 'if' '(' expression ')' statement ('else' statement)?
    ;

whileStatement
    : 'while' '(' expression ')' statement
    ;

// ADR-027: Do-while with MISRA-compliant boolean condition (E0701)
doWhileStatement
    : 'do' block 'while' '(' expression ')' ';'
    ;

forStatement
    : 'for' '(' forInit? ';' expression? ';' forUpdate? ')' statement
    ;

// ADR-068: Infinite loop. Braces always required (no single-statement form),
// matching switch/scope/critical. Lowers to MISRA-compliant for(;;).
foreverStatement
    : FOREVER block
    ;

// For loop init - uses versions without trailing semicolons
forInit
    : forVarDecl
    | forAssignment
    ;

// Variable declaration without trailing semicolon (for use in for loops)
forVarDecl
    : atomicModifier? volatileModifier? mutModifier? overflowModifier? type IDENTIFIER arrayDimension* ('<-' expression)?
    ;

// Assignment without trailing semicolon (for use in for loops)
forAssignment
    : assignmentTarget assignmentOperator expression
    ;

forUpdate
    : assignmentTarget assignmentOperator expression
    ;

returnStatement
    : 'return' expression? ';'
    ;

// ----------------------------------------------------------------------------
// Switch Statement (ADR-025: Safe switch with MISRA compliance)
// ----------------------------------------------------------------------------
switchStatement
    : 'switch' '(' expression ')' '{' switchCase+ defaultCase? '}'
    ;

switchCase
    : 'case' caseLabel ('||' caseLabel)* block
    ;

// Case labels must be constant expressions (like C)
// No || ambiguity: logical OR isn't valid in constant context
caseLabel
    : qualifiedType      // Enum value: EState.IDLE
    | ('this' | 'global') '.' (qualifiedType | IDENTIFIER)  // ADR-016 rooted: this.LIMIT, this.State.IDLE (#1629, #147)
    | IDENTIFIER         // Const or enum member
    | '-'? INTEGER_LITERAL  // Allow negative integers
    | '-'? HEX_LITERAL      // Allow negative hex (e.g., -0x80)
    | BINARY_LITERAL
    | CHAR_LITERAL
    ;

defaultCase
    : 'default' ('(' INTEGER_LITERAL ')')? block
    ;

// ----------------------------------------------------------------------------
// Expressions
// ----------------------------------------------------------------------------
expression
    : ternaryExpression
    ;

// ADR-022: Ternary with required parentheses, no nesting (semantic check)
ternaryExpression
    : '(' orExpression ')' '?' orExpression ':' orExpression  // Ternary with required parens
    | orExpression                                             // Non-ternary path
    ;

orExpression
    : andExpression ('||' andExpression)*
    ;

andExpression
    : equalityExpression ('&&' equalityExpression)*
    ;

// ADR-001: = for equality comparison (not ==)
equalityExpression
    : relationalExpression (('=' | '!=') relationalExpression)*
    ;

relationalExpression
    : bitwiseOrExpression (('<' | '>' | '<=' | '>=') bitwiseOrExpression)*
    ;

bitwiseOrExpression
    : bitwiseXorExpression ('|' bitwiseXorExpression)*
    ;

bitwiseXorExpression
    : bitwiseAndExpression ('^' bitwiseAndExpression)*
    ;

bitwiseAndExpression
    : shiftExpression ('&' shiftExpression)*
    ;

shiftExpression
    : additiveExpression (('<<' | '>>') additiveExpression)*
    ;

additiveExpression
    : multiplicativeExpression (('+' | '-') multiplicativeExpression)*
    ;

multiplicativeExpression
    : unaryExpression (('*' | '/' | '%') unaryExpression)*
    ;

unaryExpression
    : '!' unaryExpression
    | '-' unaryExpression
    | '~' unaryExpression
    | '&' unaryExpression          // Address-of (read-only, ADR-006)
    | postfixExpression
    ;

postfixExpression
    : primaryExpression postfixOp*
    | primitiveType '.' IDENTIFIER                    // ADR-058: a type's length property, u32.byte_length
    ;

postfixOp
    : '.' IDENTIFIER                           // Member access
    | '[' expression ']'                       // Array subscript / single bit
    | '[' expression ',' expression ']'        // Bit range [start, width]
    | '(' argumentList? ')'                    // Function call
    ;

primaryExpression
    : sizeofExpression                                // ADR-023: recognized only to be rejected (E0603)
    | castExpression
    | structInitializer
    | arrayInitializer                                // ADR-035: array initializers
    | 'this'                                          // ADR-016: scope-local reference
    | 'global'                                        // ADR-016: global reference
    | IDENTIFIER
    | literal
    | '(' expression ')'
    ;

// ADR-023: cnx has no sizeof; a size is ADR-058's .byte_length. The C spelling
// is parsed so that it is rejected with a code (E0603) rather than a parse error.
sizeofExpression
    : 'sizeof' '(' (type | expression) ')'
    ;

// ADR-017: Cast expression for enum to integer conversion
castExpression
    : '(' overflowModifier? type ')' unaryExpression   // ADR-044: `(clamp u16)w` sets the result's clamp/wrap
    ;

// Struct initializer: Point { x: 10, y: 20 } or inferred { x: 10, y: 20 }
// A struct literal takes its type from where it stands (ADR-014).
//
// #1322: an `IDENTIFIER '{' ... '}'` alternative stood here for a written type,
// `Point { x: 10 }`. It was never valid cnx: every position that consumes a
// value already declares a type, so writing it again was rejected as redundant
// in all of them. The one place it parsed was a bare expression statement,
// where it built a compound literal and discarded it -- dead code the grammar
// was keeping alive. Removed on the language owner's decision.
structInitializer
    : '{' fieldInitializerList '}'
    ;

fieldInitializerList
    : fieldInitializer (',' fieldInitializer)* ','?
    ;

fieldInitializer
    : IDENTIFIER ':' expression
    ;

// ADR-035: Array initializers with square brackets
// [1, 2, 3] for explicit values, [0*] for fill-all
arrayInitializer
    : '[' arrayInitializerElement (',' arrayInitializerElement)* ','? ']'  // List: [1, 2, 3]
    | '[' expression '*' ']'                                                // Fill-all: [0*]
    ;

arrayInitializerElement
    : expression
    | structInitializer                              // For struct arrays: [{ x: 1 }, { x: 2 }]
    | arrayInitializer                               // For nested arrays: [[1,2], [3,4]]
    ;

// Note: memberAccess and arrayAccess rules removed - unified into assignmentTarget with postfixTargetOp*

argumentList
    : expression (',' expression)*
    ;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
type
    : primitiveType
    | stringType                              // ADR-045: Bounded strings
    | scopedType                              // ADR-016: this.Type for scoped types
    | globalType                              // Issue #478: global.Type for global types inside scope
    | qualifiedType                           // ADR-016: Scope.Type from outside scope
    | templateType                            // Issue #291: C++ template instantiation syntax
    | userType
    | arrayType
    | 'void'
    ;

// ADR-016: Scoped type reference (this.State -> Motor_State)
scopedType
    : 'this' '.' IDENTIFIER
    ;

// Issue #478: Global type reference (global.ECategory -> ECategory)
// Used inside scopes to reference types defined at global level
globalType
    : 'global' '.' IDENTIFIER
    ;

// ADR-016: Qualified type from outside scope (Motor.State -> Motor_State)
// Issue #388: Extended to support C++ nested namespace types (A.B.C -> A::B::C)
qualifiedType
    : IDENTIFIER ('.' IDENTIFIER)+
    ;

primitiveType
    : 'u8' | 'u16' | 'u32' | 'u64'     // Unsigned integers
    | 'i8' | 'i16' | 'i32' | 'i64'     // Signed integers
    | 'f32' | 'f64'                     // Floating point
    | 'bool'                            // Boolean
    | 'ISR'                             // ADR-040: Interrupt Service Routine function pointer
    ;

userType
    : IDENTIFIER
    ;

// Issue #291: C++ template instantiation syntax
// Allows cnx to parse C++ template types like FlexCAN_T4<CAN1, RX_SIZE_256, TX_SIZE_16>
// Template arguments are passed through unchanged to C++ output
templateType
    : IDENTIFIER '<' templateArgumentList '>'
    ;

templateArgumentList
    : templateArgument (',' templateArgument)*
    ;

// Template arguments can be:
// - Identifiers (type names, constants): CAN1, RX_SIZE_256
// - Primitive types: u32, f64
// - Integer literals: 256, 16
// - Nested templates: Container<Element>
templateArgument
    : templateType                            // Nested template: Pair<int, int>
    | primitiveType                           // Primitive: u32, f64
    | IDENTIFIER                              // Type name or constant: CAN1, MyType
    | INTEGER_LITERAL                         // Size parameter: 256, 16
    ;

// ADR-045: Bounded string type
// string<N> where N is character capacity (not including null terminator)
stringType
    : 'string' '<' INTEGER_LITERAL '>'    // Sized: string<64>
    | 'string'                             // Unsized: for const inference
    ;

// cnx-style array type: dimensions in type position
// Supports: u8[8], u8[4][4], u8[] (unbounded), string<32>[5]
// Also supports scoped/qualified types: this.Type[4], Scope.Type[4], global.Type[4]
arrayType
    : primitiveType arrayTypeDimension+
    | userType arrayTypeDimension+
    | stringType arrayTypeDimension+
    | scopedType arrayTypeDimension+       // this.Type[4] - scoped type array
    | qualifiedType arrayTypeDimension+    // Scope.Type[4] - qualified type array
    | globalType arrayTypeDimension+       // global.Type[4] - global type array
    ;

arrayTypeDimension
    : '[' expression? ']'
    ;

// ----------------------------------------------------------------------------
// Literals (ADR-024: Type suffixes OPTIONAL, validated against target type)
// ----------------------------------------------------------------------------
literal
    : SUFFIXED_DECIMAL      // 42u8, 1000i32 (explicit type)
    | SUFFIXED_HEX          // 0xFFu16 (explicit type)
    | SUFFIXED_BINARY       // 0b1010u8 (explicit type)
    | SUFFIXED_FLOAT        // 3.14f32 (explicit type)
    | INTEGER_LITERAL       // 42 (type inferred from context, validated to fit)
    | HEX_LITERAL           // 0xFF (type inferred from context)
    | BINARY_LITERAL        // 0b1010 (type inferred from context)
    | FLOAT_LITERAL         // 3.14 (type inferred from context)
    | STRING_LITERAL
    | CHAR_LITERAL
    | 'true'
    | 'false'
    | 'NULL'      // ADR-047: C library NULL for interop (no lowercase 'null' - ADR-039)
    ;

// ============================================================================
// Lexer Rules
// ============================================================================

// Preprocessor directives (passed through to C)
// Matches: #include <header.h> or #include "header.h"
INCLUDE_DIRECTIVE
    : '#' [ \t]* 'include' [ \t]* ('<' ~[>\r\n]* '>' | '"' ~["\r\n]* '"')
    ;

// ADR-037: Preprocessor directive tokens
// Order matters: more specific patterns must come first

// Function-like macro (ERROR): #define NAME(
// Must check for '(' before value pattern
DEFINE_FUNCTION
    : '#' [ \t]* 'define' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]* '(' ~[\r\n]*
    ;

// Define with value (ERROR): #define NAME value
// Has content after the identifier
DEFINE_WITH_VALUE
    : '#' [ \t]* 'define' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]+ ~[\r\n]+
    ;

// Flag-only define (OK): #define NAME
// Just the identifier, nothing after (except whitespace/newline)
DEFINE_FLAG
    : '#' [ \t]* 'define' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]*
    ;

// Conditional compilation directives (pass through)
IFDEF_DIRECTIVE
    : '#' [ \t]* 'ifdef' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]*
    ;

IFNDEF_DIRECTIVE
    : '#' [ \t]* 'ifndef' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]*
    ;

ELSE_DIRECTIVE
    : '#' [ \t]* 'else' [ \t]*
    ;

ENDIF_DIRECTIVE
    : '#' [ \t]* 'endif' [ \t]*
    ;

// ADR-049: #pragma KEY VALUE...
// Matches: #pragma target teensy41, #pragma target cortex-m0+,
//          #pragma word_size 32, #pragma ldrex_strex true
// One token, so a pragma cannot span lines, and a trailing // comment stays
// a comment.
PRAGMA_DIRECTIVE
    : '#' [ \t]* 'pragma' [ \t]+ PRAGMA_KEY ([ \t]+ PRAGMA_VALUE)*
    ;

fragment PRAGMA_KEY
    : [a-zA-Z_] [a-zA-Z0-9_]*
    ;

fragment PRAGMA_VALUE
    : [a-zA-Z0-9_] [a-zA-Z0-9_.+\-]*
    ;

// Keywords
SCOPE       : 'scope';
STRUCT      : 'struct';
ENUM        : 'enum';
THIS        : 'this';      // ADR-016: scope-local reference
GLOBAL      : 'global';    // ADR-016: global reference
REGISTER    : 'register';
PRIVATE     : 'private';
PUBLIC      : 'public';
CONST       : 'const';
MUT         : 'mut';       // ADR-071
VOLATILE    : 'volatile';
VOID        : 'void';
IF          : 'if';
ELSE        : 'else';
WHILE       : 'while';
DO          : 'do';       // ADR-027: Do-while loops
FOR         : 'for';
FOREVER     : 'forever';  // ADR-068: Infinite loops
SWITCH      : 'switch';   // ADR-025: Switch statements
CASE        : 'case';
DEFAULT     : 'default';
RETURN      : 'return';
TRUE        : 'true';
FALSE       : 'false';
C_NULL      : 'NULL';     // ADR-047: C library NULL for interop (no lowercase 'null' - ADR-039)
STRING      : 'string';   // ADR-045: Bounded string type
SIZEOF      : 'sizeof';   // ADR-023: reserved, rejected by E0603

// ADR-034: Bitmap type keywords
BITMAP8     : 'bitmap8';
BITMAP16    : 'bitmap16';
BITMAP24    : 'bitmap24';
BITMAP32    : 'bitmap32';

// Access modifiers for registers
RW          : 'rw';
RO          : 'ro';
WO          : 'wo';
W1C         : 'w1c';
W1S         : 'w1s';

// Overflow behavior keywords (ADR-044)
CLAMP       : 'clamp';
WRAP        : 'wrap';

// ADR-049: Atomic types for ISR-safe variables
ATOMIC      : 'atomic';

// ADR-050: Critical sections for multi-variable atomic operations
CRITICAL    : 'critical';

// ADR-024: Type-suffixed numeric literals (REQUIRED)
// These MUST come before unsuffixed literals so ANTLR matches them first
// Suffixes: u8, u16, u32, u64, i8, i16, i32, i64, f32, f64

// Float with suffix: 3.14f32, 2.718f64, 1e10f64
SUFFIXED_FLOAT
    : ([0-9]+ '.' [0-9]+ ([eE] [+-]? [0-9]+)? | [0-9]+ [eE] [+-]? [0-9]+) [fF] ('32' | '64')
    ;

// Hex with suffix: 0xFFu8, 0xDEADBEEFu32
SUFFIXED_HEX
    : '0' [xX] [0-9a-fA-F]+ ([uUiI] ('8' | '16' | '32' | '64'))
    ;

// Binary with suffix: 0b1010u8, 0b11110000u8
SUFFIXED_BINARY
    : '0' [bB] [01]+ ([uUiI] ('8' | '16' | '32' | '64'))
    ;

// Decimal integer with suffix: 42u8, 1000i32, 255u8
SUFFIXED_DECIMAL
    : [0-9]+ ([uUiI] ('8' | '16' | '32' | '64'))
    ;

// Primitive types
U8          : 'u8';
U16         : 'u16';
U32         : 'u32';
U64         : 'u64';
I8          : 'i8';
I16         : 'i16';
I32         : 'i32';
I64         : 'i64';
F32         : 'f32';
F64         : 'f64';
BOOL        : 'bool';
ISR_TYPE    : 'ISR';        // ADR-040: Interrupt Service Routine type

// Operators
// Compound assignment operators (must be before simple operators for correct matching)
LSHIFT_ASSIGN   : '<<<-';   // Left shift assignment
RSHIFT_ASSIGN   : '>><-';   // Right shift assignment
PLUS_ASSIGN     : '+<-';    // Addition assignment
MINUS_ASSIGN    : '-<-';    // Subtraction assignment
STAR_ASSIGN     : '*<-';    // Multiplication assignment
SLASH_ASSIGN    : '/<-';    // Division assignment
PERCENT_ASSIGN  : '%<-';    // Modulo assignment
BITAND_ASSIGN   : '&<-';    // Bitwise AND assignment
BITOR_ASSIGN    : '|<-';    // Bitwise OR assignment
BITXOR_ASSIGN   : '^<-';    // Bitwise XOR assignment

// Simple operators
ASSIGN      : '<-';
EQ          : '=';
NEQ         : '!=';
LT          : '<';
GT          : '>';
LTE         : '<=';
GTE         : '>=';
PLUS        : '+';
MINUS       : '-';
STAR        : '*';
SLASH       : '/';
PERCENT     : '%';
AND         : '&&';
OR          : '||';
NOT         : '!';
BITAND      : '&';
BITOR       : '|';
BITXOR      : '^';
BITNOT      : '~';
LSHIFT      : '<<';
RSHIFT      : '>>';

// Punctuation
LPAREN      : '(';
RPAREN      : ')';
LBRACE      : '{';
RBRACE      : '}';
LBRACKET    : '[';
RBRACKET    : ']';
SEMI        : ';';
COMMA       : ',';
DOT         : '.';
AT          : '@';
COLON       : ':';

// Note: BOOL_LITERAL handled by TRUE/FALSE tokens above

HEX_LITERAL
    : '0' [xX] [0-9a-fA-F]+
    ;

BINARY_LITERAL
    : '0' [bB] [01]+
    ;

FLOAT_LITERAL
    : [0-9]+ '.' [0-9]+ ([eE] [+-]? [0-9]+)?
    | [0-9]+ [eE] [+-]? [0-9]+
    ;

INTEGER_LITERAL
    : [0-9]+
    ;

STRING_LITERAL
    : '"' (~["\r\n\\] | '\\' .)* '"'
    ;

CHAR_LITERAL
    : '\'' (~['\r\n\\] | '\\' .) '\''
    ;

// Identifiers
IDENTIFIER
    : [a-zA-Z_] [a-zA-Z0-9_]*
    ;

// Comments - preserved on HIDDEN channel for output (ADR-043)
// DOC_COMMENT must be before LINE_COMMENT (ANTLR matches first rule that fits)
DOC_COMMENT
    : '///' ~[\r\n]* -> channel(HIDDEN)
    ;

LINE_COMMENT
    : '//' ~[\r\n]* -> channel(HIDDEN)
    ;

BLOCK_COMMENT
    : '/*' .*? '*/' -> channel(HIDDEN)
    ;

// Whitespace
WS
    : [ \t\r\n]+ -> skip
    ;
