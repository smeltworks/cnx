// Generated from grammar/Cnx.g4 by ANTLR 4.13.1

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { CnxListener } from "./CnxListener.js";
import { CnxVisitor } from "./CnxVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class CnxParser extends antlr.Parser {
    public static readonly T__0 = 1;
    public static readonly INCLUDE_DIRECTIVE = 2;
    public static readonly DEFINE_FUNCTION = 3;
    public static readonly DEFINE_WITH_VALUE = 4;
    public static readonly DEFINE_FLAG = 5;
    public static readonly IFDEF_DIRECTIVE = 6;
    public static readonly IFNDEF_DIRECTIVE = 7;
    public static readonly ELSE_DIRECTIVE = 8;
    public static readonly ENDIF_DIRECTIVE = 9;
    public static readonly PRAGMA_DIRECTIVE = 10;
    public static readonly SCOPE = 11;
    public static readonly STRUCT = 12;
    public static readonly ENUM = 13;
    public static readonly THIS = 14;
    public static readonly GLOBAL = 15;
    public static readonly REGISTER = 16;
    public static readonly PRIVATE = 17;
    public static readonly PUBLIC = 18;
    public static readonly CONST = 19;
    public static readonly MUT = 20;
    public static readonly VOLATILE = 21;
    public static readonly VOID = 22;
    public static readonly IF = 23;
    public static readonly ELSE = 24;
    public static readonly WHILE = 25;
    public static readonly DO = 26;
    public static readonly FOR = 27;
    public static readonly FOREVER = 28;
    public static readonly SWITCH = 29;
    public static readonly CASE = 30;
    public static readonly DEFAULT = 31;
    public static readonly RETURN = 32;
    public static readonly TRUE = 33;
    public static readonly FALSE = 34;
    public static readonly C_NULL = 35;
    public static readonly STRING = 36;
    public static readonly SIZEOF = 37;
    public static readonly BITMAP8 = 38;
    public static readonly BITMAP16 = 39;
    public static readonly BITMAP24 = 40;
    public static readonly BITMAP32 = 41;
    public static readonly RW = 42;
    public static readonly RO = 43;
    public static readonly WO = 44;
    public static readonly W1C = 45;
    public static readonly W1S = 46;
    public static readonly CLAMP = 47;
    public static readonly WRAP = 48;
    public static readonly ATOMIC = 49;
    public static readonly CRITICAL = 50;
    public static readonly SUFFIXED_FLOAT = 51;
    public static readonly SUFFIXED_HEX = 52;
    public static readonly SUFFIXED_BINARY = 53;
    public static readonly SUFFIXED_DECIMAL = 54;
    public static readonly U8 = 55;
    public static readonly U16 = 56;
    public static readonly U32 = 57;
    public static readonly U64 = 58;
    public static readonly I8 = 59;
    public static readonly I16 = 60;
    public static readonly I32 = 61;
    public static readonly I64 = 62;
    public static readonly F32 = 63;
    public static readonly F64 = 64;
    public static readonly BOOL = 65;
    public static readonly ISR_TYPE = 66;
    public static readonly LSHIFT_ASSIGN = 67;
    public static readonly RSHIFT_ASSIGN = 68;
    public static readonly PLUS_ASSIGN = 69;
    public static readonly MINUS_ASSIGN = 70;
    public static readonly STAR_ASSIGN = 71;
    public static readonly SLASH_ASSIGN = 72;
    public static readonly PERCENT_ASSIGN = 73;
    public static readonly BITAND_ASSIGN = 74;
    public static readonly BITOR_ASSIGN = 75;
    public static readonly BITXOR_ASSIGN = 76;
    public static readonly ASSIGN = 77;
    public static readonly EQ = 78;
    public static readonly NEQ = 79;
    public static readonly LT = 80;
    public static readonly GT = 81;
    public static readonly LTE = 82;
    public static readonly GTE = 83;
    public static readonly PLUS = 84;
    public static readonly MINUS = 85;
    public static readonly STAR = 86;
    public static readonly SLASH = 87;
    public static readonly PERCENT = 88;
    public static readonly AND = 89;
    public static readonly OR = 90;
    public static readonly NOT = 91;
    public static readonly BITAND = 92;
    public static readonly BITOR = 93;
    public static readonly BITXOR = 94;
    public static readonly BITNOT = 95;
    public static readonly LSHIFT = 96;
    public static readonly RSHIFT = 97;
    public static readonly LPAREN = 98;
    public static readonly RPAREN = 99;
    public static readonly LBRACE = 100;
    public static readonly RBRACE = 101;
    public static readonly LBRACKET = 102;
    public static readonly RBRACKET = 103;
    public static readonly SEMI = 104;
    public static readonly COMMA = 105;
    public static readonly DOT = 106;
    public static readonly AT = 107;
    public static readonly COLON = 108;
    public static readonly HEX_LITERAL = 109;
    public static readonly BINARY_LITERAL = 110;
    public static readonly FLOAT_LITERAL = 111;
    public static readonly INTEGER_LITERAL = 112;
    public static readonly STRING_LITERAL = 113;
    public static readonly CHAR_LITERAL = 114;
    public static readonly IDENTIFIER = 115;
    public static readonly DOC_COMMENT = 116;
    public static readonly LINE_COMMENT = 117;
    public static readonly BLOCK_COMMENT = 118;
    public static readonly WS = 119;
    public static readonly RULE_program = 0;
    public static readonly RULE_includeDirective = 1;
    public static readonly RULE_preprocessorDirective = 2;
    public static readonly RULE_defineDirective = 3;
    public static readonly RULE_conditionalDirective = 4;
    public static readonly RULE_pragmaDirective = 5;
    public static readonly RULE_declaration = 6;
    public static readonly RULE_scopeDeclaration = 7;
    public static readonly RULE_scopeMember = 8;
    public static readonly RULE_visibilityModifier = 9;
    public static readonly RULE_registerDeclaration = 10;
    public static readonly RULE_registerMember = 11;
    public static readonly RULE_memberName = 12;
    public static readonly RULE_accessModifier = 13;
    public static readonly RULE_structDeclaration = 14;
    public static readonly RULE_structMember = 15;
    public static readonly RULE_enumDeclaration = 16;
    public static readonly RULE_enumMember = 17;
    public static readonly RULE_bitmapDeclaration = 18;
    public static readonly RULE_bitmapType = 19;
    public static readonly RULE_bitmapMember = 20;
    public static readonly RULE_functionDeclaration = 21;
    public static readonly RULE_parameterList = 22;
    public static readonly RULE_parameter = 23;
    public static readonly RULE_constModifier = 24;
    public static readonly RULE_mutModifier = 25;
    public static readonly RULE_volatileModifier = 26;
    public static readonly RULE_overflowModifier = 27;
    public static readonly RULE_atomicModifier = 28;
    public static readonly RULE_arrayDimension = 29;
    public static readonly RULE_variableDeclaration = 30;
    public static readonly RULE_constructorArgumentList = 31;
    public static readonly RULE_block = 32;
    public static readonly RULE_statement = 33;
    public static readonly RULE_criticalStatement = 34;
    public static readonly RULE_assignmentStatement = 35;
    public static readonly RULE_assignmentOperator = 36;
    public static readonly RULE_assignmentTarget = 37;
    public static readonly RULE_postfixTargetOp = 38;
    public static readonly RULE_expressionStatement = 39;
    public static readonly RULE_ifStatement = 40;
    public static readonly RULE_whileStatement = 41;
    public static readonly RULE_doWhileStatement = 42;
    public static readonly RULE_forStatement = 43;
    public static readonly RULE_foreverStatement = 44;
    public static readonly RULE_forInit = 45;
    public static readonly RULE_forVarDecl = 46;
    public static readonly RULE_forAssignment = 47;
    public static readonly RULE_forUpdate = 48;
    public static readonly RULE_returnStatement = 49;
    public static readonly RULE_switchStatement = 50;
    public static readonly RULE_switchCase = 51;
    public static readonly RULE_caseLabel = 52;
    public static readonly RULE_defaultCase = 53;
    public static readonly RULE_expression = 54;
    public static readonly RULE_ternaryExpression = 55;
    public static readonly RULE_orExpression = 56;
    public static readonly RULE_andExpression = 57;
    public static readonly RULE_equalityExpression = 58;
    public static readonly RULE_relationalExpression = 59;
    public static readonly RULE_bitwiseOrExpression = 60;
    public static readonly RULE_bitwiseXorExpression = 61;
    public static readonly RULE_bitwiseAndExpression = 62;
    public static readonly RULE_shiftExpression = 63;
    public static readonly RULE_additiveExpression = 64;
    public static readonly RULE_multiplicativeExpression = 65;
    public static readonly RULE_unaryExpression = 66;
    public static readonly RULE_postfixExpression = 67;
    public static readonly RULE_postfixOp = 68;
    public static readonly RULE_primaryExpression = 69;
    public static readonly RULE_sizeofExpression = 70;
    public static readonly RULE_castExpression = 71;
    public static readonly RULE_structInitializer = 72;
    public static readonly RULE_fieldInitializerList = 73;
    public static readonly RULE_fieldInitializer = 74;
    public static readonly RULE_arrayInitializer = 75;
    public static readonly RULE_arrayInitializerElement = 76;
    public static readonly RULE_argumentList = 77;
    public static readonly RULE_type = 78;
    public static readonly RULE_scopedType = 79;
    public static readonly RULE_globalType = 80;
    public static readonly RULE_qualifiedType = 81;
    public static readonly RULE_primitiveType = 82;
    public static readonly RULE_userType = 83;
    public static readonly RULE_templateType = 84;
    public static readonly RULE_templateArgumentList = 85;
    public static readonly RULE_templateArgument = 86;
    public static readonly RULE_stringType = 87;
    public static readonly RULE_arrayType = 88;
    public static readonly RULE_arrayTypeDimension = 89;
    public static readonly RULE_literal = 90;

    public static readonly literalNames = [
        null, "'?'", null, null, null, null, null, null, null, null, null, 
        "'scope'", "'struct'", "'enum'", "'this'", "'global'", "'register'", 
        "'private'", "'public'", "'const'", "'mut'", "'volatile'", "'void'", 
        "'if'", "'else'", "'while'", "'do'", "'for'", "'forever'", "'switch'", 
        "'case'", "'default'", "'return'", "'true'", "'false'", "'NULL'", 
        "'string'", "'sizeof'", "'bitmap8'", "'bitmap16'", "'bitmap24'", 
        "'bitmap32'", "'rw'", "'ro'", "'wo'", "'w1c'", "'w1s'", "'clamp'", 
        "'wrap'", "'atomic'", "'critical'", null, null, null, null, "'u8'", 
        "'u16'", "'u32'", "'u64'", "'i8'", "'i16'", "'i32'", "'i64'", "'f32'", 
        "'f64'", "'bool'", "'ISR'", "'<<<-'", "'>><-'", "'+<-'", "'-<-'", 
        "'*<-'", "'/<-'", "'%<-'", "'&<-'", "'|<-'", "'^<-'", "'<-'", "'='", 
        "'!='", "'<'", "'>'", "'<='", "'>='", "'+'", "'-'", "'*'", "'/'", 
        "'%'", "'&&'", "'||'", "'!'", "'&'", "'|'", "'^'", "'~'", "'<<'", 
        "'>>'", "'('", "')'", "'{'", "'}'", "'['", "']'", "';'", "','", 
        "'.'", "'@'", "':'"
    ];

    public static readonly symbolicNames = [
        null, null, "INCLUDE_DIRECTIVE", "DEFINE_FUNCTION", "DEFINE_WITH_VALUE", 
        "DEFINE_FLAG", "IFDEF_DIRECTIVE", "IFNDEF_DIRECTIVE", "ELSE_DIRECTIVE", 
        "ENDIF_DIRECTIVE", "PRAGMA_DIRECTIVE", "SCOPE", "STRUCT", "ENUM", 
        "THIS", "GLOBAL", "REGISTER", "PRIVATE", "PUBLIC", "CONST", "MUT", 
        "VOLATILE", "VOID", "IF", "ELSE", "WHILE", "DO", "FOR", "FOREVER", 
        "SWITCH", "CASE", "DEFAULT", "RETURN", "TRUE", "FALSE", "C_NULL", 
        "STRING", "SIZEOF", "BITMAP8", "BITMAP16", "BITMAP24", "BITMAP32", 
        "RW", "RO", "WO", "W1C", "W1S", "CLAMP", "WRAP", "ATOMIC", "CRITICAL", 
        "SUFFIXED_FLOAT", "SUFFIXED_HEX", "SUFFIXED_BINARY", "SUFFIXED_DECIMAL", 
        "U8", "U16", "U32", "U64", "I8", "I16", "I32", "I64", "F32", "F64", 
        "BOOL", "ISR_TYPE", "LSHIFT_ASSIGN", "RSHIFT_ASSIGN", "PLUS_ASSIGN", 
        "MINUS_ASSIGN", "STAR_ASSIGN", "SLASH_ASSIGN", "PERCENT_ASSIGN", 
        "BITAND_ASSIGN", "BITOR_ASSIGN", "BITXOR_ASSIGN", "ASSIGN", "EQ", 
        "NEQ", "LT", "GT", "LTE", "GTE", "PLUS", "MINUS", "STAR", "SLASH", 
        "PERCENT", "AND", "OR", "NOT", "BITAND", "BITOR", "BITXOR", "BITNOT", 
        "LSHIFT", "RSHIFT", "LPAREN", "RPAREN", "LBRACE", "RBRACE", "LBRACKET", 
        "RBRACKET", "SEMI", "COMMA", "DOT", "AT", "COLON", "HEX_LITERAL", 
        "BINARY_LITERAL", "FLOAT_LITERAL", "INTEGER_LITERAL", "STRING_LITERAL", 
        "CHAR_LITERAL", "IDENTIFIER", "DOC_COMMENT", "LINE_COMMENT", "BLOCK_COMMENT", 
        "WS"
    ];
    public static readonly ruleNames = [
        "program", "includeDirective", "preprocessorDirective", "defineDirective", 
        "conditionalDirective", "pragmaDirective", "declaration", "scopeDeclaration", 
        "scopeMember", "visibilityModifier", "registerDeclaration", "registerMember", 
        "memberName", "accessModifier", "structDeclaration", "structMember", 
        "enumDeclaration", "enumMember", "bitmapDeclaration", "bitmapType", 
        "bitmapMember", "functionDeclaration", "parameterList", "parameter", 
        "constModifier", "mutModifier", "volatileModifier", "overflowModifier", 
        "atomicModifier", "arrayDimension", "variableDeclaration", "constructorArgumentList", 
        "block", "statement", "criticalStatement", "assignmentStatement", 
        "assignmentOperator", "assignmentTarget", "postfixTargetOp", "expressionStatement", 
        "ifStatement", "whileStatement", "doWhileStatement", "forStatement", 
        "foreverStatement", "forInit", "forVarDecl", "forAssignment", "forUpdate", 
        "returnStatement", "switchStatement", "switchCase", "caseLabel", 
        "defaultCase", "expression", "ternaryExpression", "orExpression", 
        "andExpression", "equalityExpression", "relationalExpression", "bitwiseOrExpression", 
        "bitwiseXorExpression", "bitwiseAndExpression", "shiftExpression", 
        "additiveExpression", "multiplicativeExpression", "unaryExpression", 
        "postfixExpression", "postfixOp", "primaryExpression", "sizeofExpression", 
        "castExpression", "structInitializer", "fieldInitializerList", "fieldInitializer", 
        "arrayInitializer", "arrayInitializerElement", "argumentList", "type", 
        "scopedType", "globalType", "qualifiedType", "primitiveType", "userType", 
        "templateType", "templateArgumentList", "templateArgument", "stringType", 
        "arrayType", "arrayTypeDimension", "literal",
    ];

    public get grammarFileName(): string { return "Cnx.g4"; }
    public get literalNames(): (string | null)[] { return CnxParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return CnxParser.symbolicNames; }
    public get ruleNames(): string[] { return CnxParser.ruleNames; }
    public get serializedATN(): number[] { return CnxParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, CnxParser._ATN, CnxParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public program(): ProgramContext {
        let localContext = new ProgramContext(this.context, this.state);
        this.enterRule(localContext, 0, CnxParser.RULE_program);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 186;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2044) !== 0)) {
                {
                this.state = 184;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CnxParser.INCLUDE_DIRECTIVE:
                    {
                    this.state = 182;
                    this.includeDirective();
                    }
                    break;
                case CnxParser.DEFINE_FUNCTION:
                case CnxParser.DEFINE_WITH_VALUE:
                case CnxParser.DEFINE_FLAG:
                case CnxParser.IFDEF_DIRECTIVE:
                case CnxParser.IFNDEF_DIRECTIVE:
                case CnxParser.ELSE_DIRECTIVE:
                case CnxParser.ENDIF_DIRECTIVE:
                case CnxParser.PRAGMA_DIRECTIVE:
                    {
                    this.state = 183;
                    this.preprocessorDirective();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                this.state = 188;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 192;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 7993344) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146973757) !== 0) || _la === 115) {
                {
                {
                this.state = 189;
                this.declaration();
                }
                }
                this.state = 194;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 195;
            this.match(CnxParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public includeDirective(): IncludeDirectiveContext {
        let localContext = new IncludeDirectiveContext(this.context, this.state);
        this.enterRule(localContext, 2, CnxParser.RULE_includeDirective);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 197;
            this.match(CnxParser.INCLUDE_DIRECTIVE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public preprocessorDirective(): PreprocessorDirectiveContext {
        let localContext = new PreprocessorDirectiveContext(this.context, this.state);
        this.enterRule(localContext, 4, CnxParser.RULE_preprocessorDirective);
        try {
            this.state = 202;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.DEFINE_FUNCTION:
            case CnxParser.DEFINE_WITH_VALUE:
            case CnxParser.DEFINE_FLAG:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 199;
                this.defineDirective();
                }
                break;
            case CnxParser.IFDEF_DIRECTIVE:
            case CnxParser.IFNDEF_DIRECTIVE:
            case CnxParser.ELSE_DIRECTIVE:
            case CnxParser.ENDIF_DIRECTIVE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 200;
                this.conditionalDirective();
                }
                break;
            case CnxParser.PRAGMA_DIRECTIVE:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 201;
                this.pragmaDirective();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public defineDirective(): DefineDirectiveContext {
        let localContext = new DefineDirectiveContext(this.context, this.state);
        this.enterRule(localContext, 6, CnxParser.RULE_defineDirective);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 204;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 56) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public conditionalDirective(): ConditionalDirectiveContext {
        let localContext = new ConditionalDirectiveContext(this.context, this.state);
        this.enterRule(localContext, 8, CnxParser.RULE_conditionalDirective);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 206;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 960) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public pragmaDirective(): PragmaDirectiveContext {
        let localContext = new PragmaDirectiveContext(this.context, this.state);
        this.enterRule(localContext, 10, CnxParser.RULE_pragmaDirective);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 208;
            this.match(CnxParser.PRAGMA_DIRECTIVE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public declaration(): DeclarationContext {
        let localContext = new DeclarationContext(this.context, this.state);
        this.enterRule(localContext, 12, CnxParser.RULE_declaration);
        try {
            this.state = 217;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 4, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 210;
                this.scopeDeclaration();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 211;
                this.registerDeclaration();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 212;
                this.structDeclaration();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 213;
                this.enumDeclaration();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 214;
                this.bitmapDeclaration();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 215;
                this.functionDeclaration();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 216;
                this.variableDeclaration();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public scopeDeclaration(): ScopeDeclarationContext {
        let localContext = new ScopeDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 14, CnxParser.RULE_scopeDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 219;
            this.match(CnxParser.SCOPE);
            this.state = 220;
            this.match(CnxParser.IDENTIFIER);
            this.state = 221;
            this.match(CnxParser.LBRACE);
            this.state = 225;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 8384512) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146973757) !== 0) || _la === 115) {
                {
                {
                this.state = 222;
                this.scopeMember();
                }
                }
                this.state = 227;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 228;
            this.match(CnxParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public scopeMember(): ScopeMemberContext {
        let localContext = new ScopeMemberContext(this.context, this.state);
        this.enterRule(localContext, 16, CnxParser.RULE_scopeMember);
        let _la: number;
        try {
            this.state = 254;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 12, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 231;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 230;
                    this.visibilityModifier();
                    }
                }

                this.state = 233;
                this.variableDeclaration();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 235;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 234;
                    this.visibilityModifier();
                    }
                }

                this.state = 237;
                this.functionDeclaration();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 239;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 238;
                    this.visibilityModifier();
                    }
                }

                this.state = 241;
                this.enumDeclaration();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 243;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 242;
                    this.visibilityModifier();
                    }
                }

                this.state = 245;
                this.bitmapDeclaration();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 247;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 246;
                    this.visibilityModifier();
                    }
                }

                this.state = 249;
                this.registerDeclaration();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 251;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 250;
                    this.visibilityModifier();
                    }
                }

                this.state = 253;
                this.structDeclaration();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public visibilityModifier(): VisibilityModifierContext {
        let localContext = new VisibilityModifierContext(this.context, this.state);
        this.enterRule(localContext, 18, CnxParser.RULE_visibilityModifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 256;
            _la = this.tokenStream.LA(1);
            if(!(_la === 17 || _la === 18)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public registerDeclaration(): RegisterDeclarationContext {
        let localContext = new RegisterDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 20, CnxParser.RULE_registerDeclaration);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 258;
            this.match(CnxParser.REGISTER);
            this.state = 259;
            this.match(CnxParser.IDENTIFIER);
            this.state = 260;
            this.match(CnxParser.LBRACE);
            this.state = 261;
            this.registerMember();
            this.state = 266;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 13, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 262;
                    this.match(CnxParser.COMMA);
                    this.state = 263;
                    this.registerMember();
                    }
                    }
                }
                this.state = 268;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 13, this.context);
            }
            this.state = 270;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 269;
                this.match(CnxParser.COMMA);
                }
            }

            this.state = 272;
            this.match(CnxParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public registerMember(): RegisterMemberContext {
        let localContext = new RegisterMemberContext(this.context, this.state);
        this.enterRule(localContext, 22, CnxParser.RULE_registerMember);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 274;
            this.expression();
            this.state = 275;
            this.accessModifier();
            this.state = 276;
            this.type_();
            this.state = 277;
            this.memberName();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public memberName(): MemberNameContext {
        let localContext = new MemberNameContext(this.context, this.state);
        this.enterRule(localContext, 24, CnxParser.RULE_memberName);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 279;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 4294967295) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 16773375) !== 0) || _la === 115)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public accessModifier(): AccessModifierContext {
        let localContext = new AccessModifierContext(this.context, this.state);
        this.enterRule(localContext, 26, CnxParser.RULE_accessModifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 281;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 31) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structDeclaration(): StructDeclarationContext {
        let localContext = new StructDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 28, CnxParser.RULE_structDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 283;
            this.match(CnxParser.STRUCT);
            this.state = 284;
            this.match(CnxParser.IDENTIFIER);
            this.state = 285;
            this.match(CnxParser.LBRACE);
            this.state = 289;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4243456) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146965505) !== 0) || _la === 115) {
                {
                {
                this.state = 286;
                this.structMember();
                }
                }
                this.state = 291;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 292;
            this.match(CnxParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structMember(): StructMemberContext {
        let localContext = new StructMemberContext(this.context, this.state);
        this.enterRule(localContext, 30, CnxParser.RULE_structMember);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 295;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 294;
                this.overflowModifier();
                }
            }

            this.state = 297;
            this.type_();
            this.state = 298;
            this.memberName();
            this.state = 302;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 102) {
                {
                {
                this.state = 299;
                this.arrayDimension();
                }
                }
                this.state = 304;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 305;
            this.match(CnxParser.SEMI);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public enumDeclaration(): EnumDeclarationContext {
        let localContext = new EnumDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 32, CnxParser.RULE_enumDeclaration);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 307;
            this.match(CnxParser.ENUM);
            this.state = 308;
            this.match(CnxParser.IDENTIFIER);
            this.state = 309;
            this.match(CnxParser.LBRACE);
            this.state = 310;
            this.enumMember();
            this.state = 315;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 18, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 311;
                    this.match(CnxParser.COMMA);
                    this.state = 312;
                    this.enumMember();
                    }
                    }
                }
                this.state = 317;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 18, this.context);
            }
            this.state = 319;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 318;
                this.match(CnxParser.COMMA);
                }
            }

            this.state = 321;
            this.match(CnxParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public enumMember(): EnumMemberContext {
        let localContext = new EnumMemberContext(this.context, this.state);
        this.enterRule(localContext, 34, CnxParser.RULE_enumMember);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 323;
            this.match(CnxParser.IDENTIFIER);
            this.state = 326;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 77) {
                {
                this.state = 324;
                this.match(CnxParser.ASSIGN);
                this.state = 325;
                this.expression();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public bitmapDeclaration(): BitmapDeclarationContext {
        let localContext = new BitmapDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 36, CnxParser.RULE_bitmapDeclaration);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 328;
            this.bitmapType();
            this.state = 329;
            this.match(CnxParser.IDENTIFIER);
            this.state = 330;
            this.match(CnxParser.LBRACE);
            this.state = 331;
            this.bitmapMember();
            this.state = 336;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 21, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 332;
                    this.match(CnxParser.COMMA);
                    this.state = 333;
                    this.bitmapMember();
                    }
                    }
                }
                this.state = 338;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 21, this.context);
            }
            this.state = 340;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 339;
                this.match(CnxParser.COMMA);
                }
            }

            this.state = 342;
            this.match(CnxParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public bitmapType(): BitmapTypeContext {
        let localContext = new BitmapTypeContext(this.context, this.state);
        this.enterRule(localContext, 38, CnxParser.RULE_bitmapType);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 344;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 38)) & ~0x1F) === 0 && ((1 << (_la - 38)) & 15) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public bitmapMember(): BitmapMemberContext {
        let localContext = new BitmapMemberContext(this.context, this.state);
        this.enterRule(localContext, 40, CnxParser.RULE_bitmapMember);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 346;
            this.memberName();
            this.state = 350;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 102) {
                {
                this.state = 347;
                this.match(CnxParser.LBRACKET);
                this.state = 348;
                this.match(CnxParser.INTEGER_LITERAL);
                this.state = 349;
                this.match(CnxParser.RBRACKET);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public functionDeclaration(): FunctionDeclarationContext {
        let localContext = new FunctionDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 42, CnxParser.RULE_functionDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 353;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 352;
                this.overflowModifier();
                }
            }

            this.state = 355;
            this.type_();
            this.state = 356;
            this.match(CnxParser.IDENTIFIER);
            this.state = 357;
            this.match(CnxParser.LPAREN);
            this.state = 359;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 5816320) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146959361) !== 0) || _la === 115) {
                {
                this.state = 358;
                this.parameterList();
                }
            }

            this.state = 361;
            this.match(CnxParser.RPAREN);
            this.state = 362;
            this.block();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public parameterList(): ParameterListContext {
        let localContext = new ParameterListContext(this.context, this.state);
        this.enterRule(localContext, 44, CnxParser.RULE_parameterList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 364;
            this.parameter();
            this.state = 369;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 365;
                this.match(CnxParser.COMMA);
                this.state = 366;
                this.parameter();
                }
                }
                this.state = 371;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public parameter(): ParameterContext {
        let localContext = new ParameterContext(this.context, this.state);
        this.enterRule(localContext, 46, CnxParser.RULE_parameter);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 373;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 19) {
                {
                this.state = 372;
                this.constModifier();
                }
            }

            this.state = 376;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 20) {
                {
                this.state = 375;
                this.mutModifier();
                }
            }

            this.state = 378;
            this.type_();
            this.state = 379;
            this.match(CnxParser.IDENTIFIER);
            this.state = 383;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 102) {
                {
                {
                this.state = 380;
                this.arrayDimension();
                }
                }
                this.state = 385;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public constModifier(): ConstModifierContext {
        let localContext = new ConstModifierContext(this.context, this.state);
        this.enterRule(localContext, 48, CnxParser.RULE_constModifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 386;
            this.match(CnxParser.CONST);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public mutModifier(): MutModifierContext {
        let localContext = new MutModifierContext(this.context, this.state);
        this.enterRule(localContext, 50, CnxParser.RULE_mutModifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 388;
            this.match(CnxParser.MUT);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public volatileModifier(): VolatileModifierContext {
        let localContext = new VolatileModifierContext(this.context, this.state);
        this.enterRule(localContext, 52, CnxParser.RULE_volatileModifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 390;
            this.match(CnxParser.VOLATILE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public overflowModifier(): OverflowModifierContext {
        let localContext = new OverflowModifierContext(this.context, this.state);
        this.enterRule(localContext, 54, CnxParser.RULE_overflowModifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 392;
            _la = this.tokenStream.LA(1);
            if(!(_la === 47 || _la === 48)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public atomicModifier(): AtomicModifierContext {
        let localContext = new AtomicModifierContext(this.context, this.state);
        this.enterRule(localContext, 56, CnxParser.RULE_atomicModifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 394;
            this.match(CnxParser.ATOMIC);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public arrayDimension(): ArrayDimensionContext {
        let localContext = new ArrayDimensionContext(this.context, this.state);
        this.enterRule(localContext, 58, CnxParser.RULE_arrayDimension);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 396;
            this.match(CnxParser.LBRACKET);
            this.state = 398;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                {
                this.state = 397;
                this.expression();
                }
            }

            this.state = 400;
            this.match(CnxParser.RBRACKET);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public variableDeclaration(): VariableDeclarationContext {
        let localContext = new VariableDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 60, CnxParser.RULE_variableDeclaration);
        let _la: number;
        try {
            this.state = 445;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 38, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 403;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 49) {
                    {
                    this.state = 402;
                    this.atomicModifier();
                    }
                }

                this.state = 406;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 21) {
                    {
                    this.state = 405;
                    this.volatileModifier();
                    }
                }

                this.state = 409;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 19) {
                    {
                    this.state = 408;
                    this.constModifier();
                    }
                }

                this.state = 412;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 20) {
                    {
                    this.state = 411;
                    this.mutModifier();
                    }
                }

                this.state = 415;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 47 || _la === 48) {
                    {
                    this.state = 414;
                    this.overflowModifier();
                    }
                }

                this.state = 417;
                this.type_();
                this.state = 418;
                this.match(CnxParser.IDENTIFIER);
                this.state = 422;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 102) {
                    {
                    {
                    this.state = 419;
                    this.arrayDimension();
                    }
                    }
                    this.state = 424;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 427;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 77) {
                    {
                    this.state = 425;
                    this.match(CnxParser.ASSIGN);
                    this.state = 426;
                    this.expression();
                    }
                }

                this.state = 429;
                this.match(CnxParser.SEMI);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 431;
                this.type_();
                this.state = 432;
                this.match(CnxParser.IDENTIFIER);
                this.state = 433;
                this.match(CnxParser.LPAREN);
                this.state = 434;
                this.constructorArgumentList();
                this.state = 435;
                this.match(CnxParser.RPAREN);
                this.state = 436;
                this.match(CnxParser.SEMI);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 438;
                this.type_();
                this.state = 439;
                this.match(CnxParser.IDENTIFIER);
                this.state = 440;
                this.match(CnxParser.LPAREN);
                this.state = 441;
                this.expression();
                this.state = 442;
                this.match(CnxParser.RPAREN);
                this.state = 443;
                this.match(CnxParser.SEMI);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public constructorArgumentList(): ConstructorArgumentListContext {
        let localContext = new ConstructorArgumentListContext(this.context, this.state);
        this.enterRule(localContext, 62, CnxParser.RULE_constructorArgumentList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 447;
            this.match(CnxParser.IDENTIFIER);
            this.state = 452;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 448;
                this.match(CnxParser.COMMA);
                this.state = 449;
                this.match(CnxParser.IDENTIFIER);
                }
                }
                this.state = 454;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public block(): BlockContext {
        let localContext = new BlockContext(this.context, this.state);
        this.enterRule(localContext, 64, CnxParser.RULE_block);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 455;
            this.match(CnxParser.LBRACE);
            this.state = 459;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 16579555) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 1048575) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                {
                {
                this.state = 456;
                this.statement();
                }
                }
                this.state = 461;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 462;
            this.match(CnxParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public statement(): StatementContext {
        let localContext = new StatementContext(this.context, this.state);
        this.enterRule(localContext, 66, CnxParser.RULE_statement);
        try {
            this.state = 476;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 41, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 464;
                this.variableDeclaration();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 465;
                this.assignmentStatement();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 466;
                this.expressionStatement();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 467;
                this.ifStatement();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 468;
                this.whileStatement();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 469;
                this.doWhileStatement();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 470;
                this.forStatement();
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 471;
                this.foreverStatement();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 472;
                this.switchStatement();
                }
                break;
            case 10:
                this.enterOuterAlt(localContext, 10);
                {
                this.state = 473;
                this.returnStatement();
                }
                break;
            case 11:
                this.enterOuterAlt(localContext, 11);
                {
                this.state = 474;
                this.criticalStatement();
                }
                break;
            case 12:
                this.enterOuterAlt(localContext, 12);
                {
                this.state = 475;
                this.block();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public criticalStatement(): CriticalStatementContext {
        let localContext = new CriticalStatementContext(this.context, this.state);
        this.enterRule(localContext, 68, CnxParser.RULE_criticalStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 478;
            this.match(CnxParser.CRITICAL);
            this.state = 479;
            this.block();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public assignmentStatement(): AssignmentStatementContext {
        let localContext = new AssignmentStatementContext(this.context, this.state);
        this.enterRule(localContext, 70, CnxParser.RULE_assignmentStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 481;
            this.assignmentTarget();
            this.state = 482;
            this.assignmentOperator();
            this.state = 483;
            this.expression();
            this.state = 484;
            this.match(CnxParser.SEMI);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public assignmentOperator(): AssignmentOperatorContext {
        let localContext = new AssignmentOperatorContext(this.context, this.state);
        this.enterRule(localContext, 72, CnxParser.RULE_assignmentOperator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 486;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 2047) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public assignmentTarget(): AssignmentTargetContext {
        let localContext = new AssignmentTargetContext(this.context, this.state);
        this.enterRule(localContext, 74, CnxParser.RULE_assignmentTarget);
        let _la: number;
        try {
            this.state = 513;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.GLOBAL:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 488;
                this.match(CnxParser.GLOBAL);
                this.state = 489;
                this.match(CnxParser.DOT);
                this.state = 490;
                this.match(CnxParser.IDENTIFIER);
                this.state = 494;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 102 || _la === 106) {
                    {
                    {
                    this.state = 491;
                    this.postfixTargetOp();
                    }
                    }
                    this.state = 496;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case CnxParser.THIS:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 497;
                this.match(CnxParser.THIS);
                this.state = 498;
                this.match(CnxParser.DOT);
                this.state = 499;
                this.match(CnxParser.IDENTIFIER);
                this.state = 503;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 102 || _la === 106) {
                    {
                    {
                    this.state = 500;
                    this.postfixTargetOp();
                    }
                    }
                    this.state = 505;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case CnxParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 506;
                this.match(CnxParser.IDENTIFIER);
                this.state = 510;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 102 || _la === 106) {
                    {
                    {
                    this.state = 507;
                    this.postfixTargetOp();
                    }
                    }
                    this.state = 512;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public postfixTargetOp(): PostfixTargetOpContext {
        let localContext = new PostfixTargetOpContext(this.context, this.state);
        this.enterRule(localContext, 76, CnxParser.RULE_postfixTargetOp);
        let _la: number;
        try {
            this.state = 525;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.DOT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 515;
                this.match(CnxParser.DOT);
                this.state = 516;
                this.memberName();
                }
                break;
            case CnxParser.LBRACKET:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 517;
                this.match(CnxParser.LBRACKET);
                this.state = 518;
                this.expression();
                this.state = 521;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 105) {
                    {
                    this.state = 519;
                    this.match(CnxParser.COMMA);
                    this.state = 520;
                    this.expression();
                    }
                }

                this.state = 523;
                this.match(CnxParser.RBRACKET);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expressionStatement(): ExpressionStatementContext {
        let localContext = new ExpressionStatementContext(this.context, this.state);
        this.enterRule(localContext, 78, CnxParser.RULE_expressionStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 527;
            this.expression();
            this.state = 528;
            this.match(CnxParser.SEMI);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public ifStatement(): IfStatementContext {
        let localContext = new IfStatementContext(this.context, this.state);
        this.enterRule(localContext, 80, CnxParser.RULE_ifStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 530;
            this.match(CnxParser.IF);
            this.state = 531;
            this.match(CnxParser.LPAREN);
            this.state = 532;
            this.expression();
            this.state = 533;
            this.match(CnxParser.RPAREN);
            this.state = 534;
            this.statement();
            this.state = 537;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 48, this.context) ) {
            case 1:
                {
                this.state = 535;
                this.match(CnxParser.ELSE);
                this.state = 536;
                this.statement();
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public whileStatement(): WhileStatementContext {
        let localContext = new WhileStatementContext(this.context, this.state);
        this.enterRule(localContext, 82, CnxParser.RULE_whileStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 539;
            this.match(CnxParser.WHILE);
            this.state = 540;
            this.match(CnxParser.LPAREN);
            this.state = 541;
            this.expression();
            this.state = 542;
            this.match(CnxParser.RPAREN);
            this.state = 543;
            this.statement();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public doWhileStatement(): DoWhileStatementContext {
        let localContext = new DoWhileStatementContext(this.context, this.state);
        this.enterRule(localContext, 84, CnxParser.RULE_doWhileStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 545;
            this.match(CnxParser.DO);
            this.state = 546;
            this.block();
            this.state = 547;
            this.match(CnxParser.WHILE);
            this.state = 548;
            this.match(CnxParser.LPAREN);
            this.state = 549;
            this.expression();
            this.state = 550;
            this.match(CnxParser.RPAREN);
            this.state = 551;
            this.match(CnxParser.SEMI);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public forStatement(): ForStatementContext {
        let localContext = new ForStatementContext(this.context, this.state);
        this.enterRule(localContext, 86, CnxParser.RULE_forStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 553;
            this.match(CnxParser.FOR);
            this.state = 554;
            this.match(CnxParser.LPAREN);
            this.state = 556;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 7389184) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146973697) !== 0) || _la === 115) {
                {
                this.state = 555;
                this.forInit();
                }
            }

            this.state = 558;
            this.match(CnxParser.SEMI);
            this.state = 560;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                {
                this.state = 559;
                this.expression();
                }
            }

            this.state = 562;
            this.match(CnxParser.SEMI);
            this.state = 564;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14 || _la === 15 || _la === 115) {
                {
                this.state = 563;
                this.forUpdate();
                }
            }

            this.state = 566;
            this.match(CnxParser.RPAREN);
            this.state = 567;
            this.statement();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public foreverStatement(): ForeverStatementContext {
        let localContext = new ForeverStatementContext(this.context, this.state);
        this.enterRule(localContext, 88, CnxParser.RULE_foreverStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 569;
            this.match(CnxParser.FOREVER);
            this.state = 570;
            this.block();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public forInit(): ForInitContext {
        let localContext = new ForInitContext(this.context, this.state);
        this.enterRule(localContext, 90, CnxParser.RULE_forInit);
        try {
            this.state = 574;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 52, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 572;
                this.forVarDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 573;
                this.forAssignment();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public forVarDecl(): ForVarDeclContext {
        let localContext = new ForVarDeclContext(this.context, this.state);
        this.enterRule(localContext, 92, CnxParser.RULE_forVarDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 577;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 49) {
                {
                this.state = 576;
                this.atomicModifier();
                }
            }

            this.state = 580;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 21) {
                {
                this.state = 579;
                this.volatileModifier();
                }
            }

            this.state = 583;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 20) {
                {
                this.state = 582;
                this.mutModifier();
                }
            }

            this.state = 586;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 585;
                this.overflowModifier();
                }
            }

            this.state = 588;
            this.type_();
            this.state = 589;
            this.match(CnxParser.IDENTIFIER);
            this.state = 593;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 102) {
                {
                {
                this.state = 590;
                this.arrayDimension();
                }
                }
                this.state = 595;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 598;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 77) {
                {
                this.state = 596;
                this.match(CnxParser.ASSIGN);
                this.state = 597;
                this.expression();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public forAssignment(): ForAssignmentContext {
        let localContext = new ForAssignmentContext(this.context, this.state);
        this.enterRule(localContext, 94, CnxParser.RULE_forAssignment);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 600;
            this.assignmentTarget();
            this.state = 601;
            this.assignmentOperator();
            this.state = 602;
            this.expression();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public forUpdate(): ForUpdateContext {
        let localContext = new ForUpdateContext(this.context, this.state);
        this.enterRule(localContext, 96, CnxParser.RULE_forUpdate);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 604;
            this.assignmentTarget();
            this.state = 605;
            this.assignmentOperator();
            this.state = 606;
            this.expression();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public returnStatement(): ReturnStatementContext {
        let localContext = new ReturnStatementContext(this.context, this.state);
        this.enterRule(localContext, 98, CnxParser.RULE_returnStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 608;
            this.match(CnxParser.RETURN);
            this.state = 610;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                {
                this.state = 609;
                this.expression();
                }
            }

            this.state = 612;
            this.match(CnxParser.SEMI);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public switchStatement(): SwitchStatementContext {
        let localContext = new SwitchStatementContext(this.context, this.state);
        this.enterRule(localContext, 100, CnxParser.RULE_switchStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 614;
            this.match(CnxParser.SWITCH);
            this.state = 615;
            this.match(CnxParser.LPAREN);
            this.state = 616;
            this.expression();
            this.state = 617;
            this.match(CnxParser.RPAREN);
            this.state = 618;
            this.match(CnxParser.LBRACE);
            this.state = 620;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 619;
                this.switchCase();
                }
                }
                this.state = 622;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 30);
            this.state = 625;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 31) {
                {
                this.state = 624;
                this.defaultCase();
                }
            }

            this.state = 627;
            this.match(CnxParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public switchCase(): SwitchCaseContext {
        let localContext = new SwitchCaseContext(this.context, this.state);
        this.enterRule(localContext, 102, CnxParser.RULE_switchCase);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 629;
            this.match(CnxParser.CASE);
            this.state = 630;
            this.caseLabel();
            this.state = 635;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 90) {
                {
                {
                this.state = 631;
                this.match(CnxParser.OR);
                this.state = 632;
                this.caseLabel();
                }
                }
                this.state = 637;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 638;
            this.block();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public caseLabel(): CaseLabelContext {
        let localContext = new CaseLabelContext(this.context, this.state);
        this.enterRule(localContext, 104, CnxParser.RULE_caseLabel);
        let _la: number;
        try {
            this.state = 658;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 66, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 640;
                this.qualifiedType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 641;
                _la = this.tokenStream.LA(1);
                if(!(_la === 14 || _la === 15)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 642;
                this.match(CnxParser.DOT);
                this.state = 645;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 63, this.context) ) {
                case 1:
                    {
                    this.state = 643;
                    this.qualifiedType();
                    }
                    break;
                case 2:
                    {
                    this.state = 644;
                    this.match(CnxParser.IDENTIFIER);
                    }
                    break;
                }
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 647;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 649;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 85) {
                    {
                    this.state = 648;
                    this.match(CnxParser.MINUS);
                    }
                }

                this.state = 651;
                this.match(CnxParser.INTEGER_LITERAL);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 653;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 85) {
                    {
                    this.state = 652;
                    this.match(CnxParser.MINUS);
                    }
                }

                this.state = 655;
                this.match(CnxParser.HEX_LITERAL);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 656;
                this.match(CnxParser.BINARY_LITERAL);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 657;
                this.match(CnxParser.CHAR_LITERAL);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public defaultCase(): DefaultCaseContext {
        let localContext = new DefaultCaseContext(this.context, this.state);
        this.enterRule(localContext, 106, CnxParser.RULE_defaultCase);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 660;
            this.match(CnxParser.DEFAULT);
            this.state = 664;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 98) {
                {
                this.state = 661;
                this.match(CnxParser.LPAREN);
                this.state = 662;
                this.match(CnxParser.INTEGER_LITERAL);
                this.state = 663;
                this.match(CnxParser.RPAREN);
                }
            }

            this.state = 666;
            this.block();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expression(): ExpressionContext {
        let localContext = new ExpressionContext(this.context, this.state);
        this.enterRule(localContext, 108, CnxParser.RULE_expression);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 668;
            this.ternaryExpression();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public ternaryExpression(): TernaryExpressionContext {
        let localContext = new TernaryExpressionContext(this.context, this.state);
        this.enterRule(localContext, 110, CnxParser.RULE_ternaryExpression);
        try {
            this.state = 679;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 68, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 670;
                this.match(CnxParser.LPAREN);
                this.state = 671;
                this.orExpression();
                this.state = 672;
                this.match(CnxParser.RPAREN);
                this.state = 673;
                this.match(CnxParser.T__0);
                this.state = 674;
                this.orExpression();
                this.state = 675;
                this.match(CnxParser.COLON);
                this.state = 676;
                this.orExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 678;
                this.orExpression();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public orExpression(): OrExpressionContext {
        let localContext = new OrExpressionContext(this.context, this.state);
        this.enterRule(localContext, 112, CnxParser.RULE_orExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 681;
            this.andExpression();
            this.state = 686;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 90) {
                {
                {
                this.state = 682;
                this.match(CnxParser.OR);
                this.state = 683;
                this.andExpression();
                }
                }
                this.state = 688;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public andExpression(): AndExpressionContext {
        let localContext = new AndExpressionContext(this.context, this.state);
        this.enterRule(localContext, 114, CnxParser.RULE_andExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 689;
            this.equalityExpression();
            this.state = 694;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 89) {
                {
                {
                this.state = 690;
                this.match(CnxParser.AND);
                this.state = 691;
                this.equalityExpression();
                }
                }
                this.state = 696;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public equalityExpression(): EqualityExpressionContext {
        let localContext = new EqualityExpressionContext(this.context, this.state);
        this.enterRule(localContext, 116, CnxParser.RULE_equalityExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 697;
            this.relationalExpression();
            this.state = 702;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 78 || _la === 79) {
                {
                {
                this.state = 698;
                _la = this.tokenStream.LA(1);
                if(!(_la === 78 || _la === 79)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 699;
                this.relationalExpression();
                }
                }
                this.state = 704;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public relationalExpression(): RelationalExpressionContext {
        let localContext = new RelationalExpressionContext(this.context, this.state);
        this.enterRule(localContext, 118, CnxParser.RULE_relationalExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 705;
            this.bitwiseOrExpression();
            this.state = 710;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 15) !== 0)) {
                {
                {
                this.state = 706;
                _la = this.tokenStream.LA(1);
                if(!(((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 15) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 707;
                this.bitwiseOrExpression();
                }
                }
                this.state = 712;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public bitwiseOrExpression(): BitwiseOrExpressionContext {
        let localContext = new BitwiseOrExpressionContext(this.context, this.state);
        this.enterRule(localContext, 120, CnxParser.RULE_bitwiseOrExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 713;
            this.bitwiseXorExpression();
            this.state = 718;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 93) {
                {
                {
                this.state = 714;
                this.match(CnxParser.BITOR);
                this.state = 715;
                this.bitwiseXorExpression();
                }
                }
                this.state = 720;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public bitwiseXorExpression(): BitwiseXorExpressionContext {
        let localContext = new BitwiseXorExpressionContext(this.context, this.state);
        this.enterRule(localContext, 122, CnxParser.RULE_bitwiseXorExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 721;
            this.bitwiseAndExpression();
            this.state = 726;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 94) {
                {
                {
                this.state = 722;
                this.match(CnxParser.BITXOR);
                this.state = 723;
                this.bitwiseAndExpression();
                }
                }
                this.state = 728;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public bitwiseAndExpression(): BitwiseAndExpressionContext {
        let localContext = new BitwiseAndExpressionContext(this.context, this.state);
        this.enterRule(localContext, 124, CnxParser.RULE_bitwiseAndExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 729;
            this.shiftExpression();
            this.state = 734;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 92) {
                {
                {
                this.state = 730;
                this.match(CnxParser.BITAND);
                this.state = 731;
                this.shiftExpression();
                }
                }
                this.state = 736;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public shiftExpression(): ShiftExpressionContext {
        let localContext = new ShiftExpressionContext(this.context, this.state);
        this.enterRule(localContext, 126, CnxParser.RULE_shiftExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 737;
            this.additiveExpression();
            this.state = 742;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 96 || _la === 97) {
                {
                {
                this.state = 738;
                _la = this.tokenStream.LA(1);
                if(!(_la === 96 || _la === 97)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 739;
                this.additiveExpression();
                }
                }
                this.state = 744;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public additiveExpression(): AdditiveExpressionContext {
        let localContext = new AdditiveExpressionContext(this.context, this.state);
        this.enterRule(localContext, 128, CnxParser.RULE_additiveExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 745;
            this.multiplicativeExpression();
            this.state = 750;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 84 || _la === 85) {
                {
                {
                this.state = 746;
                _la = this.tokenStream.LA(1);
                if(!(_la === 84 || _la === 85)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 747;
                this.multiplicativeExpression();
                }
                }
                this.state = 752;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public multiplicativeExpression(): MultiplicativeExpressionContext {
        let localContext = new MultiplicativeExpressionContext(this.context, this.state);
        this.enterRule(localContext, 130, CnxParser.RULE_multiplicativeExpression);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 753;
            this.unaryExpression();
            this.state = 758;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 78, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 754;
                    _la = this.tokenStream.LA(1);
                    if(!(((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 7) !== 0))) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 755;
                    this.unaryExpression();
                    }
                    }
                }
                this.state = 760;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 78, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public unaryExpression(): UnaryExpressionContext {
        let localContext = new UnaryExpressionContext(this.context, this.state);
        this.enterRule(localContext, 132, CnxParser.RULE_unaryExpression);
        try {
            this.state = 768;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.NOT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 761;
                this.match(CnxParser.NOT);
                this.state = 762;
                this.unaryExpression();
                }
                break;
            case CnxParser.MINUS:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 763;
                this.match(CnxParser.MINUS);
                this.state = 764;
                this.unaryExpression();
                }
                break;
            case CnxParser.BITNOT:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 765;
                this.match(CnxParser.BITNOT);
                this.state = 766;
                this.unaryExpression();
                }
                break;
            case CnxParser.THIS:
            case CnxParser.GLOBAL:
            case CnxParser.TRUE:
            case CnxParser.FALSE:
            case CnxParser.C_NULL:
            case CnxParser.SIZEOF:
            case CnxParser.SUFFIXED_FLOAT:
            case CnxParser.SUFFIXED_HEX:
            case CnxParser.SUFFIXED_BINARY:
            case CnxParser.SUFFIXED_DECIMAL:
            case CnxParser.U8:
            case CnxParser.U16:
            case CnxParser.U32:
            case CnxParser.U64:
            case CnxParser.I8:
            case CnxParser.I16:
            case CnxParser.I32:
            case CnxParser.I64:
            case CnxParser.F32:
            case CnxParser.F64:
            case CnxParser.BOOL:
            case CnxParser.ISR_TYPE:
            case CnxParser.LPAREN:
            case CnxParser.LBRACE:
            case CnxParser.LBRACKET:
            case CnxParser.HEX_LITERAL:
            case CnxParser.BINARY_LITERAL:
            case CnxParser.FLOAT_LITERAL:
            case CnxParser.INTEGER_LITERAL:
            case CnxParser.STRING_LITERAL:
            case CnxParser.CHAR_LITERAL:
            case CnxParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 767;
                this.postfixExpression();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public postfixExpression(): PostfixExpressionContext {
        let localContext = new PostfixExpressionContext(this.context, this.state);
        this.enterRule(localContext, 134, CnxParser.RULE_postfixExpression);
        try {
            let alternative: number;
            this.state = 781;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.THIS:
            case CnxParser.GLOBAL:
            case CnxParser.TRUE:
            case CnxParser.FALSE:
            case CnxParser.C_NULL:
            case CnxParser.SIZEOF:
            case CnxParser.SUFFIXED_FLOAT:
            case CnxParser.SUFFIXED_HEX:
            case CnxParser.SUFFIXED_BINARY:
            case CnxParser.SUFFIXED_DECIMAL:
            case CnxParser.LPAREN:
            case CnxParser.LBRACE:
            case CnxParser.LBRACKET:
            case CnxParser.HEX_LITERAL:
            case CnxParser.BINARY_LITERAL:
            case CnxParser.FLOAT_LITERAL:
            case CnxParser.INTEGER_LITERAL:
            case CnxParser.STRING_LITERAL:
            case CnxParser.CHAR_LITERAL:
            case CnxParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 770;
                this.primaryExpression();
                this.state = 774;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 80, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 771;
                        this.postfixOp();
                        }
                        }
                    }
                    this.state = 776;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 80, this.context);
                }
                }
                break;
            case CnxParser.U8:
            case CnxParser.U16:
            case CnxParser.U32:
            case CnxParser.U64:
            case CnxParser.I8:
            case CnxParser.I16:
            case CnxParser.I32:
            case CnxParser.I64:
            case CnxParser.F32:
            case CnxParser.F64:
            case CnxParser.BOOL:
            case CnxParser.ISR_TYPE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 777;
                this.primitiveType();
                this.state = 778;
                this.match(CnxParser.DOT);
                this.state = 779;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public postfixOp(): PostfixOpContext {
        let localContext = new PostfixOpContext(this.context, this.state);
        this.enterRule(localContext, 136, CnxParser.RULE_postfixOp);
        let _la: number;
        try {
            this.state = 798;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.DOT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 783;
                this.match(CnxParser.DOT);
                this.state = 784;
                this.memberName();
                }
                break;
            case CnxParser.LBRACKET:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 785;
                this.match(CnxParser.LBRACKET);
                this.state = 786;
                this.expression();
                this.state = 789;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 105) {
                    {
                    this.state = 787;
                    this.match(CnxParser.COMMA);
                    this.state = 788;
                    this.expression();
                    }
                }

                this.state = 791;
                this.match(CnxParser.RBRACKET);
                }
                break;
            case CnxParser.LPAREN:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 793;
                this.match(CnxParser.LPAREN);
                this.state = 795;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                    {
                    this.state = 794;
                    this.argumentList();
                    }
                }

                this.state = 797;
                this.match(CnxParser.RPAREN);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public primaryExpression(): PrimaryExpressionContext {
        let localContext = new PrimaryExpressionContext(this.context, this.state);
        this.enterRule(localContext, 138, CnxParser.RULE_primaryExpression);
        try {
            this.state = 812;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 85, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 800;
                this.sizeofExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 801;
                this.castExpression();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 802;
                this.structInitializer();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 803;
                this.arrayInitializer();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 804;
                this.match(CnxParser.THIS);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 805;
                this.match(CnxParser.GLOBAL);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 806;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 807;
                this.literal();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 808;
                this.match(CnxParser.LPAREN);
                this.state = 809;
                this.expression();
                this.state = 810;
                this.match(CnxParser.RPAREN);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public sizeofExpression(): SizeofExpressionContext {
        let localContext = new SizeofExpressionContext(this.context, this.state);
        this.enterRule(localContext, 140, CnxParser.RULE_sizeofExpression);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 814;
            this.match(CnxParser.SIZEOF);
            this.state = 815;
            this.match(CnxParser.LPAREN);
            this.state = 818;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 86, this.context) ) {
            case 1:
                {
                this.state = 816;
                this.type_();
                }
                break;
            case 2:
                {
                this.state = 817;
                this.expression();
                }
                break;
            }
            this.state = 820;
            this.match(CnxParser.RPAREN);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public castExpression(): CastExpressionContext {
        let localContext = new CastExpressionContext(this.context, this.state);
        this.enterRule(localContext, 142, CnxParser.RULE_castExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 822;
            this.match(CnxParser.LPAREN);
            this.state = 824;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 823;
                this.overflowModifier();
                }
            }

            this.state = 826;
            this.type_();
            this.state = 827;
            this.match(CnxParser.RPAREN);
            this.state = 828;
            this.unaryExpression();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structInitializer(): StructInitializerContext {
        let localContext = new StructInitializerContext(this.context, this.state);
        this.enterRule(localContext, 144, CnxParser.RULE_structInitializer);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 830;
            this.match(CnxParser.LBRACE);
            this.state = 831;
            this.fieldInitializerList();
            this.state = 832;
            this.match(CnxParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public fieldInitializerList(): FieldInitializerListContext {
        let localContext = new FieldInitializerListContext(this.context, this.state);
        this.enterRule(localContext, 146, CnxParser.RULE_fieldInitializerList);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 834;
            this.fieldInitializer();
            this.state = 839;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 88, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 835;
                    this.match(CnxParser.COMMA);
                    this.state = 836;
                    this.fieldInitializer();
                    }
                    }
                }
                this.state = 841;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 88, this.context);
            }
            this.state = 843;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 842;
                this.match(CnxParser.COMMA);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public fieldInitializer(): FieldInitializerContext {
        let localContext = new FieldInitializerContext(this.context, this.state);
        this.enterRule(localContext, 148, CnxParser.RULE_fieldInitializer);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 845;
            this.match(CnxParser.IDENTIFIER);
            this.state = 846;
            this.match(CnxParser.COLON);
            this.state = 847;
            this.expression();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public arrayInitializer(): ArrayInitializerContext {
        let localContext = new ArrayInitializerContext(this.context, this.state);
        this.enterRule(localContext, 150, CnxParser.RULE_arrayInitializer);
        let _la: number;
        try {
            let alternative: number;
            this.state = 868;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 92, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 849;
                this.match(CnxParser.LBRACKET);
                this.state = 850;
                this.arrayInitializerElement();
                this.state = 855;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 90, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 851;
                        this.match(CnxParser.COMMA);
                        this.state = 852;
                        this.arrayInitializerElement();
                        }
                        }
                    }
                    this.state = 857;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 90, this.context);
                }
                this.state = 859;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 105) {
                    {
                    this.state = 858;
                    this.match(CnxParser.COMMA);
                    }
                }

                this.state = 861;
                this.match(CnxParser.RBRACKET);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 863;
                this.match(CnxParser.LBRACKET);
                this.state = 864;
                this.expression();
                this.state = 865;
                this.match(CnxParser.STAR);
                this.state = 866;
                this.match(CnxParser.RBRACKET);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public arrayInitializerElement(): ArrayInitializerElementContext {
        let localContext = new ArrayInitializerElementContext(this.context, this.state);
        this.enterRule(localContext, 152, CnxParser.RULE_arrayInitializerElement);
        try {
            this.state = 873;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 93, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 870;
                this.expression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 871;
                this.structInitializer();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 872;
                this.arrayInitializer();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public argumentList(): ArgumentListContext {
        let localContext = new ArgumentListContext(this.context, this.state);
        this.enterRule(localContext, 154, CnxParser.RULE_argumentList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 875;
            this.expression();
            this.state = 880;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 876;
                this.match(CnxParser.COMMA);
                this.state = 877;
                this.expression();
                }
                }
                this.state = 882;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public type_(): TypeContext {
        let localContext = new TypeContext(this.context, this.state);
        this.enterRule(localContext, 156, CnxParser.RULE_type);
        try {
            this.state = 892;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 95, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 883;
                this.primitiveType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 884;
                this.stringType();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 885;
                this.scopedType();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 886;
                this.globalType();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 887;
                this.qualifiedType();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 888;
                this.templateType();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 889;
                this.userType();
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 890;
                this.arrayType();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 891;
                this.match(CnxParser.VOID);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public scopedType(): ScopedTypeContext {
        let localContext = new ScopedTypeContext(this.context, this.state);
        this.enterRule(localContext, 158, CnxParser.RULE_scopedType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 894;
            this.match(CnxParser.THIS);
            this.state = 895;
            this.match(CnxParser.DOT);
            this.state = 896;
            this.match(CnxParser.IDENTIFIER);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public globalType(): GlobalTypeContext {
        let localContext = new GlobalTypeContext(this.context, this.state);
        this.enterRule(localContext, 160, CnxParser.RULE_globalType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 898;
            this.match(CnxParser.GLOBAL);
            this.state = 899;
            this.match(CnxParser.DOT);
            this.state = 900;
            this.match(CnxParser.IDENTIFIER);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public qualifiedType(): QualifiedTypeContext {
        let localContext = new QualifiedTypeContext(this.context, this.state);
        this.enterRule(localContext, 162, CnxParser.RULE_qualifiedType);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 902;
            this.match(CnxParser.IDENTIFIER);
            this.state = 905;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 903;
                this.match(CnxParser.DOT);
                this.state = 904;
                this.match(CnxParser.IDENTIFIER);
                }
                }
                this.state = 907;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 106);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public primitiveType(): PrimitiveTypeContext {
        let localContext = new PrimitiveTypeContext(this.context, this.state);
        this.enterRule(localContext, 164, CnxParser.RULE_primitiveType);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 909;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 4095) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public userType(): UserTypeContext {
        let localContext = new UserTypeContext(this.context, this.state);
        this.enterRule(localContext, 166, CnxParser.RULE_userType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 911;
            this.match(CnxParser.IDENTIFIER);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public templateType(): TemplateTypeContext {
        let localContext = new TemplateTypeContext(this.context, this.state);
        this.enterRule(localContext, 168, CnxParser.RULE_templateType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 913;
            this.match(CnxParser.IDENTIFIER);
            this.state = 914;
            this.match(CnxParser.LT);
            this.state = 915;
            this.templateArgumentList();
            this.state = 916;
            this.match(CnxParser.GT);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public templateArgumentList(): TemplateArgumentListContext {
        let localContext = new TemplateArgumentListContext(this.context, this.state);
        this.enterRule(localContext, 170, CnxParser.RULE_templateArgumentList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 918;
            this.templateArgument();
            this.state = 923;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 919;
                this.match(CnxParser.COMMA);
                this.state = 920;
                this.templateArgument();
                }
                }
                this.state = 925;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public templateArgument(): TemplateArgumentContext {
        let localContext = new TemplateArgumentContext(this.context, this.state);
        this.enterRule(localContext, 172, CnxParser.RULE_templateArgument);
        try {
            this.state = 930;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 98, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 926;
                this.templateType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 927;
                this.primitiveType();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 928;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 929;
                this.match(CnxParser.INTEGER_LITERAL);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public stringType(): StringTypeContext {
        let localContext = new StringTypeContext(this.context, this.state);
        this.enterRule(localContext, 174, CnxParser.RULE_stringType);
        try {
            this.state = 937;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 99, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 932;
                this.match(CnxParser.STRING);
                this.state = 933;
                this.match(CnxParser.LT);
                this.state = 934;
                this.match(CnxParser.INTEGER_LITERAL);
                this.state = 935;
                this.match(CnxParser.GT);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 936;
                this.match(CnxParser.STRING);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public arrayType(): ArrayTypeContext {
        let localContext = new ArrayTypeContext(this.context, this.state);
        this.enterRule(localContext, 176, CnxParser.RULE_arrayType);
        let _la: number;
        try {
            this.state = 975;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 106, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 939;
                this.primitiveType();
                this.state = 941;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 940;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 943;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 945;
                this.userType();
                this.state = 947;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 946;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 949;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 951;
                this.stringType();
                this.state = 953;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 952;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 955;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 957;
                this.scopedType();
                this.state = 959;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 958;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 961;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 963;
                this.qualifiedType();
                this.state = 965;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 964;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 967;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 969;
                this.globalType();
                this.state = 971;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 970;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 973;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public arrayTypeDimension(): ArrayTypeDimensionContext {
        let localContext = new ArrayTypeDimensionContext(this.context, this.state);
        this.enterRule(localContext, 178, CnxParser.RULE_arrayTypeDimension);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 977;
            this.match(CnxParser.LBRACKET);
            this.state = 979;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                {
                this.state = 978;
                this.expression();
                }
            }

            this.state = 981;
            this.match(CnxParser.RBRACKET);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public literal(): LiteralContext {
        let localContext = new LiteralContext(this.context, this.state);
        this.enterRule(localContext, 180, CnxParser.RULE_literal);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 983;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3932167) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 63) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public static readonly _serializedATN: number[] = [
        4,1,119,986,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,
        7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,
        13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
        20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,
        26,2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,
        33,7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,
        39,2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,
        46,7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,2,51,7,51,2,52,7,
        52,2,53,7,53,2,54,7,54,2,55,7,55,2,56,7,56,2,57,7,57,2,58,7,58,2,
        59,7,59,2,60,7,60,2,61,7,61,2,62,7,62,2,63,7,63,2,64,7,64,2,65,7,
        65,2,66,7,66,2,67,7,67,2,68,7,68,2,69,7,69,2,70,7,70,2,71,7,71,2,
        72,7,72,2,73,7,73,2,74,7,74,2,75,7,75,2,76,7,76,2,77,7,77,2,78,7,
        78,2,79,7,79,2,80,7,80,2,81,7,81,2,82,7,82,2,83,7,83,2,84,7,84,2,
        85,7,85,2,86,7,86,2,87,7,87,2,88,7,88,2,89,7,89,2,90,7,90,1,0,1,
        0,5,0,185,8,0,10,0,12,0,188,9,0,1,0,5,0,191,8,0,10,0,12,0,194,9,
        0,1,0,1,0,1,1,1,1,1,2,1,2,1,2,3,2,203,8,2,1,3,1,3,1,4,1,4,1,5,1,
        5,1,6,1,6,1,6,1,6,1,6,1,6,1,6,3,6,218,8,6,1,7,1,7,1,7,1,7,5,7,224,
        8,7,10,7,12,7,227,9,7,1,7,1,7,1,8,3,8,232,8,8,1,8,1,8,3,8,236,8,
        8,1,8,1,8,3,8,240,8,8,1,8,1,8,3,8,244,8,8,1,8,1,8,3,8,248,8,8,1,
        8,1,8,3,8,252,8,8,1,8,3,8,255,8,8,1,9,1,9,1,10,1,10,1,10,1,10,1,
        10,1,10,5,10,265,8,10,10,10,12,10,268,9,10,1,10,3,10,271,8,10,1,
        10,1,10,1,11,1,11,1,11,1,11,1,11,1,12,1,12,1,13,1,13,1,14,1,14,1,
        14,1,14,5,14,288,8,14,10,14,12,14,291,9,14,1,14,1,14,1,15,3,15,296,
        8,15,1,15,1,15,1,15,5,15,301,8,15,10,15,12,15,304,9,15,1,15,1,15,
        1,16,1,16,1,16,1,16,1,16,1,16,5,16,314,8,16,10,16,12,16,317,9,16,
        1,16,3,16,320,8,16,1,16,1,16,1,17,1,17,1,17,3,17,327,8,17,1,18,1,
        18,1,18,1,18,1,18,1,18,5,18,335,8,18,10,18,12,18,338,9,18,1,18,3,
        18,341,8,18,1,18,1,18,1,19,1,19,1,20,1,20,1,20,1,20,3,20,351,8,20,
        1,21,3,21,354,8,21,1,21,1,21,1,21,1,21,3,21,360,8,21,1,21,1,21,1,
        21,1,22,1,22,1,22,5,22,368,8,22,10,22,12,22,371,9,22,1,23,3,23,374,
        8,23,1,23,3,23,377,8,23,1,23,1,23,1,23,5,23,382,8,23,10,23,12,23,
        385,9,23,1,24,1,24,1,25,1,25,1,26,1,26,1,27,1,27,1,28,1,28,1,29,
        1,29,3,29,399,8,29,1,29,1,29,1,30,3,30,404,8,30,1,30,3,30,407,8,
        30,1,30,3,30,410,8,30,1,30,3,30,413,8,30,1,30,3,30,416,8,30,1,30,
        1,30,1,30,5,30,421,8,30,10,30,12,30,424,9,30,1,30,1,30,3,30,428,
        8,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,
        1,30,1,30,1,30,1,30,3,30,446,8,30,1,31,1,31,1,31,5,31,451,8,31,10,
        31,12,31,454,9,31,1,32,1,32,5,32,458,8,32,10,32,12,32,461,9,32,1,
        32,1,32,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,
        33,3,33,477,8,33,1,34,1,34,1,34,1,35,1,35,1,35,1,35,1,35,1,36,1,
        36,1,37,1,37,1,37,1,37,5,37,493,8,37,10,37,12,37,496,9,37,1,37,1,
        37,1,37,1,37,5,37,502,8,37,10,37,12,37,505,9,37,1,37,1,37,5,37,509,
        8,37,10,37,12,37,512,9,37,3,37,514,8,37,1,38,1,38,1,38,1,38,1,38,
        1,38,3,38,522,8,38,1,38,1,38,3,38,526,8,38,1,39,1,39,1,39,1,40,1,
        40,1,40,1,40,1,40,1,40,1,40,3,40,538,8,40,1,41,1,41,1,41,1,41,1,
        41,1,41,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,43,1,43,1,43,3,
        43,557,8,43,1,43,1,43,3,43,561,8,43,1,43,1,43,3,43,565,8,43,1,43,
        1,43,1,43,1,44,1,44,1,44,1,45,1,45,3,45,575,8,45,1,46,3,46,578,8,
        46,1,46,3,46,581,8,46,1,46,3,46,584,8,46,1,46,3,46,587,8,46,1,46,
        1,46,1,46,5,46,592,8,46,10,46,12,46,595,9,46,1,46,1,46,3,46,599,
        8,46,1,47,1,47,1,47,1,47,1,48,1,48,1,48,1,48,1,49,1,49,3,49,611,
        8,49,1,49,1,49,1,50,1,50,1,50,1,50,1,50,1,50,4,50,621,8,50,11,50,
        12,50,622,1,50,3,50,626,8,50,1,50,1,50,1,51,1,51,1,51,1,51,5,51,
        634,8,51,10,51,12,51,637,9,51,1,51,1,51,1,52,1,52,1,52,1,52,1,52,
        3,52,646,8,52,1,52,1,52,3,52,650,8,52,1,52,1,52,3,52,654,8,52,1,
        52,1,52,1,52,3,52,659,8,52,1,53,1,53,1,53,1,53,3,53,665,8,53,1,53,
        1,53,1,54,1,54,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,3,55,
        680,8,55,1,56,1,56,1,56,5,56,685,8,56,10,56,12,56,688,9,56,1,57,
        1,57,1,57,5,57,693,8,57,10,57,12,57,696,9,57,1,58,1,58,1,58,5,58,
        701,8,58,10,58,12,58,704,9,58,1,59,1,59,1,59,5,59,709,8,59,10,59,
        12,59,712,9,59,1,60,1,60,1,60,5,60,717,8,60,10,60,12,60,720,9,60,
        1,61,1,61,1,61,5,61,725,8,61,10,61,12,61,728,9,61,1,62,1,62,1,62,
        5,62,733,8,62,10,62,12,62,736,9,62,1,63,1,63,1,63,5,63,741,8,63,
        10,63,12,63,744,9,63,1,64,1,64,1,64,5,64,749,8,64,10,64,12,64,752,
        9,64,1,65,1,65,1,65,5,65,757,8,65,10,65,12,65,760,9,65,1,66,1,66,
        1,66,1,66,1,66,1,66,1,66,3,66,769,8,66,1,67,1,67,5,67,773,8,67,10,
        67,12,67,776,9,67,1,67,1,67,1,67,1,67,3,67,782,8,67,1,68,1,68,1,
        68,1,68,1,68,1,68,3,68,790,8,68,1,68,1,68,1,68,1,68,3,68,796,8,68,
        1,68,3,68,799,8,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,
        1,69,1,69,1,69,3,69,813,8,69,1,70,1,70,1,70,1,70,3,70,819,8,70,1,
        70,1,70,1,71,1,71,3,71,825,8,71,1,71,1,71,1,71,1,71,1,72,1,72,1,
        72,1,72,1,73,1,73,1,73,5,73,838,8,73,10,73,12,73,841,9,73,1,73,3,
        73,844,8,73,1,74,1,74,1,74,1,74,1,75,1,75,1,75,1,75,5,75,854,8,75,
        10,75,12,75,857,9,75,1,75,3,75,860,8,75,1,75,1,75,1,75,1,75,1,75,
        1,75,1,75,3,75,869,8,75,1,76,1,76,1,76,3,76,874,8,76,1,77,1,77,1,
        77,5,77,879,8,77,10,77,12,77,882,9,77,1,78,1,78,1,78,1,78,1,78,1,
        78,1,78,1,78,1,78,3,78,893,8,78,1,79,1,79,1,79,1,79,1,80,1,80,1,
        80,1,80,1,81,1,81,1,81,4,81,906,8,81,11,81,12,81,907,1,82,1,82,1,
        83,1,83,1,84,1,84,1,84,1,84,1,84,1,85,1,85,1,85,5,85,922,8,85,10,
        85,12,85,925,9,85,1,86,1,86,1,86,1,86,3,86,931,8,86,1,87,1,87,1,
        87,1,87,1,87,3,87,938,8,87,1,88,1,88,4,88,942,8,88,11,88,12,88,943,
        1,88,1,88,4,88,948,8,88,11,88,12,88,949,1,88,1,88,4,88,954,8,88,
        11,88,12,88,955,1,88,1,88,4,88,960,8,88,11,88,12,88,961,1,88,1,88,
        4,88,966,8,88,11,88,12,88,967,1,88,1,88,4,88,972,8,88,11,88,12,88,
        973,3,88,976,8,88,1,89,1,89,3,89,980,8,89,1,89,1,89,1,90,1,90,1,
        90,0,0,91,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,
        40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,
        84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,
        120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,
        152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,0,16,
        1,0,3,5,1,0,6,9,1,0,17,18,3,0,11,50,55,66,115,115,1,0,42,46,1,0,
        38,41,1,0,47,48,1,0,67,77,1,0,14,15,1,0,78,79,1,0,80,83,1,0,96,97,
        1,0,84,85,1,0,86,88,1,0,55,66,3,0,33,35,51,54,109,114,1053,0,186,
        1,0,0,0,2,197,1,0,0,0,4,202,1,0,0,0,6,204,1,0,0,0,8,206,1,0,0,0,
        10,208,1,0,0,0,12,217,1,0,0,0,14,219,1,0,0,0,16,254,1,0,0,0,18,256,
        1,0,0,0,20,258,1,0,0,0,22,274,1,0,0,0,24,279,1,0,0,0,26,281,1,0,
        0,0,28,283,1,0,0,0,30,295,1,0,0,0,32,307,1,0,0,0,34,323,1,0,0,0,
        36,328,1,0,0,0,38,344,1,0,0,0,40,346,1,0,0,0,42,353,1,0,0,0,44,364,
        1,0,0,0,46,373,1,0,0,0,48,386,1,0,0,0,50,388,1,0,0,0,52,390,1,0,
        0,0,54,392,1,0,0,0,56,394,1,0,0,0,58,396,1,0,0,0,60,445,1,0,0,0,
        62,447,1,0,0,0,64,455,1,0,0,0,66,476,1,0,0,0,68,478,1,0,0,0,70,481,
        1,0,0,0,72,486,1,0,0,0,74,513,1,0,0,0,76,525,1,0,0,0,78,527,1,0,
        0,0,80,530,1,0,0,0,82,539,1,0,0,0,84,545,1,0,0,0,86,553,1,0,0,0,
        88,569,1,0,0,0,90,574,1,0,0,0,92,577,1,0,0,0,94,600,1,0,0,0,96,604,
        1,0,0,0,98,608,1,0,0,0,100,614,1,0,0,0,102,629,1,0,0,0,104,658,1,
        0,0,0,106,660,1,0,0,0,108,668,1,0,0,0,110,679,1,0,0,0,112,681,1,
        0,0,0,114,689,1,0,0,0,116,697,1,0,0,0,118,705,1,0,0,0,120,713,1,
        0,0,0,122,721,1,0,0,0,124,729,1,0,0,0,126,737,1,0,0,0,128,745,1,
        0,0,0,130,753,1,0,0,0,132,768,1,0,0,0,134,781,1,0,0,0,136,798,1,
        0,0,0,138,812,1,0,0,0,140,814,1,0,0,0,142,822,1,0,0,0,144,830,1,
        0,0,0,146,834,1,0,0,0,148,845,1,0,0,0,150,868,1,0,0,0,152,873,1,
        0,0,0,154,875,1,0,0,0,156,892,1,0,0,0,158,894,1,0,0,0,160,898,1,
        0,0,0,162,902,1,0,0,0,164,909,1,0,0,0,166,911,1,0,0,0,168,913,1,
        0,0,0,170,918,1,0,0,0,172,930,1,0,0,0,174,937,1,0,0,0,176,975,1,
        0,0,0,178,977,1,0,0,0,180,983,1,0,0,0,182,185,3,2,1,0,183,185,3,
        4,2,0,184,182,1,0,0,0,184,183,1,0,0,0,185,188,1,0,0,0,186,184,1,
        0,0,0,186,187,1,0,0,0,187,192,1,0,0,0,188,186,1,0,0,0,189,191,3,
        12,6,0,190,189,1,0,0,0,191,194,1,0,0,0,192,190,1,0,0,0,192,193,1,
        0,0,0,193,195,1,0,0,0,194,192,1,0,0,0,195,196,5,0,0,1,196,1,1,0,
        0,0,197,198,5,2,0,0,198,3,1,0,0,0,199,203,3,6,3,0,200,203,3,8,4,
        0,201,203,3,10,5,0,202,199,1,0,0,0,202,200,1,0,0,0,202,201,1,0,0,
        0,203,5,1,0,0,0,204,205,7,0,0,0,205,7,1,0,0,0,206,207,7,1,0,0,207,
        9,1,0,0,0,208,209,5,10,0,0,209,11,1,0,0,0,210,218,3,14,7,0,211,218,
        3,20,10,0,212,218,3,28,14,0,213,218,3,32,16,0,214,218,3,36,18,0,
        215,218,3,42,21,0,216,218,3,60,30,0,217,210,1,0,0,0,217,211,1,0,
        0,0,217,212,1,0,0,0,217,213,1,0,0,0,217,214,1,0,0,0,217,215,1,0,
        0,0,217,216,1,0,0,0,218,13,1,0,0,0,219,220,5,11,0,0,220,221,5,115,
        0,0,221,225,5,100,0,0,222,224,3,16,8,0,223,222,1,0,0,0,224,227,1,
        0,0,0,225,223,1,0,0,0,225,226,1,0,0,0,226,228,1,0,0,0,227,225,1,
        0,0,0,228,229,5,101,0,0,229,15,1,0,0,0,230,232,3,18,9,0,231,230,
        1,0,0,0,231,232,1,0,0,0,232,233,1,0,0,0,233,255,3,60,30,0,234,236,
        3,18,9,0,235,234,1,0,0,0,235,236,1,0,0,0,236,237,1,0,0,0,237,255,
        3,42,21,0,238,240,3,18,9,0,239,238,1,0,0,0,239,240,1,0,0,0,240,241,
        1,0,0,0,241,255,3,32,16,0,242,244,3,18,9,0,243,242,1,0,0,0,243,244,
        1,0,0,0,244,245,1,0,0,0,245,255,3,36,18,0,246,248,3,18,9,0,247,246,
        1,0,0,0,247,248,1,0,0,0,248,249,1,0,0,0,249,255,3,20,10,0,250,252,
        3,18,9,0,251,250,1,0,0,0,251,252,1,0,0,0,252,253,1,0,0,0,253,255,
        3,28,14,0,254,231,1,0,0,0,254,235,1,0,0,0,254,239,1,0,0,0,254,243,
        1,0,0,0,254,247,1,0,0,0,254,251,1,0,0,0,255,17,1,0,0,0,256,257,7,
        2,0,0,257,19,1,0,0,0,258,259,5,16,0,0,259,260,5,115,0,0,260,261,
        5,100,0,0,261,266,3,22,11,0,262,263,5,105,0,0,263,265,3,22,11,0,
        264,262,1,0,0,0,265,268,1,0,0,0,266,264,1,0,0,0,266,267,1,0,0,0,
        267,270,1,0,0,0,268,266,1,0,0,0,269,271,5,105,0,0,270,269,1,0,0,
        0,270,271,1,0,0,0,271,272,1,0,0,0,272,273,5,101,0,0,273,21,1,0,0,
        0,274,275,3,108,54,0,275,276,3,26,13,0,276,277,3,156,78,0,277,278,
        3,24,12,0,278,23,1,0,0,0,279,280,7,3,0,0,280,25,1,0,0,0,281,282,
        7,4,0,0,282,27,1,0,0,0,283,284,5,12,0,0,284,285,5,115,0,0,285,289,
        5,100,0,0,286,288,3,30,15,0,287,286,1,0,0,0,288,291,1,0,0,0,289,
        287,1,0,0,0,289,290,1,0,0,0,290,292,1,0,0,0,291,289,1,0,0,0,292,
        293,5,101,0,0,293,29,1,0,0,0,294,296,3,54,27,0,295,294,1,0,0,0,295,
        296,1,0,0,0,296,297,1,0,0,0,297,298,3,156,78,0,298,302,3,24,12,0,
        299,301,3,58,29,0,300,299,1,0,0,0,301,304,1,0,0,0,302,300,1,0,0,
        0,302,303,1,0,0,0,303,305,1,0,0,0,304,302,1,0,0,0,305,306,5,104,
        0,0,306,31,1,0,0,0,307,308,5,13,0,0,308,309,5,115,0,0,309,310,5,
        100,0,0,310,315,3,34,17,0,311,312,5,105,0,0,312,314,3,34,17,0,313,
        311,1,0,0,0,314,317,1,0,0,0,315,313,1,0,0,0,315,316,1,0,0,0,316,
        319,1,0,0,0,317,315,1,0,0,0,318,320,5,105,0,0,319,318,1,0,0,0,319,
        320,1,0,0,0,320,321,1,0,0,0,321,322,5,101,0,0,322,33,1,0,0,0,323,
        326,5,115,0,0,324,325,5,77,0,0,325,327,3,108,54,0,326,324,1,0,0,
        0,326,327,1,0,0,0,327,35,1,0,0,0,328,329,3,38,19,0,329,330,5,115,
        0,0,330,331,5,100,0,0,331,336,3,40,20,0,332,333,5,105,0,0,333,335,
        3,40,20,0,334,332,1,0,0,0,335,338,1,0,0,0,336,334,1,0,0,0,336,337,
        1,0,0,0,337,340,1,0,0,0,338,336,1,0,0,0,339,341,5,105,0,0,340,339,
        1,0,0,0,340,341,1,0,0,0,341,342,1,0,0,0,342,343,5,101,0,0,343,37,
        1,0,0,0,344,345,7,5,0,0,345,39,1,0,0,0,346,350,3,24,12,0,347,348,
        5,102,0,0,348,349,5,112,0,0,349,351,5,103,0,0,350,347,1,0,0,0,350,
        351,1,0,0,0,351,41,1,0,0,0,352,354,3,54,27,0,353,352,1,0,0,0,353,
        354,1,0,0,0,354,355,1,0,0,0,355,356,3,156,78,0,356,357,5,115,0,0,
        357,359,5,98,0,0,358,360,3,44,22,0,359,358,1,0,0,0,359,360,1,0,0,
        0,360,361,1,0,0,0,361,362,5,99,0,0,362,363,3,64,32,0,363,43,1,0,
        0,0,364,369,3,46,23,0,365,366,5,105,0,0,366,368,3,46,23,0,367,365,
        1,0,0,0,368,371,1,0,0,0,369,367,1,0,0,0,369,370,1,0,0,0,370,45,1,
        0,0,0,371,369,1,0,0,0,372,374,3,48,24,0,373,372,1,0,0,0,373,374,
        1,0,0,0,374,376,1,0,0,0,375,377,3,50,25,0,376,375,1,0,0,0,376,377,
        1,0,0,0,377,378,1,0,0,0,378,379,3,156,78,0,379,383,5,115,0,0,380,
        382,3,58,29,0,381,380,1,0,0,0,382,385,1,0,0,0,383,381,1,0,0,0,383,
        384,1,0,0,0,384,47,1,0,0,0,385,383,1,0,0,0,386,387,5,19,0,0,387,
        49,1,0,0,0,388,389,5,20,0,0,389,51,1,0,0,0,390,391,5,21,0,0,391,
        53,1,0,0,0,392,393,7,6,0,0,393,55,1,0,0,0,394,395,5,49,0,0,395,57,
        1,0,0,0,396,398,5,102,0,0,397,399,3,108,54,0,398,397,1,0,0,0,398,
        399,1,0,0,0,399,400,1,0,0,0,400,401,5,103,0,0,401,59,1,0,0,0,402,
        404,3,56,28,0,403,402,1,0,0,0,403,404,1,0,0,0,404,406,1,0,0,0,405,
        407,3,52,26,0,406,405,1,0,0,0,406,407,1,0,0,0,407,409,1,0,0,0,408,
        410,3,48,24,0,409,408,1,0,0,0,409,410,1,0,0,0,410,412,1,0,0,0,411,
        413,3,50,25,0,412,411,1,0,0,0,412,413,1,0,0,0,413,415,1,0,0,0,414,
        416,3,54,27,0,415,414,1,0,0,0,415,416,1,0,0,0,416,417,1,0,0,0,417,
        418,3,156,78,0,418,422,5,115,0,0,419,421,3,58,29,0,420,419,1,0,0,
        0,421,424,1,0,0,0,422,420,1,0,0,0,422,423,1,0,0,0,423,427,1,0,0,
        0,424,422,1,0,0,0,425,426,5,77,0,0,426,428,3,108,54,0,427,425,1,
        0,0,0,427,428,1,0,0,0,428,429,1,0,0,0,429,430,5,104,0,0,430,446,
        1,0,0,0,431,432,3,156,78,0,432,433,5,115,0,0,433,434,5,98,0,0,434,
        435,3,62,31,0,435,436,5,99,0,0,436,437,5,104,0,0,437,446,1,0,0,0,
        438,439,3,156,78,0,439,440,5,115,0,0,440,441,5,98,0,0,441,442,3,
        108,54,0,442,443,5,99,0,0,443,444,5,104,0,0,444,446,1,0,0,0,445,
        403,1,0,0,0,445,431,1,0,0,0,445,438,1,0,0,0,446,61,1,0,0,0,447,452,
        5,115,0,0,448,449,5,105,0,0,449,451,5,115,0,0,450,448,1,0,0,0,451,
        454,1,0,0,0,452,450,1,0,0,0,452,453,1,0,0,0,453,63,1,0,0,0,454,452,
        1,0,0,0,455,459,5,100,0,0,456,458,3,66,33,0,457,456,1,0,0,0,458,
        461,1,0,0,0,459,457,1,0,0,0,459,460,1,0,0,0,460,462,1,0,0,0,461,
        459,1,0,0,0,462,463,5,101,0,0,463,65,1,0,0,0,464,477,3,60,30,0,465,
        477,3,70,35,0,466,477,3,78,39,0,467,477,3,80,40,0,468,477,3,82,41,
        0,469,477,3,84,42,0,470,477,3,86,43,0,471,477,3,88,44,0,472,477,
        3,100,50,0,473,477,3,98,49,0,474,477,3,68,34,0,475,477,3,64,32,0,
        476,464,1,0,0,0,476,465,1,0,0,0,476,466,1,0,0,0,476,467,1,0,0,0,
        476,468,1,0,0,0,476,469,1,0,0,0,476,470,1,0,0,0,476,471,1,0,0,0,
        476,472,1,0,0,0,476,473,1,0,0,0,476,474,1,0,0,0,476,475,1,0,0,0,
        477,67,1,0,0,0,478,479,5,50,0,0,479,480,3,64,32,0,480,69,1,0,0,0,
        481,482,3,74,37,0,482,483,3,72,36,0,483,484,3,108,54,0,484,485,5,
        104,0,0,485,71,1,0,0,0,486,487,7,7,0,0,487,73,1,0,0,0,488,489,5,
        15,0,0,489,490,5,106,0,0,490,494,5,115,0,0,491,493,3,76,38,0,492,
        491,1,0,0,0,493,496,1,0,0,0,494,492,1,0,0,0,494,495,1,0,0,0,495,
        514,1,0,0,0,496,494,1,0,0,0,497,498,5,14,0,0,498,499,5,106,0,0,499,
        503,5,115,0,0,500,502,3,76,38,0,501,500,1,0,0,0,502,505,1,0,0,0,
        503,501,1,0,0,0,503,504,1,0,0,0,504,514,1,0,0,0,505,503,1,0,0,0,
        506,510,5,115,0,0,507,509,3,76,38,0,508,507,1,0,0,0,509,512,1,0,
        0,0,510,508,1,0,0,0,510,511,1,0,0,0,511,514,1,0,0,0,512,510,1,0,
        0,0,513,488,1,0,0,0,513,497,1,0,0,0,513,506,1,0,0,0,514,75,1,0,0,
        0,515,516,5,106,0,0,516,526,3,24,12,0,517,518,5,102,0,0,518,521,
        3,108,54,0,519,520,5,105,0,0,520,522,3,108,54,0,521,519,1,0,0,0,
        521,522,1,0,0,0,522,523,1,0,0,0,523,524,5,103,0,0,524,526,1,0,0,
        0,525,515,1,0,0,0,525,517,1,0,0,0,526,77,1,0,0,0,527,528,3,108,54,
        0,528,529,5,104,0,0,529,79,1,0,0,0,530,531,5,23,0,0,531,532,5,98,
        0,0,532,533,3,108,54,0,533,534,5,99,0,0,534,537,3,66,33,0,535,536,
        5,24,0,0,536,538,3,66,33,0,537,535,1,0,0,0,537,538,1,0,0,0,538,81,
        1,0,0,0,539,540,5,25,0,0,540,541,5,98,0,0,541,542,3,108,54,0,542,
        543,5,99,0,0,543,544,3,66,33,0,544,83,1,0,0,0,545,546,5,26,0,0,546,
        547,3,64,32,0,547,548,5,25,0,0,548,549,5,98,0,0,549,550,3,108,54,
        0,550,551,5,99,0,0,551,552,5,104,0,0,552,85,1,0,0,0,553,554,5,27,
        0,0,554,556,5,98,0,0,555,557,3,90,45,0,556,555,1,0,0,0,556,557,1,
        0,0,0,557,558,1,0,0,0,558,560,5,104,0,0,559,561,3,108,54,0,560,559,
        1,0,0,0,560,561,1,0,0,0,561,562,1,0,0,0,562,564,5,104,0,0,563,565,
        3,96,48,0,564,563,1,0,0,0,564,565,1,0,0,0,565,566,1,0,0,0,566,567,
        5,99,0,0,567,568,3,66,33,0,568,87,1,0,0,0,569,570,5,28,0,0,570,571,
        3,64,32,0,571,89,1,0,0,0,572,575,3,92,46,0,573,575,3,94,47,0,574,
        572,1,0,0,0,574,573,1,0,0,0,575,91,1,0,0,0,576,578,3,56,28,0,577,
        576,1,0,0,0,577,578,1,0,0,0,578,580,1,0,0,0,579,581,3,52,26,0,580,
        579,1,0,0,0,580,581,1,0,0,0,581,583,1,0,0,0,582,584,3,50,25,0,583,
        582,1,0,0,0,583,584,1,0,0,0,584,586,1,0,0,0,585,587,3,54,27,0,586,
        585,1,0,0,0,586,587,1,0,0,0,587,588,1,0,0,0,588,589,3,156,78,0,589,
        593,5,115,0,0,590,592,3,58,29,0,591,590,1,0,0,0,592,595,1,0,0,0,
        593,591,1,0,0,0,593,594,1,0,0,0,594,598,1,0,0,0,595,593,1,0,0,0,
        596,597,5,77,0,0,597,599,3,108,54,0,598,596,1,0,0,0,598,599,1,0,
        0,0,599,93,1,0,0,0,600,601,3,74,37,0,601,602,3,72,36,0,602,603,3,
        108,54,0,603,95,1,0,0,0,604,605,3,74,37,0,605,606,3,72,36,0,606,
        607,3,108,54,0,607,97,1,0,0,0,608,610,5,32,0,0,609,611,3,108,54,
        0,610,609,1,0,0,0,610,611,1,0,0,0,611,612,1,0,0,0,612,613,5,104,
        0,0,613,99,1,0,0,0,614,615,5,29,0,0,615,616,5,98,0,0,616,617,3,108,
        54,0,617,618,5,99,0,0,618,620,5,100,0,0,619,621,3,102,51,0,620,619,
        1,0,0,0,621,622,1,0,0,0,622,620,1,0,0,0,622,623,1,0,0,0,623,625,
        1,0,0,0,624,626,3,106,53,0,625,624,1,0,0,0,625,626,1,0,0,0,626,627,
        1,0,0,0,627,628,5,101,0,0,628,101,1,0,0,0,629,630,5,30,0,0,630,635,
        3,104,52,0,631,632,5,90,0,0,632,634,3,104,52,0,633,631,1,0,0,0,634,
        637,1,0,0,0,635,633,1,0,0,0,635,636,1,0,0,0,636,638,1,0,0,0,637,
        635,1,0,0,0,638,639,3,64,32,0,639,103,1,0,0,0,640,659,3,162,81,0,
        641,642,7,8,0,0,642,645,5,106,0,0,643,646,3,162,81,0,644,646,5,115,
        0,0,645,643,1,0,0,0,645,644,1,0,0,0,646,659,1,0,0,0,647,659,5,115,
        0,0,648,650,5,85,0,0,649,648,1,0,0,0,649,650,1,0,0,0,650,651,1,0,
        0,0,651,659,5,112,0,0,652,654,5,85,0,0,653,652,1,0,0,0,653,654,1,
        0,0,0,654,655,1,0,0,0,655,659,5,109,0,0,656,659,5,110,0,0,657,659,
        5,114,0,0,658,640,1,0,0,0,658,641,1,0,0,0,658,647,1,0,0,0,658,649,
        1,0,0,0,658,653,1,0,0,0,658,656,1,0,0,0,658,657,1,0,0,0,659,105,
        1,0,0,0,660,664,5,31,0,0,661,662,5,98,0,0,662,663,5,112,0,0,663,
        665,5,99,0,0,664,661,1,0,0,0,664,665,1,0,0,0,665,666,1,0,0,0,666,
        667,3,64,32,0,667,107,1,0,0,0,668,669,3,110,55,0,669,109,1,0,0,0,
        670,671,5,98,0,0,671,672,3,112,56,0,672,673,5,99,0,0,673,674,5,1,
        0,0,674,675,3,112,56,0,675,676,5,108,0,0,676,677,3,112,56,0,677,
        680,1,0,0,0,678,680,3,112,56,0,679,670,1,0,0,0,679,678,1,0,0,0,680,
        111,1,0,0,0,681,686,3,114,57,0,682,683,5,90,0,0,683,685,3,114,57,
        0,684,682,1,0,0,0,685,688,1,0,0,0,686,684,1,0,0,0,686,687,1,0,0,
        0,687,113,1,0,0,0,688,686,1,0,0,0,689,694,3,116,58,0,690,691,5,89,
        0,0,691,693,3,116,58,0,692,690,1,0,0,0,693,696,1,0,0,0,694,692,1,
        0,0,0,694,695,1,0,0,0,695,115,1,0,0,0,696,694,1,0,0,0,697,702,3,
        118,59,0,698,699,7,9,0,0,699,701,3,118,59,0,700,698,1,0,0,0,701,
        704,1,0,0,0,702,700,1,0,0,0,702,703,1,0,0,0,703,117,1,0,0,0,704,
        702,1,0,0,0,705,710,3,120,60,0,706,707,7,10,0,0,707,709,3,120,60,
        0,708,706,1,0,0,0,709,712,1,0,0,0,710,708,1,0,0,0,710,711,1,0,0,
        0,711,119,1,0,0,0,712,710,1,0,0,0,713,718,3,122,61,0,714,715,5,93,
        0,0,715,717,3,122,61,0,716,714,1,0,0,0,717,720,1,0,0,0,718,716,1,
        0,0,0,718,719,1,0,0,0,719,121,1,0,0,0,720,718,1,0,0,0,721,726,3,
        124,62,0,722,723,5,94,0,0,723,725,3,124,62,0,724,722,1,0,0,0,725,
        728,1,0,0,0,726,724,1,0,0,0,726,727,1,0,0,0,727,123,1,0,0,0,728,
        726,1,0,0,0,729,734,3,126,63,0,730,731,5,92,0,0,731,733,3,126,63,
        0,732,730,1,0,0,0,733,736,1,0,0,0,734,732,1,0,0,0,734,735,1,0,0,
        0,735,125,1,0,0,0,736,734,1,0,0,0,737,742,3,128,64,0,738,739,7,11,
        0,0,739,741,3,128,64,0,740,738,1,0,0,0,741,744,1,0,0,0,742,740,1,
        0,0,0,742,743,1,0,0,0,743,127,1,0,0,0,744,742,1,0,0,0,745,750,3,
        130,65,0,746,747,7,12,0,0,747,749,3,130,65,0,748,746,1,0,0,0,749,
        752,1,0,0,0,750,748,1,0,0,0,750,751,1,0,0,0,751,129,1,0,0,0,752,
        750,1,0,0,0,753,758,3,132,66,0,754,755,7,13,0,0,755,757,3,132,66,
        0,756,754,1,0,0,0,757,760,1,0,0,0,758,756,1,0,0,0,758,759,1,0,0,
        0,759,131,1,0,0,0,760,758,1,0,0,0,761,762,5,91,0,0,762,769,3,132,
        66,0,763,764,5,85,0,0,764,769,3,132,66,0,765,766,5,95,0,0,766,769,
        3,132,66,0,767,769,3,134,67,0,768,761,1,0,0,0,768,763,1,0,0,0,768,
        765,1,0,0,0,768,767,1,0,0,0,769,133,1,0,0,0,770,774,3,138,69,0,771,
        773,3,136,68,0,772,771,1,0,0,0,773,776,1,0,0,0,774,772,1,0,0,0,774,
        775,1,0,0,0,775,782,1,0,0,0,776,774,1,0,0,0,777,778,3,164,82,0,778,
        779,5,106,0,0,779,780,5,115,0,0,780,782,1,0,0,0,781,770,1,0,0,0,
        781,777,1,0,0,0,782,135,1,0,0,0,783,784,5,106,0,0,784,799,3,24,12,
        0,785,786,5,102,0,0,786,789,3,108,54,0,787,788,5,105,0,0,788,790,
        3,108,54,0,789,787,1,0,0,0,789,790,1,0,0,0,790,791,1,0,0,0,791,792,
        5,103,0,0,792,799,1,0,0,0,793,795,5,98,0,0,794,796,3,154,77,0,795,
        794,1,0,0,0,795,796,1,0,0,0,796,797,1,0,0,0,797,799,5,99,0,0,798,
        783,1,0,0,0,798,785,1,0,0,0,798,793,1,0,0,0,799,137,1,0,0,0,800,
        813,3,140,70,0,801,813,3,142,71,0,802,813,3,144,72,0,803,813,3,150,
        75,0,804,813,5,14,0,0,805,813,5,15,0,0,806,813,5,115,0,0,807,813,
        3,180,90,0,808,809,5,98,0,0,809,810,3,108,54,0,810,811,5,99,0,0,
        811,813,1,0,0,0,812,800,1,0,0,0,812,801,1,0,0,0,812,802,1,0,0,0,
        812,803,1,0,0,0,812,804,1,0,0,0,812,805,1,0,0,0,812,806,1,0,0,0,
        812,807,1,0,0,0,812,808,1,0,0,0,813,139,1,0,0,0,814,815,5,37,0,0,
        815,818,5,98,0,0,816,819,3,156,78,0,817,819,3,108,54,0,818,816,1,
        0,0,0,818,817,1,0,0,0,819,820,1,0,0,0,820,821,5,99,0,0,821,141,1,
        0,0,0,822,824,5,98,0,0,823,825,3,54,27,0,824,823,1,0,0,0,824,825,
        1,0,0,0,825,826,1,0,0,0,826,827,3,156,78,0,827,828,5,99,0,0,828,
        829,3,132,66,0,829,143,1,0,0,0,830,831,5,100,0,0,831,832,3,146,73,
        0,832,833,5,101,0,0,833,145,1,0,0,0,834,839,3,148,74,0,835,836,5,
        105,0,0,836,838,3,148,74,0,837,835,1,0,0,0,838,841,1,0,0,0,839,837,
        1,0,0,0,839,840,1,0,0,0,840,843,1,0,0,0,841,839,1,0,0,0,842,844,
        5,105,0,0,843,842,1,0,0,0,843,844,1,0,0,0,844,147,1,0,0,0,845,846,
        5,115,0,0,846,847,5,108,0,0,847,848,3,108,54,0,848,149,1,0,0,0,849,
        850,5,102,0,0,850,855,3,152,76,0,851,852,5,105,0,0,852,854,3,152,
        76,0,853,851,1,0,0,0,854,857,1,0,0,0,855,853,1,0,0,0,855,856,1,0,
        0,0,856,859,1,0,0,0,857,855,1,0,0,0,858,860,5,105,0,0,859,858,1,
        0,0,0,859,860,1,0,0,0,860,861,1,0,0,0,861,862,5,103,0,0,862,869,
        1,0,0,0,863,864,5,102,0,0,864,865,3,108,54,0,865,866,5,86,0,0,866,
        867,5,103,0,0,867,869,1,0,0,0,868,849,1,0,0,0,868,863,1,0,0,0,869,
        151,1,0,0,0,870,874,3,108,54,0,871,874,3,144,72,0,872,874,3,150,
        75,0,873,870,1,0,0,0,873,871,1,0,0,0,873,872,1,0,0,0,874,153,1,0,
        0,0,875,880,3,108,54,0,876,877,5,105,0,0,877,879,3,108,54,0,878,
        876,1,0,0,0,879,882,1,0,0,0,880,878,1,0,0,0,880,881,1,0,0,0,881,
        155,1,0,0,0,882,880,1,0,0,0,883,893,3,164,82,0,884,893,3,174,87,
        0,885,893,3,158,79,0,886,893,3,160,80,0,887,893,3,162,81,0,888,893,
        3,168,84,0,889,893,3,166,83,0,890,893,3,176,88,0,891,893,5,22,0,
        0,892,883,1,0,0,0,892,884,1,0,0,0,892,885,1,0,0,0,892,886,1,0,0,
        0,892,887,1,0,0,0,892,888,1,0,0,0,892,889,1,0,0,0,892,890,1,0,0,
        0,892,891,1,0,0,0,893,157,1,0,0,0,894,895,5,14,0,0,895,896,5,106,
        0,0,896,897,5,115,0,0,897,159,1,0,0,0,898,899,5,15,0,0,899,900,5,
        106,0,0,900,901,5,115,0,0,901,161,1,0,0,0,902,905,5,115,0,0,903,
        904,5,106,0,0,904,906,5,115,0,0,905,903,1,0,0,0,906,907,1,0,0,0,
        907,905,1,0,0,0,907,908,1,0,0,0,908,163,1,0,0,0,909,910,7,14,0,0,
        910,165,1,0,0,0,911,912,5,115,0,0,912,167,1,0,0,0,913,914,5,115,
        0,0,914,915,5,80,0,0,915,916,3,170,85,0,916,917,5,81,0,0,917,169,
        1,0,0,0,918,923,3,172,86,0,919,920,5,105,0,0,920,922,3,172,86,0,
        921,919,1,0,0,0,922,925,1,0,0,0,923,921,1,0,0,0,923,924,1,0,0,0,
        924,171,1,0,0,0,925,923,1,0,0,0,926,931,3,168,84,0,927,931,3,164,
        82,0,928,931,5,115,0,0,929,931,5,112,0,0,930,926,1,0,0,0,930,927,
        1,0,0,0,930,928,1,0,0,0,930,929,1,0,0,0,931,173,1,0,0,0,932,933,
        5,36,0,0,933,934,5,80,0,0,934,935,5,112,0,0,935,938,5,81,0,0,936,
        938,5,36,0,0,937,932,1,0,0,0,937,936,1,0,0,0,938,175,1,0,0,0,939,
        941,3,164,82,0,940,942,3,178,89,0,941,940,1,0,0,0,942,943,1,0,0,
        0,943,941,1,0,0,0,943,944,1,0,0,0,944,976,1,0,0,0,945,947,3,166,
        83,0,946,948,3,178,89,0,947,946,1,0,0,0,948,949,1,0,0,0,949,947,
        1,0,0,0,949,950,1,0,0,0,950,976,1,0,0,0,951,953,3,174,87,0,952,954,
        3,178,89,0,953,952,1,0,0,0,954,955,1,0,0,0,955,953,1,0,0,0,955,956,
        1,0,0,0,956,976,1,0,0,0,957,959,3,158,79,0,958,960,3,178,89,0,959,
        958,1,0,0,0,960,961,1,0,0,0,961,959,1,0,0,0,961,962,1,0,0,0,962,
        976,1,0,0,0,963,965,3,162,81,0,964,966,3,178,89,0,965,964,1,0,0,
        0,966,967,1,0,0,0,967,965,1,0,0,0,967,968,1,0,0,0,968,976,1,0,0,
        0,969,971,3,160,80,0,970,972,3,178,89,0,971,970,1,0,0,0,972,973,
        1,0,0,0,973,971,1,0,0,0,973,974,1,0,0,0,974,976,1,0,0,0,975,939,
        1,0,0,0,975,945,1,0,0,0,975,951,1,0,0,0,975,957,1,0,0,0,975,963,
        1,0,0,0,975,969,1,0,0,0,976,177,1,0,0,0,977,979,5,102,0,0,978,980,
        3,108,54,0,979,978,1,0,0,0,979,980,1,0,0,0,980,981,1,0,0,0,981,982,
        5,103,0,0,982,179,1,0,0,0,983,984,7,15,0,0,984,181,1,0,0,0,108,184,
        186,192,202,217,225,231,235,239,243,247,251,254,266,270,289,295,
        302,315,319,326,336,340,350,353,359,369,373,376,383,398,403,406,
        409,412,415,422,427,445,452,459,476,494,503,510,513,521,525,537,
        556,560,564,574,577,580,583,586,593,598,610,622,625,635,645,649,
        653,658,664,679,686,694,702,710,718,726,734,742,750,758,768,774,
        781,789,795,798,812,818,824,839,843,855,859,868,873,880,892,907,
        923,930,937,943,949,955,961,967,973,975,979
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!CnxParser.__ATN) {
            CnxParser.__ATN = new antlr.ATNDeserializer().deserialize(CnxParser._serializedATN);
        }

        return CnxParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(CnxParser.literalNames, CnxParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return CnxParser.vocabulary;
    }

    private static readonly decisionsToDFA = CnxParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class ProgramContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(CnxParser.EOF, 0)!;
    }
    public includeDirective(): IncludeDirectiveContext[];
    public includeDirective(i: number): IncludeDirectiveContext | null;
    public includeDirective(i?: number): IncludeDirectiveContext[] | IncludeDirectiveContext | null {
        if (i === undefined) {
            return this.getRuleContexts(IncludeDirectiveContext);
        }

        return this.getRuleContext(i, IncludeDirectiveContext);
    }
    public preprocessorDirective(): PreprocessorDirectiveContext[];
    public preprocessorDirective(i: number): PreprocessorDirectiveContext | null;
    public preprocessorDirective(i?: number): PreprocessorDirectiveContext[] | PreprocessorDirectiveContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PreprocessorDirectiveContext);
        }

        return this.getRuleContext(i, PreprocessorDirectiveContext);
    }
    public declaration(): DeclarationContext[];
    public declaration(i: number): DeclarationContext | null;
    public declaration(i?: number): DeclarationContext[] | DeclarationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DeclarationContext);
        }

        return this.getRuleContext(i, DeclarationContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_program;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterProgram) {
             listener.enterProgram(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitProgram) {
             listener.exitProgram(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitProgram) {
            return visitor.visitProgram(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IncludeDirectiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public INCLUDE_DIRECTIVE(): antlr.TerminalNode {
        return this.getToken(CnxParser.INCLUDE_DIRECTIVE, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_includeDirective;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterIncludeDirective) {
             listener.enterIncludeDirective(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitIncludeDirective) {
             listener.exitIncludeDirective(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitIncludeDirective) {
            return visitor.visitIncludeDirective(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PreprocessorDirectiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public defineDirective(): DefineDirectiveContext | null {
        return this.getRuleContext(0, DefineDirectiveContext);
    }
    public conditionalDirective(): ConditionalDirectiveContext | null {
        return this.getRuleContext(0, ConditionalDirectiveContext);
    }
    public pragmaDirective(): PragmaDirectiveContext | null {
        return this.getRuleContext(0, PragmaDirectiveContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_preprocessorDirective;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterPreprocessorDirective) {
             listener.enterPreprocessorDirective(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitPreprocessorDirective) {
             listener.exitPreprocessorDirective(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitPreprocessorDirective) {
            return visitor.visitPreprocessorDirective(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DefineDirectiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DEFINE_FLAG(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DEFINE_FLAG, 0);
    }
    public DEFINE_WITH_VALUE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DEFINE_WITH_VALUE, 0);
    }
    public DEFINE_FUNCTION(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DEFINE_FUNCTION, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_defineDirective;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterDefineDirective) {
             listener.enterDefineDirective(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitDefineDirective) {
             listener.exitDefineDirective(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitDefineDirective) {
            return visitor.visitDefineDirective(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConditionalDirectiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IFDEF_DIRECTIVE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IFDEF_DIRECTIVE, 0);
    }
    public IFNDEF_DIRECTIVE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IFNDEF_DIRECTIVE, 0);
    }
    public ELSE_DIRECTIVE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ELSE_DIRECTIVE, 0);
    }
    public ENDIF_DIRECTIVE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ENDIF_DIRECTIVE, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_conditionalDirective;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterConditionalDirective) {
             listener.enterConditionalDirective(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitConditionalDirective) {
             listener.exitConditionalDirective(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitConditionalDirective) {
            return visitor.visitConditionalDirective(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PragmaDirectiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public PRAGMA_DIRECTIVE(): antlr.TerminalNode {
        return this.getToken(CnxParser.PRAGMA_DIRECTIVE, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_pragmaDirective;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterPragmaDirective) {
             listener.enterPragmaDirective(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitPragmaDirective) {
             listener.exitPragmaDirective(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitPragmaDirective) {
            return visitor.visitPragmaDirective(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public scopeDeclaration(): ScopeDeclarationContext | null {
        return this.getRuleContext(0, ScopeDeclarationContext);
    }
    public registerDeclaration(): RegisterDeclarationContext | null {
        return this.getRuleContext(0, RegisterDeclarationContext);
    }
    public structDeclaration(): StructDeclarationContext | null {
        return this.getRuleContext(0, StructDeclarationContext);
    }
    public enumDeclaration(): EnumDeclarationContext | null {
        return this.getRuleContext(0, EnumDeclarationContext);
    }
    public bitmapDeclaration(): BitmapDeclarationContext | null {
        return this.getRuleContext(0, BitmapDeclarationContext);
    }
    public functionDeclaration(): FunctionDeclarationContext | null {
        return this.getRuleContext(0, FunctionDeclarationContext);
    }
    public variableDeclaration(): VariableDeclarationContext | null {
        return this.getRuleContext(0, VariableDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_declaration;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterDeclaration) {
             listener.enterDeclaration(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitDeclaration) {
             listener.exitDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitDeclaration) {
            return visitor.visitDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ScopeDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public SCOPE(): antlr.TerminalNode {
        return this.getToken(CnxParser.SCOPE, 0)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACE, 0)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACE, 0)!;
    }
    public scopeMember(): ScopeMemberContext[];
    public scopeMember(i: number): ScopeMemberContext | null;
    public scopeMember(i?: number): ScopeMemberContext[] | ScopeMemberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ScopeMemberContext);
        }

        return this.getRuleContext(i, ScopeMemberContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_scopeDeclaration;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterScopeDeclaration) {
             listener.enterScopeDeclaration(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitScopeDeclaration) {
             listener.exitScopeDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitScopeDeclaration) {
            return visitor.visitScopeDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ScopeMemberContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public variableDeclaration(): VariableDeclarationContext | null {
        return this.getRuleContext(0, VariableDeclarationContext);
    }
    public visibilityModifier(): VisibilityModifierContext | null {
        return this.getRuleContext(0, VisibilityModifierContext);
    }
    public functionDeclaration(): FunctionDeclarationContext | null {
        return this.getRuleContext(0, FunctionDeclarationContext);
    }
    public enumDeclaration(): EnumDeclarationContext | null {
        return this.getRuleContext(0, EnumDeclarationContext);
    }
    public bitmapDeclaration(): BitmapDeclarationContext | null {
        return this.getRuleContext(0, BitmapDeclarationContext);
    }
    public registerDeclaration(): RegisterDeclarationContext | null {
        return this.getRuleContext(0, RegisterDeclarationContext);
    }
    public structDeclaration(): StructDeclarationContext | null {
        return this.getRuleContext(0, StructDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_scopeMember;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterScopeMember) {
             listener.enterScopeMember(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitScopeMember) {
             listener.exitScopeMember(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitScopeMember) {
            return visitor.visitScopeMember(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class VisibilityModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public PRIVATE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.PRIVATE, 0);
    }
    public PUBLIC(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.PUBLIC, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_visibilityModifier;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterVisibilityModifier) {
             listener.enterVisibilityModifier(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitVisibilityModifier) {
             listener.exitVisibilityModifier(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitVisibilityModifier) {
            return visitor.visitVisibilityModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class RegisterDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public REGISTER(): antlr.TerminalNode {
        return this.getToken(CnxParser.REGISTER, 0)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACE, 0)!;
    }
    public registerMember(): RegisterMemberContext[];
    public registerMember(i: number): RegisterMemberContext | null;
    public registerMember(i?: number): RegisterMemberContext[] | RegisterMemberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(RegisterMemberContext);
        }

        return this.getRuleContext(i, RegisterMemberContext);
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACE, 0)!;
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.COMMA);
    	} else {
    		return this.getToken(CnxParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_registerDeclaration;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterRegisterDeclaration) {
             listener.enterRegisterDeclaration(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitRegisterDeclaration) {
             listener.exitRegisterDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitRegisterDeclaration) {
            return visitor.visitRegisterDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class RegisterMemberContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public accessModifier(): AccessModifierContext {
        return this.getRuleContext(0, AccessModifierContext)!;
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public memberName(): MemberNameContext {
        return this.getRuleContext(0, MemberNameContext)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_registerMember;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterRegisterMember) {
             listener.enterRegisterMember(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitRegisterMember) {
             listener.exitRegisterMember(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitRegisterMember) {
            return visitor.visitRegisterMember(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemberNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IDENTIFIER, 0);
    }
    public SCOPE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.SCOPE, 0);
    }
    public STRUCT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.STRUCT, 0);
    }
    public ENUM(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ENUM, 0);
    }
    public THIS(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.THIS, 0);
    }
    public GLOBAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.GLOBAL, 0);
    }
    public REGISTER(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.REGISTER, 0);
    }
    public PRIVATE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.PRIVATE, 0);
    }
    public PUBLIC(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.PUBLIC, 0);
    }
    public CONST(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.CONST, 0);
    }
    public MUT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.MUT, 0);
    }
    public VOLATILE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.VOLATILE, 0);
    }
    public VOID(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.VOID, 0);
    }
    public IF(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IF, 0);
    }
    public ELSE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ELSE, 0);
    }
    public WHILE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.WHILE, 0);
    }
    public DO(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DO, 0);
    }
    public FOR(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.FOR, 0);
    }
    public FOREVER(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.FOREVER, 0);
    }
    public SWITCH(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.SWITCH, 0);
    }
    public CASE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.CASE, 0);
    }
    public DEFAULT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DEFAULT, 0);
    }
    public RETURN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RETURN, 0);
    }
    public TRUE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.TRUE, 0);
    }
    public FALSE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.FALSE, 0);
    }
    public C_NULL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.C_NULL, 0);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.STRING, 0);
    }
    public SIZEOF(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.SIZEOF, 0);
    }
    public BITMAP8(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITMAP8, 0);
    }
    public BITMAP16(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITMAP16, 0);
    }
    public BITMAP24(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITMAP24, 0);
    }
    public BITMAP32(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITMAP32, 0);
    }
    public RW(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RW, 0);
    }
    public RO(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RO, 0);
    }
    public WO(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.WO, 0);
    }
    public W1C(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.W1C, 0);
    }
    public W1S(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.W1S, 0);
    }
    public CLAMP(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.CLAMP, 0);
    }
    public WRAP(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.WRAP, 0);
    }
    public ATOMIC(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ATOMIC, 0);
    }
    public CRITICAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.CRITICAL, 0);
    }
    public U8(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.U8, 0);
    }
    public U16(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.U16, 0);
    }
    public U32(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.U32, 0);
    }
    public U64(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.U64, 0);
    }
    public I8(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.I8, 0);
    }
    public I16(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.I16, 0);
    }
    public I32(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.I32, 0);
    }
    public I64(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.I64, 0);
    }
    public F32(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.F32, 0);
    }
    public F64(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.F64, 0);
    }
    public BOOL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BOOL, 0);
    }
    public ISR_TYPE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ISR_TYPE, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_memberName;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterMemberName) {
             listener.enterMemberName(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitMemberName) {
             listener.exitMemberName(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitMemberName) {
            return visitor.visitMemberName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AccessModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public RW(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RW, 0);
    }
    public RO(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RO, 0);
    }
    public WO(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.WO, 0);
    }
    public W1C(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.W1C, 0);
    }
    public W1S(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.W1S, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_accessModifier;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterAccessModifier) {
             listener.enterAccessModifier(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitAccessModifier) {
             listener.exitAccessModifier(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitAccessModifier) {
            return visitor.visitAccessModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRUCT(): antlr.TerminalNode {
        return this.getToken(CnxParser.STRUCT, 0)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACE, 0)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACE, 0)!;
    }
    public structMember(): StructMemberContext[];
    public structMember(i: number): StructMemberContext | null;
    public structMember(i?: number): StructMemberContext[] | StructMemberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StructMemberContext);
        }

        return this.getRuleContext(i, StructMemberContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_structDeclaration;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterStructDeclaration) {
             listener.enterStructDeclaration(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitStructDeclaration) {
             listener.exitStructDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitStructDeclaration) {
            return visitor.visitStructDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructMemberContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public memberName(): MemberNameContext {
        return this.getRuleContext(0, MemberNameContext)!;
    }
    public SEMI(): antlr.TerminalNode {
        return this.getToken(CnxParser.SEMI, 0)!;
    }
    public overflowModifier(): OverflowModifierContext | null {
        return this.getRuleContext(0, OverflowModifierContext);
    }
    public arrayDimension(): ArrayDimensionContext[];
    public arrayDimension(i: number): ArrayDimensionContext | null;
    public arrayDimension(i?: number): ArrayDimensionContext[] | ArrayDimensionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ArrayDimensionContext);
        }

        return this.getRuleContext(i, ArrayDimensionContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_structMember;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterStructMember) {
             listener.enterStructMember(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitStructMember) {
             listener.exitStructMember(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitStructMember) {
            return visitor.visitStructMember(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ENUM(): antlr.TerminalNode {
        return this.getToken(CnxParser.ENUM, 0)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACE, 0)!;
    }
    public enumMember(): EnumMemberContext[];
    public enumMember(i: number): EnumMemberContext | null;
    public enumMember(i?: number): EnumMemberContext[] | EnumMemberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(EnumMemberContext);
        }

        return this.getRuleContext(i, EnumMemberContext);
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACE, 0)!;
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.COMMA);
    	} else {
    		return this.getToken(CnxParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_enumDeclaration;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterEnumDeclaration) {
             listener.enterEnumDeclaration(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitEnumDeclaration) {
             listener.exitEnumDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitEnumDeclaration) {
            return visitor.visitEnumDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumMemberContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ASSIGN, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_enumMember;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterEnumMember) {
             listener.enterEnumMember(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitEnumMember) {
             listener.exitEnumMember(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitEnumMember) {
            return visitor.visitEnumMember(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BitmapDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public bitmapType(): BitmapTypeContext {
        return this.getRuleContext(0, BitmapTypeContext)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACE, 0)!;
    }
    public bitmapMember(): BitmapMemberContext[];
    public bitmapMember(i: number): BitmapMemberContext | null;
    public bitmapMember(i?: number): BitmapMemberContext[] | BitmapMemberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BitmapMemberContext);
        }

        return this.getRuleContext(i, BitmapMemberContext);
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACE, 0)!;
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.COMMA);
    	} else {
    		return this.getToken(CnxParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_bitmapDeclaration;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterBitmapDeclaration) {
             listener.enterBitmapDeclaration(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitBitmapDeclaration) {
             listener.exitBitmapDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitBitmapDeclaration) {
            return visitor.visitBitmapDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BitmapTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public BITMAP8(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITMAP8, 0);
    }
    public BITMAP16(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITMAP16, 0);
    }
    public BITMAP24(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITMAP24, 0);
    }
    public BITMAP32(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITMAP32, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_bitmapType;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterBitmapType) {
             listener.enterBitmapType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitBitmapType) {
             listener.exitBitmapType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitBitmapType) {
            return visitor.visitBitmapType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BitmapMemberContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public memberName(): MemberNameContext {
        return this.getRuleContext(0, MemberNameContext)!;
    }
    public LBRACKET(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LBRACKET, 0);
    }
    public INTEGER_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.INTEGER_LITERAL, 0);
    }
    public RBRACKET(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RBRACKET, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_bitmapMember;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterBitmapMember) {
             listener.enterBitmapMember(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitBitmapMember) {
             listener.exitBitmapMember(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitBitmapMember) {
            return visitor.visitBitmapMember(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FunctionDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.LPAREN, 0)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.RPAREN, 0)!;
    }
    public block(): BlockContext {
        return this.getRuleContext(0, BlockContext)!;
    }
    public overflowModifier(): OverflowModifierContext | null {
        return this.getRuleContext(0, OverflowModifierContext);
    }
    public parameterList(): ParameterListContext | null {
        return this.getRuleContext(0, ParameterListContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_functionDeclaration;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterFunctionDeclaration) {
             listener.enterFunctionDeclaration(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitFunctionDeclaration) {
             listener.exitFunctionDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitFunctionDeclaration) {
            return visitor.visitFunctionDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParameterListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public parameter(): ParameterContext[];
    public parameter(i: number): ParameterContext | null;
    public parameter(i?: number): ParameterContext[] | ParameterContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ParameterContext);
        }

        return this.getRuleContext(i, ParameterContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.COMMA);
    	} else {
    		return this.getToken(CnxParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_parameterList;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterParameterList) {
             listener.enterParameterList(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitParameterList) {
             listener.exitParameterList(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitParameterList) {
            return visitor.visitParameterList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParameterContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public constModifier(): ConstModifierContext | null {
        return this.getRuleContext(0, ConstModifierContext);
    }
    public mutModifier(): MutModifierContext | null {
        return this.getRuleContext(0, MutModifierContext);
    }
    public arrayDimension(): ArrayDimensionContext[];
    public arrayDimension(i: number): ArrayDimensionContext | null;
    public arrayDimension(i?: number): ArrayDimensionContext[] | ArrayDimensionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ArrayDimensionContext);
        }

        return this.getRuleContext(i, ArrayDimensionContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_parameter;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterParameter) {
             listener.enterParameter(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitParameter) {
             listener.exitParameter(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitParameter) {
            return visitor.visitParameter(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConstModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CONST(): antlr.TerminalNode {
        return this.getToken(CnxParser.CONST, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_constModifier;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterConstModifier) {
             listener.enterConstModifier(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitConstModifier) {
             listener.exitConstModifier(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitConstModifier) {
            return visitor.visitConstModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MutModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public MUT(): antlr.TerminalNode {
        return this.getToken(CnxParser.MUT, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_mutModifier;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterMutModifier) {
             listener.enterMutModifier(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitMutModifier) {
             listener.exitMutModifier(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitMutModifier) {
            return visitor.visitMutModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class VolatileModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public VOLATILE(): antlr.TerminalNode {
        return this.getToken(CnxParser.VOLATILE, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_volatileModifier;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterVolatileModifier) {
             listener.enterVolatileModifier(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitVolatileModifier) {
             listener.exitVolatileModifier(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitVolatileModifier) {
            return visitor.visitVolatileModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class OverflowModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CLAMP(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.CLAMP, 0);
    }
    public WRAP(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.WRAP, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_overflowModifier;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterOverflowModifier) {
             listener.enterOverflowModifier(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitOverflowModifier) {
             listener.exitOverflowModifier(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitOverflowModifier) {
            return visitor.visitOverflowModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AtomicModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ATOMIC(): antlr.TerminalNode {
        return this.getToken(CnxParser.ATOMIC, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_atomicModifier;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterAtomicModifier) {
             listener.enterAtomicModifier(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitAtomicModifier) {
             listener.exitAtomicModifier(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitAtomicModifier) {
            return visitor.visitAtomicModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArrayDimensionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACKET, 0)!;
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACKET, 0)!;
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_arrayDimension;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterArrayDimension) {
             listener.enterArrayDimension(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitArrayDimension) {
             listener.exitArrayDimension(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitArrayDimension) {
            return visitor.visitArrayDimension(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class VariableDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public SEMI(): antlr.TerminalNode {
        return this.getToken(CnxParser.SEMI, 0)!;
    }
    public atomicModifier(): AtomicModifierContext | null {
        return this.getRuleContext(0, AtomicModifierContext);
    }
    public volatileModifier(): VolatileModifierContext | null {
        return this.getRuleContext(0, VolatileModifierContext);
    }
    public constModifier(): ConstModifierContext | null {
        return this.getRuleContext(0, ConstModifierContext);
    }
    public mutModifier(): MutModifierContext | null {
        return this.getRuleContext(0, MutModifierContext);
    }
    public overflowModifier(): OverflowModifierContext | null {
        return this.getRuleContext(0, OverflowModifierContext);
    }
    public arrayDimension(): ArrayDimensionContext[];
    public arrayDimension(i: number): ArrayDimensionContext | null;
    public arrayDimension(i?: number): ArrayDimensionContext[] | ArrayDimensionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ArrayDimensionContext);
        }

        return this.getRuleContext(i, ArrayDimensionContext);
    }
    public ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ASSIGN, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public LPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LPAREN, 0);
    }
    public constructorArgumentList(): ConstructorArgumentListContext | null {
        return this.getRuleContext(0, ConstructorArgumentListContext);
    }
    public RPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RPAREN, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_variableDeclaration;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterVariableDeclaration) {
             listener.enterVariableDeclaration(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitVariableDeclaration) {
             listener.exitVariableDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitVariableDeclaration) {
            return visitor.visitVariableDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConstructorArgumentListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.IDENTIFIER);
    	} else {
    		return this.getToken(CnxParser.IDENTIFIER, i);
    	}
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.COMMA);
    	} else {
    		return this.getToken(CnxParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_constructorArgumentList;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterConstructorArgumentList) {
             listener.enterConstructorArgumentList(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitConstructorArgumentList) {
             listener.exitConstructorArgumentList(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitConstructorArgumentList) {
            return visitor.visitConstructorArgumentList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BlockContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACE, 0)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACE, 0)!;
    }
    public statement(): StatementContext[];
    public statement(i: number): StatementContext | null;
    public statement(i?: number): StatementContext[] | StatementContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }

        return this.getRuleContext(i, StatementContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_block;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterBlock) {
             listener.enterBlock(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitBlock) {
             listener.exitBlock(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitBlock) {
            return visitor.visitBlock(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public variableDeclaration(): VariableDeclarationContext | null {
        return this.getRuleContext(0, VariableDeclarationContext);
    }
    public assignmentStatement(): AssignmentStatementContext | null {
        return this.getRuleContext(0, AssignmentStatementContext);
    }
    public expressionStatement(): ExpressionStatementContext | null {
        return this.getRuleContext(0, ExpressionStatementContext);
    }
    public ifStatement(): IfStatementContext | null {
        return this.getRuleContext(0, IfStatementContext);
    }
    public whileStatement(): WhileStatementContext | null {
        return this.getRuleContext(0, WhileStatementContext);
    }
    public doWhileStatement(): DoWhileStatementContext | null {
        return this.getRuleContext(0, DoWhileStatementContext);
    }
    public forStatement(): ForStatementContext | null {
        return this.getRuleContext(0, ForStatementContext);
    }
    public foreverStatement(): ForeverStatementContext | null {
        return this.getRuleContext(0, ForeverStatementContext);
    }
    public switchStatement(): SwitchStatementContext | null {
        return this.getRuleContext(0, SwitchStatementContext);
    }
    public returnStatement(): ReturnStatementContext | null {
        return this.getRuleContext(0, ReturnStatementContext);
    }
    public criticalStatement(): CriticalStatementContext | null {
        return this.getRuleContext(0, CriticalStatementContext);
    }
    public block(): BlockContext | null {
        return this.getRuleContext(0, BlockContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_statement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterStatement) {
             listener.enterStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitStatement) {
             listener.exitStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitStatement) {
            return visitor.visitStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CriticalStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CRITICAL(): antlr.TerminalNode {
        return this.getToken(CnxParser.CRITICAL, 0)!;
    }
    public block(): BlockContext {
        return this.getRuleContext(0, BlockContext)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_criticalStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterCriticalStatement) {
             listener.enterCriticalStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitCriticalStatement) {
             listener.exitCriticalStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitCriticalStatement) {
            return visitor.visitCriticalStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AssignmentStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public assignmentTarget(): AssignmentTargetContext {
        return this.getRuleContext(0, AssignmentTargetContext)!;
    }
    public assignmentOperator(): AssignmentOperatorContext {
        return this.getRuleContext(0, AssignmentOperatorContext)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public SEMI(): antlr.TerminalNode {
        return this.getToken(CnxParser.SEMI, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_assignmentStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterAssignmentStatement) {
             listener.enterAssignmentStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitAssignmentStatement) {
             listener.exitAssignmentStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitAssignmentStatement) {
            return visitor.visitAssignmentStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AssignmentOperatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ASSIGN, 0);
    }
    public PLUS_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.PLUS_ASSIGN, 0);
    }
    public MINUS_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.MINUS_ASSIGN, 0);
    }
    public STAR_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.STAR_ASSIGN, 0);
    }
    public SLASH_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.SLASH_ASSIGN, 0);
    }
    public PERCENT_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.PERCENT_ASSIGN, 0);
    }
    public BITAND_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITAND_ASSIGN, 0);
    }
    public BITOR_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITOR_ASSIGN, 0);
    }
    public BITXOR_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITXOR_ASSIGN, 0);
    }
    public LSHIFT_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LSHIFT_ASSIGN, 0);
    }
    public RSHIFT_ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RSHIFT_ASSIGN, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_assignmentOperator;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterAssignmentOperator) {
             listener.enterAssignmentOperator(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitAssignmentOperator) {
             listener.exitAssignmentOperator(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitAssignmentOperator) {
            return visitor.visitAssignmentOperator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AssignmentTargetContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public GLOBAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.GLOBAL, 0);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DOT, 0);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public postfixTargetOp(): PostfixTargetOpContext[];
    public postfixTargetOp(i: number): PostfixTargetOpContext | null;
    public postfixTargetOp(i?: number): PostfixTargetOpContext[] | PostfixTargetOpContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PostfixTargetOpContext);
        }

        return this.getRuleContext(i, PostfixTargetOpContext);
    }
    public THIS(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.THIS, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_assignmentTarget;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterAssignmentTarget) {
             listener.enterAssignmentTarget(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitAssignmentTarget) {
             listener.exitAssignmentTarget(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitAssignmentTarget) {
            return visitor.visitAssignmentTarget(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PostfixTargetOpContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DOT, 0);
    }
    public memberName(): MemberNameContext | null {
        return this.getRuleContext(0, MemberNameContext);
    }
    public LBRACKET(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LBRACKET, 0);
    }
    public expression(): ExpressionContext[];
    public expression(i: number): ExpressionContext | null;
    public expression(i?: number): ExpressionContext[] | ExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }

        return this.getRuleContext(i, ExpressionContext);
    }
    public RBRACKET(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RBRACKET, 0);
    }
    public COMMA(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.COMMA, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_postfixTargetOp;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterPostfixTargetOp) {
             listener.enterPostfixTargetOp(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitPostfixTargetOp) {
             listener.exitPostfixTargetOp(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitPostfixTargetOp) {
            return visitor.visitPostfixTargetOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExpressionStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public SEMI(): antlr.TerminalNode {
        return this.getToken(CnxParser.SEMI, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_expressionStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterExpressionStatement) {
             listener.enterExpressionStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitExpressionStatement) {
             listener.exitExpressionStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitExpressionStatement) {
            return visitor.visitExpressionStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IfStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IF(): antlr.TerminalNode {
        return this.getToken(CnxParser.IF, 0)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.LPAREN, 0)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.RPAREN, 0)!;
    }
    public statement(): StatementContext[];
    public statement(i: number): StatementContext | null;
    public statement(i?: number): StatementContext[] | StatementContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }

        return this.getRuleContext(i, StatementContext);
    }
    public ELSE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ELSE, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_ifStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterIfStatement) {
             listener.enterIfStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitIfStatement) {
             listener.exitIfStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitIfStatement) {
            return visitor.visitIfStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class WhileStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public WHILE(): antlr.TerminalNode {
        return this.getToken(CnxParser.WHILE, 0)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.LPAREN, 0)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.RPAREN, 0)!;
    }
    public statement(): StatementContext {
        return this.getRuleContext(0, StatementContext)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_whileStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterWhileStatement) {
             listener.enterWhileStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitWhileStatement) {
             listener.exitWhileStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitWhileStatement) {
            return visitor.visitWhileStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DoWhileStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DO(): antlr.TerminalNode {
        return this.getToken(CnxParser.DO, 0)!;
    }
    public block(): BlockContext {
        return this.getRuleContext(0, BlockContext)!;
    }
    public WHILE(): antlr.TerminalNode {
        return this.getToken(CnxParser.WHILE, 0)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.LPAREN, 0)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.RPAREN, 0)!;
    }
    public SEMI(): antlr.TerminalNode {
        return this.getToken(CnxParser.SEMI, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_doWhileStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterDoWhileStatement) {
             listener.enterDoWhileStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitDoWhileStatement) {
             listener.exitDoWhileStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitDoWhileStatement) {
            return visitor.visitDoWhileStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public FOR(): antlr.TerminalNode {
        return this.getToken(CnxParser.FOR, 0)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.LPAREN, 0)!;
    }
    public SEMI(): antlr.TerminalNode[];
    public SEMI(i: number): antlr.TerminalNode | null;
    public SEMI(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.SEMI);
    	} else {
    		return this.getToken(CnxParser.SEMI, i);
    	}
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.RPAREN, 0)!;
    }
    public statement(): StatementContext {
        return this.getRuleContext(0, StatementContext)!;
    }
    public forInit(): ForInitContext | null {
        return this.getRuleContext(0, ForInitContext);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public forUpdate(): ForUpdateContext | null {
        return this.getRuleContext(0, ForUpdateContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_forStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterForStatement) {
             listener.enterForStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitForStatement) {
             listener.exitForStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitForStatement) {
            return visitor.visitForStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForeverStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public FOREVER(): antlr.TerminalNode {
        return this.getToken(CnxParser.FOREVER, 0)!;
    }
    public block(): BlockContext {
        return this.getRuleContext(0, BlockContext)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_foreverStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterForeverStatement) {
             listener.enterForeverStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitForeverStatement) {
             listener.exitForeverStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitForeverStatement) {
            return visitor.visitForeverStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForInitContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public forVarDecl(): ForVarDeclContext | null {
        return this.getRuleContext(0, ForVarDeclContext);
    }
    public forAssignment(): ForAssignmentContext | null {
        return this.getRuleContext(0, ForAssignmentContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_forInit;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterForInit) {
             listener.enterForInit(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitForInit) {
             listener.exitForInit(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitForInit) {
            return visitor.visitForInit(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForVarDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public atomicModifier(): AtomicModifierContext | null {
        return this.getRuleContext(0, AtomicModifierContext);
    }
    public volatileModifier(): VolatileModifierContext | null {
        return this.getRuleContext(0, VolatileModifierContext);
    }
    public mutModifier(): MutModifierContext | null {
        return this.getRuleContext(0, MutModifierContext);
    }
    public overflowModifier(): OverflowModifierContext | null {
        return this.getRuleContext(0, OverflowModifierContext);
    }
    public arrayDimension(): ArrayDimensionContext[];
    public arrayDimension(i: number): ArrayDimensionContext | null;
    public arrayDimension(i?: number): ArrayDimensionContext[] | ArrayDimensionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ArrayDimensionContext);
        }

        return this.getRuleContext(i, ArrayDimensionContext);
    }
    public ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ASSIGN, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_forVarDecl;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterForVarDecl) {
             listener.enterForVarDecl(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitForVarDecl) {
             listener.exitForVarDecl(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitForVarDecl) {
            return visitor.visitForVarDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForAssignmentContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public assignmentTarget(): AssignmentTargetContext {
        return this.getRuleContext(0, AssignmentTargetContext)!;
    }
    public assignmentOperator(): AssignmentOperatorContext {
        return this.getRuleContext(0, AssignmentOperatorContext)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_forAssignment;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterForAssignment) {
             listener.enterForAssignment(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitForAssignment) {
             listener.exitForAssignment(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitForAssignment) {
            return visitor.visitForAssignment(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForUpdateContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public assignmentTarget(): AssignmentTargetContext {
        return this.getRuleContext(0, AssignmentTargetContext)!;
    }
    public assignmentOperator(): AssignmentOperatorContext {
        return this.getRuleContext(0, AssignmentOperatorContext)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_forUpdate;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterForUpdate) {
             listener.enterForUpdate(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitForUpdate) {
             listener.exitForUpdate(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitForUpdate) {
            return visitor.visitForUpdate(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ReturnStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public RETURN(): antlr.TerminalNode {
        return this.getToken(CnxParser.RETURN, 0)!;
    }
    public SEMI(): antlr.TerminalNode {
        return this.getToken(CnxParser.SEMI, 0)!;
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_returnStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterReturnStatement) {
             listener.enterReturnStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitReturnStatement) {
             listener.exitReturnStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitReturnStatement) {
            return visitor.visitReturnStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SwitchStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public SWITCH(): antlr.TerminalNode {
        return this.getToken(CnxParser.SWITCH, 0)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.LPAREN, 0)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.RPAREN, 0)!;
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACE, 0)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACE, 0)!;
    }
    public switchCase(): SwitchCaseContext[];
    public switchCase(i: number): SwitchCaseContext | null;
    public switchCase(i?: number): SwitchCaseContext[] | SwitchCaseContext | null {
        if (i === undefined) {
            return this.getRuleContexts(SwitchCaseContext);
        }

        return this.getRuleContext(i, SwitchCaseContext);
    }
    public defaultCase(): DefaultCaseContext | null {
        return this.getRuleContext(0, DefaultCaseContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_switchStatement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterSwitchStatement) {
             listener.enterSwitchStatement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitSwitchStatement) {
             listener.exitSwitchStatement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitSwitchStatement) {
            return visitor.visitSwitchStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SwitchCaseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CASE(): antlr.TerminalNode {
        return this.getToken(CnxParser.CASE, 0)!;
    }
    public caseLabel(): CaseLabelContext[];
    public caseLabel(i: number): CaseLabelContext | null;
    public caseLabel(i?: number): CaseLabelContext[] | CaseLabelContext | null {
        if (i === undefined) {
            return this.getRuleContexts(CaseLabelContext);
        }

        return this.getRuleContext(i, CaseLabelContext);
    }
    public block(): BlockContext {
        return this.getRuleContext(0, BlockContext)!;
    }
    public OR(): antlr.TerminalNode[];
    public OR(i: number): antlr.TerminalNode | null;
    public OR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.OR);
    	} else {
    		return this.getToken(CnxParser.OR, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_switchCase;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterSwitchCase) {
             listener.enterSwitchCase(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitSwitchCase) {
             listener.exitSwitchCase(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitSwitchCase) {
            return visitor.visitSwitchCase(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CaseLabelContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public qualifiedType(): QualifiedTypeContext | null {
        return this.getRuleContext(0, QualifiedTypeContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DOT, 0);
    }
    public THIS(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.THIS, 0);
    }
    public GLOBAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.GLOBAL, 0);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IDENTIFIER, 0);
    }
    public INTEGER_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.INTEGER_LITERAL, 0);
    }
    public MINUS(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.MINUS, 0);
    }
    public HEX_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.HEX_LITERAL, 0);
    }
    public BINARY_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BINARY_LITERAL, 0);
    }
    public CHAR_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.CHAR_LITERAL, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_caseLabel;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterCaseLabel) {
             listener.enterCaseLabel(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitCaseLabel) {
             listener.exitCaseLabel(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitCaseLabel) {
            return visitor.visitCaseLabel(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DefaultCaseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DEFAULT(): antlr.TerminalNode {
        return this.getToken(CnxParser.DEFAULT, 0)!;
    }
    public block(): BlockContext {
        return this.getRuleContext(0, BlockContext)!;
    }
    public LPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LPAREN, 0);
    }
    public INTEGER_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.INTEGER_LITERAL, 0);
    }
    public RPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RPAREN, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_defaultCase;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterDefaultCase) {
             listener.enterDefaultCase(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitDefaultCase) {
             listener.exitDefaultCase(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitDefaultCase) {
            return visitor.visitDefaultCase(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ternaryExpression(): TernaryExpressionContext {
        return this.getRuleContext(0, TernaryExpressionContext)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_expression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterExpression) {
             listener.enterExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitExpression) {
             listener.exitExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitExpression) {
            return visitor.visitExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TernaryExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LPAREN, 0);
    }
    public orExpression(): OrExpressionContext[];
    public orExpression(i: number): OrExpressionContext | null;
    public orExpression(i?: number): OrExpressionContext[] | OrExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(OrExpressionContext);
        }

        return this.getRuleContext(i, OrExpressionContext);
    }
    public RPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RPAREN, 0);
    }
    public COLON(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.COLON, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_ternaryExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterTernaryExpression) {
             listener.enterTernaryExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitTernaryExpression) {
             listener.exitTernaryExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitTernaryExpression) {
            return visitor.visitTernaryExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class OrExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public andExpression(): AndExpressionContext[];
    public andExpression(i: number): AndExpressionContext | null;
    public andExpression(i?: number): AndExpressionContext[] | AndExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AndExpressionContext);
        }

        return this.getRuleContext(i, AndExpressionContext);
    }
    public OR(): antlr.TerminalNode[];
    public OR(i: number): antlr.TerminalNode | null;
    public OR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.OR);
    	} else {
    		return this.getToken(CnxParser.OR, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_orExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterOrExpression) {
             listener.enterOrExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitOrExpression) {
             listener.exitOrExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitOrExpression) {
            return visitor.visitOrExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AndExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public equalityExpression(): EqualityExpressionContext[];
    public equalityExpression(i: number): EqualityExpressionContext | null;
    public equalityExpression(i?: number): EqualityExpressionContext[] | EqualityExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(EqualityExpressionContext);
        }

        return this.getRuleContext(i, EqualityExpressionContext);
    }
    public AND(): antlr.TerminalNode[];
    public AND(i: number): antlr.TerminalNode | null;
    public AND(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.AND);
    	} else {
    		return this.getToken(CnxParser.AND, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_andExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterAndExpression) {
             listener.enterAndExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitAndExpression) {
             listener.exitAndExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitAndExpression) {
            return visitor.visitAndExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EqualityExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public relationalExpression(): RelationalExpressionContext[];
    public relationalExpression(i: number): RelationalExpressionContext | null;
    public relationalExpression(i?: number): RelationalExpressionContext[] | RelationalExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(RelationalExpressionContext);
        }

        return this.getRuleContext(i, RelationalExpressionContext);
    }
    public EQ(): antlr.TerminalNode[];
    public EQ(i: number): antlr.TerminalNode | null;
    public EQ(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.EQ);
    	} else {
    		return this.getToken(CnxParser.EQ, i);
    	}
    }
    public NEQ(): antlr.TerminalNode[];
    public NEQ(i: number): antlr.TerminalNode | null;
    public NEQ(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.NEQ);
    	} else {
    		return this.getToken(CnxParser.NEQ, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_equalityExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterEqualityExpression) {
             listener.enterEqualityExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitEqualityExpression) {
             listener.exitEqualityExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitEqualityExpression) {
            return visitor.visitEqualityExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class RelationalExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public bitwiseOrExpression(): BitwiseOrExpressionContext[];
    public bitwiseOrExpression(i: number): BitwiseOrExpressionContext | null;
    public bitwiseOrExpression(i?: number): BitwiseOrExpressionContext[] | BitwiseOrExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BitwiseOrExpressionContext);
        }

        return this.getRuleContext(i, BitwiseOrExpressionContext);
    }
    public LT(): antlr.TerminalNode[];
    public LT(i: number): antlr.TerminalNode | null;
    public LT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.LT);
    	} else {
    		return this.getToken(CnxParser.LT, i);
    	}
    }
    public GT(): antlr.TerminalNode[];
    public GT(i: number): antlr.TerminalNode | null;
    public GT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.GT);
    	} else {
    		return this.getToken(CnxParser.GT, i);
    	}
    }
    public LTE(): antlr.TerminalNode[];
    public LTE(i: number): antlr.TerminalNode | null;
    public LTE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.LTE);
    	} else {
    		return this.getToken(CnxParser.LTE, i);
    	}
    }
    public GTE(): antlr.TerminalNode[];
    public GTE(i: number): antlr.TerminalNode | null;
    public GTE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.GTE);
    	} else {
    		return this.getToken(CnxParser.GTE, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_relationalExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterRelationalExpression) {
             listener.enterRelationalExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitRelationalExpression) {
             listener.exitRelationalExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitRelationalExpression) {
            return visitor.visitRelationalExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BitwiseOrExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public bitwiseXorExpression(): BitwiseXorExpressionContext[];
    public bitwiseXorExpression(i: number): BitwiseXorExpressionContext | null;
    public bitwiseXorExpression(i?: number): BitwiseXorExpressionContext[] | BitwiseXorExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BitwiseXorExpressionContext);
        }

        return this.getRuleContext(i, BitwiseXorExpressionContext);
    }
    public BITOR(): antlr.TerminalNode[];
    public BITOR(i: number): antlr.TerminalNode | null;
    public BITOR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.BITOR);
    	} else {
    		return this.getToken(CnxParser.BITOR, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_bitwiseOrExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterBitwiseOrExpression) {
             listener.enterBitwiseOrExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitBitwiseOrExpression) {
             listener.exitBitwiseOrExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitBitwiseOrExpression) {
            return visitor.visitBitwiseOrExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BitwiseXorExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public bitwiseAndExpression(): BitwiseAndExpressionContext[];
    public bitwiseAndExpression(i: number): BitwiseAndExpressionContext | null;
    public bitwiseAndExpression(i?: number): BitwiseAndExpressionContext[] | BitwiseAndExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BitwiseAndExpressionContext);
        }

        return this.getRuleContext(i, BitwiseAndExpressionContext);
    }
    public BITXOR(): antlr.TerminalNode[];
    public BITXOR(i: number): antlr.TerminalNode | null;
    public BITXOR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.BITXOR);
    	} else {
    		return this.getToken(CnxParser.BITXOR, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_bitwiseXorExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterBitwiseXorExpression) {
             listener.enterBitwiseXorExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitBitwiseXorExpression) {
             listener.exitBitwiseXorExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitBitwiseXorExpression) {
            return visitor.visitBitwiseXorExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BitwiseAndExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public shiftExpression(): ShiftExpressionContext[];
    public shiftExpression(i: number): ShiftExpressionContext | null;
    public shiftExpression(i?: number): ShiftExpressionContext[] | ShiftExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ShiftExpressionContext);
        }

        return this.getRuleContext(i, ShiftExpressionContext);
    }
    public BITAND(): antlr.TerminalNode[];
    public BITAND(i: number): antlr.TerminalNode | null;
    public BITAND(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.BITAND);
    	} else {
    		return this.getToken(CnxParser.BITAND, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_bitwiseAndExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterBitwiseAndExpression) {
             listener.enterBitwiseAndExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitBitwiseAndExpression) {
             listener.exitBitwiseAndExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitBitwiseAndExpression) {
            return visitor.visitBitwiseAndExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ShiftExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public additiveExpression(): AdditiveExpressionContext[];
    public additiveExpression(i: number): AdditiveExpressionContext | null;
    public additiveExpression(i?: number): AdditiveExpressionContext[] | AdditiveExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AdditiveExpressionContext);
        }

        return this.getRuleContext(i, AdditiveExpressionContext);
    }
    public LSHIFT(): antlr.TerminalNode[];
    public LSHIFT(i: number): antlr.TerminalNode | null;
    public LSHIFT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.LSHIFT);
    	} else {
    		return this.getToken(CnxParser.LSHIFT, i);
    	}
    }
    public RSHIFT(): antlr.TerminalNode[];
    public RSHIFT(i: number): antlr.TerminalNode | null;
    public RSHIFT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.RSHIFT);
    	} else {
    		return this.getToken(CnxParser.RSHIFT, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_shiftExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterShiftExpression) {
             listener.enterShiftExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitShiftExpression) {
             listener.exitShiftExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitShiftExpression) {
            return visitor.visitShiftExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AdditiveExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public multiplicativeExpression(): MultiplicativeExpressionContext[];
    public multiplicativeExpression(i: number): MultiplicativeExpressionContext | null;
    public multiplicativeExpression(i?: number): MultiplicativeExpressionContext[] | MultiplicativeExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(MultiplicativeExpressionContext);
        }

        return this.getRuleContext(i, MultiplicativeExpressionContext);
    }
    public PLUS(): antlr.TerminalNode[];
    public PLUS(i: number): antlr.TerminalNode | null;
    public PLUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.PLUS);
    	} else {
    		return this.getToken(CnxParser.PLUS, i);
    	}
    }
    public MINUS(): antlr.TerminalNode[];
    public MINUS(i: number): antlr.TerminalNode | null;
    public MINUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.MINUS);
    	} else {
    		return this.getToken(CnxParser.MINUS, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_additiveExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterAdditiveExpression) {
             listener.enterAdditiveExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitAdditiveExpression) {
             listener.exitAdditiveExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitAdditiveExpression) {
            return visitor.visitAdditiveExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MultiplicativeExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public unaryExpression(): UnaryExpressionContext[];
    public unaryExpression(i: number): UnaryExpressionContext | null;
    public unaryExpression(i?: number): UnaryExpressionContext[] | UnaryExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(UnaryExpressionContext);
        }

        return this.getRuleContext(i, UnaryExpressionContext);
    }
    public STAR(): antlr.TerminalNode[];
    public STAR(i: number): antlr.TerminalNode | null;
    public STAR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.STAR);
    	} else {
    		return this.getToken(CnxParser.STAR, i);
    	}
    }
    public SLASH(): antlr.TerminalNode[];
    public SLASH(i: number): antlr.TerminalNode | null;
    public SLASH(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.SLASH);
    	} else {
    		return this.getToken(CnxParser.SLASH, i);
    	}
    }
    public PERCENT(): antlr.TerminalNode[];
    public PERCENT(i: number): antlr.TerminalNode | null;
    public PERCENT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.PERCENT);
    	} else {
    		return this.getToken(CnxParser.PERCENT, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_multiplicativeExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterMultiplicativeExpression) {
             listener.enterMultiplicativeExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitMultiplicativeExpression) {
             listener.exitMultiplicativeExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitMultiplicativeExpression) {
            return visitor.visitMultiplicativeExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UnaryExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.NOT, 0);
    }
    public unaryExpression(): UnaryExpressionContext | null {
        return this.getRuleContext(0, UnaryExpressionContext);
    }
    public MINUS(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.MINUS, 0);
    }
    public BITNOT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITNOT, 0);
    }
    public postfixExpression(): PostfixExpressionContext | null {
        return this.getRuleContext(0, PostfixExpressionContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_unaryExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterUnaryExpression) {
             listener.enterUnaryExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitUnaryExpression) {
             listener.exitUnaryExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitUnaryExpression) {
            return visitor.visitUnaryExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PostfixExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public primaryExpression(): PrimaryExpressionContext | null {
        return this.getRuleContext(0, PrimaryExpressionContext);
    }
    public postfixOp(): PostfixOpContext[];
    public postfixOp(i: number): PostfixOpContext | null;
    public postfixOp(i?: number): PostfixOpContext[] | PostfixOpContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PostfixOpContext);
        }

        return this.getRuleContext(i, PostfixOpContext);
    }
    public primitiveType(): PrimitiveTypeContext | null {
        return this.getRuleContext(0, PrimitiveTypeContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DOT, 0);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IDENTIFIER, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_postfixExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterPostfixExpression) {
             listener.enterPostfixExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitPostfixExpression) {
             listener.exitPostfixExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitPostfixExpression) {
            return visitor.visitPostfixExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PostfixOpContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.DOT, 0);
    }
    public memberName(): MemberNameContext | null {
        return this.getRuleContext(0, MemberNameContext);
    }
    public LBRACKET(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LBRACKET, 0);
    }
    public expression(): ExpressionContext[];
    public expression(i: number): ExpressionContext | null;
    public expression(i?: number): ExpressionContext[] | ExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }

        return this.getRuleContext(i, ExpressionContext);
    }
    public RBRACKET(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RBRACKET, 0);
    }
    public COMMA(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.COMMA, 0);
    }
    public LPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LPAREN, 0);
    }
    public RPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RPAREN, 0);
    }
    public argumentList(): ArgumentListContext | null {
        return this.getRuleContext(0, ArgumentListContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_postfixOp;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterPostfixOp) {
             listener.enterPostfixOp(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitPostfixOp) {
             listener.exitPostfixOp(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitPostfixOp) {
            return visitor.visitPostfixOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PrimaryExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public sizeofExpression(): SizeofExpressionContext | null {
        return this.getRuleContext(0, SizeofExpressionContext);
    }
    public castExpression(): CastExpressionContext | null {
        return this.getRuleContext(0, CastExpressionContext);
    }
    public structInitializer(): StructInitializerContext | null {
        return this.getRuleContext(0, StructInitializerContext);
    }
    public arrayInitializer(): ArrayInitializerContext | null {
        return this.getRuleContext(0, ArrayInitializerContext);
    }
    public THIS(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.THIS, 0);
    }
    public GLOBAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.GLOBAL, 0);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IDENTIFIER, 0);
    }
    public literal(): LiteralContext | null {
        return this.getRuleContext(0, LiteralContext);
    }
    public LPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LPAREN, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public RPAREN(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.RPAREN, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_primaryExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterPrimaryExpression) {
             listener.enterPrimaryExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitPrimaryExpression) {
             listener.exitPrimaryExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitPrimaryExpression) {
            return visitor.visitPrimaryExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SizeofExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public SIZEOF(): antlr.TerminalNode {
        return this.getToken(CnxParser.SIZEOF, 0)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.LPAREN, 0)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.RPAREN, 0)!;
    }
    public type(): TypeContext | null {
        return this.getRuleContext(0, TypeContext);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_sizeofExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterSizeofExpression) {
             listener.enterSizeofExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitSizeofExpression) {
             listener.exitSizeofExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitSizeofExpression) {
            return visitor.visitSizeofExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CastExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.LPAREN, 0)!;
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(CnxParser.RPAREN, 0)!;
    }
    public unaryExpression(): UnaryExpressionContext {
        return this.getRuleContext(0, UnaryExpressionContext)!;
    }
    public overflowModifier(): OverflowModifierContext | null {
        return this.getRuleContext(0, OverflowModifierContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_castExpression;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterCastExpression) {
             listener.enterCastExpression(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitCastExpression) {
             listener.exitCastExpression(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitCastExpression) {
            return visitor.visitCastExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructInitializerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACE, 0)!;
    }
    public fieldInitializerList(): FieldInitializerListContext {
        return this.getRuleContext(0, FieldInitializerListContext)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACE, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_structInitializer;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterStructInitializer) {
             listener.enterStructInitializer(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitStructInitializer) {
             listener.exitStructInitializer(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitStructInitializer) {
            return visitor.visitStructInitializer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FieldInitializerListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public fieldInitializer(): FieldInitializerContext[];
    public fieldInitializer(i: number): FieldInitializerContext | null;
    public fieldInitializer(i?: number): FieldInitializerContext[] | FieldInitializerContext | null {
        if (i === undefined) {
            return this.getRuleContexts(FieldInitializerContext);
        }

        return this.getRuleContext(i, FieldInitializerContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.COMMA);
    	} else {
    		return this.getToken(CnxParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_fieldInitializerList;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterFieldInitializerList) {
             listener.enterFieldInitializerList(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitFieldInitializerList) {
             listener.exitFieldInitializerList(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitFieldInitializerList) {
            return visitor.visitFieldInitializerList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FieldInitializerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public COLON(): antlr.TerminalNode {
        return this.getToken(CnxParser.COLON, 0)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_fieldInitializer;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterFieldInitializer) {
             listener.enterFieldInitializer(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitFieldInitializer) {
             listener.exitFieldInitializer(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitFieldInitializer) {
            return visitor.visitFieldInitializer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArrayInitializerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACKET, 0)!;
    }
    public arrayInitializerElement(): ArrayInitializerElementContext[];
    public arrayInitializerElement(i: number): ArrayInitializerElementContext | null;
    public arrayInitializerElement(i?: number): ArrayInitializerElementContext[] | ArrayInitializerElementContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ArrayInitializerElementContext);
        }

        return this.getRuleContext(i, ArrayInitializerElementContext);
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACKET, 0)!;
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.COMMA);
    	} else {
    		return this.getToken(CnxParser.COMMA, i);
    	}
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public STAR(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.STAR, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_arrayInitializer;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterArrayInitializer) {
             listener.enterArrayInitializer(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitArrayInitializer) {
             listener.exitArrayInitializer(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitArrayInitializer) {
            return visitor.visitArrayInitializer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArrayInitializerElementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public structInitializer(): StructInitializerContext | null {
        return this.getRuleContext(0, StructInitializerContext);
    }
    public arrayInitializer(): ArrayInitializerContext | null {
        return this.getRuleContext(0, ArrayInitializerContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_arrayInitializerElement;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterArrayInitializerElement) {
             listener.enterArrayInitializerElement(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitArrayInitializerElement) {
             listener.exitArrayInitializerElement(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitArrayInitializerElement) {
            return visitor.visitArrayInitializerElement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArgumentListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expression(): ExpressionContext[];
    public expression(i: number): ExpressionContext | null;
    public expression(i?: number): ExpressionContext[] | ExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }

        return this.getRuleContext(i, ExpressionContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.COMMA);
    	} else {
    		return this.getToken(CnxParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_argumentList;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterArgumentList) {
             listener.enterArgumentList(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitArgumentList) {
             listener.exitArgumentList(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitArgumentList) {
            return visitor.visitArgumentList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public primitiveType(): PrimitiveTypeContext | null {
        return this.getRuleContext(0, PrimitiveTypeContext);
    }
    public stringType(): StringTypeContext | null {
        return this.getRuleContext(0, StringTypeContext);
    }
    public scopedType(): ScopedTypeContext | null {
        return this.getRuleContext(0, ScopedTypeContext);
    }
    public globalType(): GlobalTypeContext | null {
        return this.getRuleContext(0, GlobalTypeContext);
    }
    public qualifiedType(): QualifiedTypeContext | null {
        return this.getRuleContext(0, QualifiedTypeContext);
    }
    public templateType(): TemplateTypeContext | null {
        return this.getRuleContext(0, TemplateTypeContext);
    }
    public userType(): UserTypeContext | null {
        return this.getRuleContext(0, UserTypeContext);
    }
    public arrayType(): ArrayTypeContext | null {
        return this.getRuleContext(0, ArrayTypeContext);
    }
    public VOID(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.VOID, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_type;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterType) {
             listener.enterType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitType) {
             listener.exitType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitType) {
            return visitor.visitType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ScopedTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public THIS(): antlr.TerminalNode {
        return this.getToken(CnxParser.THIS, 0)!;
    }
    public DOT(): antlr.TerminalNode {
        return this.getToken(CnxParser.DOT, 0)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_scopedType;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterScopedType) {
             listener.enterScopedType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitScopedType) {
             listener.exitScopedType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitScopedType) {
            return visitor.visitScopedType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GlobalTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public GLOBAL(): antlr.TerminalNode {
        return this.getToken(CnxParser.GLOBAL, 0)!;
    }
    public DOT(): antlr.TerminalNode {
        return this.getToken(CnxParser.DOT, 0)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_globalType;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterGlobalType) {
             listener.enterGlobalType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitGlobalType) {
             listener.exitGlobalType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitGlobalType) {
            return visitor.visitGlobalType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class QualifiedTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.IDENTIFIER);
    	} else {
    		return this.getToken(CnxParser.IDENTIFIER, i);
    	}
    }
    public DOT(): antlr.TerminalNode[];
    public DOT(i: number): antlr.TerminalNode | null;
    public DOT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.DOT);
    	} else {
    		return this.getToken(CnxParser.DOT, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_qualifiedType;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterQualifiedType) {
             listener.enterQualifiedType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitQualifiedType) {
             listener.exitQualifiedType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitQualifiedType) {
            return visitor.visitQualifiedType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PrimitiveTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public U8(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.U8, 0);
    }
    public U16(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.U16, 0);
    }
    public U32(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.U32, 0);
    }
    public U64(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.U64, 0);
    }
    public I8(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.I8, 0);
    }
    public I16(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.I16, 0);
    }
    public I32(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.I32, 0);
    }
    public I64(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.I64, 0);
    }
    public F32(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.F32, 0);
    }
    public F64(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.F64, 0);
    }
    public BOOL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BOOL, 0);
    }
    public ISR_TYPE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.ISR_TYPE, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_primitiveType;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterPrimitiveType) {
             listener.enterPrimitiveType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitPrimitiveType) {
             listener.exitPrimitiveType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitPrimitiveType) {
            return visitor.visitPrimitiveType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UserTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_userType;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterUserType) {
             listener.enterUserType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitUserType) {
             listener.exitUserType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitUserType) {
            return visitor.visitUserType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public LT(): antlr.TerminalNode {
        return this.getToken(CnxParser.LT, 0)!;
    }
    public templateArgumentList(): TemplateArgumentListContext {
        return this.getRuleContext(0, TemplateArgumentListContext)!;
    }
    public GT(): antlr.TerminalNode {
        return this.getToken(CnxParser.GT, 0)!;
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_templateType;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterTemplateType) {
             listener.enterTemplateType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitTemplateType) {
             listener.exitTemplateType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitTemplateType) {
            return visitor.visitTemplateType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateArgumentListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public templateArgument(): TemplateArgumentContext[];
    public templateArgument(i: number): TemplateArgumentContext | null;
    public templateArgument(i?: number): TemplateArgumentContext[] | TemplateArgumentContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TemplateArgumentContext);
        }

        return this.getRuleContext(i, TemplateArgumentContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CnxParser.COMMA);
    	} else {
    		return this.getToken(CnxParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_templateArgumentList;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterTemplateArgumentList) {
             listener.enterTemplateArgumentList(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitTemplateArgumentList) {
             listener.exitTemplateArgumentList(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitTemplateArgumentList) {
            return visitor.visitTemplateArgumentList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateArgumentContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public templateType(): TemplateTypeContext | null {
        return this.getRuleContext(0, TemplateTypeContext);
    }
    public primitiveType(): PrimitiveTypeContext | null {
        return this.getRuleContext(0, PrimitiveTypeContext);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IDENTIFIER, 0);
    }
    public INTEGER_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.INTEGER_LITERAL, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_templateArgument;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterTemplateArgument) {
             listener.enterTemplateArgument(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitTemplateArgument) {
             listener.exitTemplateArgument(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitTemplateArgument) {
            return visitor.visitTemplateArgument(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StringTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode {
        return this.getToken(CnxParser.STRING, 0)!;
    }
    public LT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.LT, 0);
    }
    public INTEGER_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.INTEGER_LITERAL, 0);
    }
    public GT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.GT, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_stringType;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterStringType) {
             listener.enterStringType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitStringType) {
             listener.exitStringType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitStringType) {
            return visitor.visitStringType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArrayTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public primitiveType(): PrimitiveTypeContext | null {
        return this.getRuleContext(0, PrimitiveTypeContext);
    }
    public arrayTypeDimension(): ArrayTypeDimensionContext[];
    public arrayTypeDimension(i: number): ArrayTypeDimensionContext | null;
    public arrayTypeDimension(i?: number): ArrayTypeDimensionContext[] | ArrayTypeDimensionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ArrayTypeDimensionContext);
        }

        return this.getRuleContext(i, ArrayTypeDimensionContext);
    }
    public userType(): UserTypeContext | null {
        return this.getRuleContext(0, UserTypeContext);
    }
    public stringType(): StringTypeContext | null {
        return this.getRuleContext(0, StringTypeContext);
    }
    public scopedType(): ScopedTypeContext | null {
        return this.getRuleContext(0, ScopedTypeContext);
    }
    public qualifiedType(): QualifiedTypeContext | null {
        return this.getRuleContext(0, QualifiedTypeContext);
    }
    public globalType(): GlobalTypeContext | null {
        return this.getRuleContext(0, GlobalTypeContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_arrayType;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterArrayType) {
             listener.enterArrayType(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitArrayType) {
             listener.exitArrayType(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitArrayType) {
            return visitor.visitArrayType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArrayTypeDimensionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACKET, 0)!;
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACKET, 0)!;
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_arrayTypeDimension;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterArrayTypeDimension) {
             listener.enterArrayTypeDimension(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitArrayTypeDimension) {
             listener.exitArrayTypeDimension(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitArrayTypeDimension) {
            return visitor.visitArrayTypeDimension(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public SUFFIXED_DECIMAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.SUFFIXED_DECIMAL, 0);
    }
    public SUFFIXED_HEX(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.SUFFIXED_HEX, 0);
    }
    public SUFFIXED_BINARY(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.SUFFIXED_BINARY, 0);
    }
    public SUFFIXED_FLOAT(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.SUFFIXED_FLOAT, 0);
    }
    public INTEGER_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.INTEGER_LITERAL, 0);
    }
    public HEX_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.HEX_LITERAL, 0);
    }
    public BINARY_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BINARY_LITERAL, 0);
    }
    public FLOAT_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.FLOAT_LITERAL, 0);
    }
    public STRING_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.STRING_LITERAL, 0);
    }
    public CHAR_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.CHAR_LITERAL, 0);
    }
    public TRUE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.TRUE, 0);
    }
    public FALSE(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.FALSE, 0);
    }
    public C_NULL(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.C_NULL, 0);
    }
    public override get ruleIndex(): number {
        return CnxParser.RULE_literal;
    }
    public override enterRule(listener: CnxListener): void {
        if(listener.enterLiteral) {
             listener.enterLiteral(this);
        }
    }
    public override exitRule(listener: CnxListener): void {
        if(listener.exitLiteral) {
             listener.exitLiteral(this);
        }
    }
    public override accept<Result>(visitor: CnxVisitor<Result>): Result | null {
        if (visitor.visitLiteral) {
            return visitor.visitLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
