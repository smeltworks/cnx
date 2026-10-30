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
    public static readonly RULE_accessModifier = 12;
    public static readonly RULE_structDeclaration = 13;
    public static readonly RULE_structMember = 14;
    public static readonly RULE_enumDeclaration = 15;
    public static readonly RULE_enumMember = 16;
    public static readonly RULE_bitmapDeclaration = 17;
    public static readonly RULE_bitmapType = 18;
    public static readonly RULE_bitmapMember = 19;
    public static readonly RULE_functionDeclaration = 20;
    public static readonly RULE_parameterList = 21;
    public static readonly RULE_parameter = 22;
    public static readonly RULE_constModifier = 23;
    public static readonly RULE_mutModifier = 24;
    public static readonly RULE_volatileModifier = 25;
    public static readonly RULE_overflowModifier = 26;
    public static readonly RULE_atomicModifier = 27;
    public static readonly RULE_arrayDimension = 28;
    public static readonly RULE_variableDeclaration = 29;
    public static readonly RULE_constructorArgumentList = 30;
    public static readonly RULE_block = 31;
    public static readonly RULE_statement = 32;
    public static readonly RULE_criticalStatement = 33;
    public static readonly RULE_assignmentStatement = 34;
    public static readonly RULE_assignmentOperator = 35;
    public static readonly RULE_assignmentTarget = 36;
    public static readonly RULE_postfixTargetOp = 37;
    public static readonly RULE_expressionStatement = 38;
    public static readonly RULE_ifStatement = 39;
    public static readonly RULE_whileStatement = 40;
    public static readonly RULE_doWhileStatement = 41;
    public static readonly RULE_forStatement = 42;
    public static readonly RULE_foreverStatement = 43;
    public static readonly RULE_forInit = 44;
    public static readonly RULE_forVarDecl = 45;
    public static readonly RULE_forAssignment = 46;
    public static readonly RULE_forUpdate = 47;
    public static readonly RULE_returnStatement = 48;
    public static readonly RULE_switchStatement = 49;
    public static readonly RULE_switchCase = 50;
    public static readonly RULE_caseLabel = 51;
    public static readonly RULE_defaultCase = 52;
    public static readonly RULE_expression = 53;
    public static readonly RULE_ternaryExpression = 54;
    public static readonly RULE_orExpression = 55;
    public static readonly RULE_andExpression = 56;
    public static readonly RULE_equalityExpression = 57;
    public static readonly RULE_relationalExpression = 58;
    public static readonly RULE_bitwiseOrExpression = 59;
    public static readonly RULE_bitwiseXorExpression = 60;
    public static readonly RULE_bitwiseAndExpression = 61;
    public static readonly RULE_shiftExpression = 62;
    public static readonly RULE_additiveExpression = 63;
    public static readonly RULE_multiplicativeExpression = 64;
    public static readonly RULE_unaryExpression = 65;
    public static readonly RULE_postfixExpression = 66;
    public static readonly RULE_postfixOp = 67;
    public static readonly RULE_primaryExpression = 68;
    public static readonly RULE_sizeofExpression = 69;
    public static readonly RULE_castExpression = 70;
    public static readonly RULE_structInitializer = 71;
    public static readonly RULE_fieldInitializerList = 72;
    public static readonly RULE_fieldInitializer = 73;
    public static readonly RULE_arrayInitializer = 74;
    public static readonly RULE_arrayInitializerElement = 75;
    public static readonly RULE_argumentList = 76;
    public static readonly RULE_type = 77;
    public static readonly RULE_scopedType = 78;
    public static readonly RULE_globalType = 79;
    public static readonly RULE_qualifiedType = 80;
    public static readonly RULE_primitiveType = 81;
    public static readonly RULE_userType = 82;
    public static readonly RULE_templateType = 83;
    public static readonly RULE_templateArgumentList = 84;
    public static readonly RULE_templateArgument = 85;
    public static readonly RULE_stringType = 86;
    public static readonly RULE_arrayType = 87;
    public static readonly RULE_arrayTypeDimension = 88;
    public static readonly RULE_literal = 89;

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
        "accessModifier", "structDeclaration", "structMember", "enumDeclaration", 
        "enumMember", "bitmapDeclaration", "bitmapType", "bitmapMember", 
        "functionDeclaration", "parameterList", "parameter", "constModifier", 
        "mutModifier", "volatileModifier", "overflowModifier", "atomicModifier", 
        "arrayDimension", "variableDeclaration", "constructorArgumentList", 
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
            this.state = 184;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2044) !== 0)) {
                {
                this.state = 182;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CnxParser.INCLUDE_DIRECTIVE:
                    {
                    this.state = 180;
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
                    this.state = 181;
                    this.preprocessorDirective();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                this.state = 186;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 190;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 7993344) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146973757) !== 0) || _la === 115) {
                {
                {
                this.state = 187;
                this.declaration();
                }
                }
                this.state = 192;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 193;
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
            this.state = 195;
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
            this.state = 200;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.DEFINE_FUNCTION:
            case CnxParser.DEFINE_WITH_VALUE:
            case CnxParser.DEFINE_FLAG:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 197;
                this.defineDirective();
                }
                break;
            case CnxParser.IFDEF_DIRECTIVE:
            case CnxParser.IFNDEF_DIRECTIVE:
            case CnxParser.ELSE_DIRECTIVE:
            case CnxParser.ENDIF_DIRECTIVE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 198;
                this.conditionalDirective();
                }
                break;
            case CnxParser.PRAGMA_DIRECTIVE:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 199;
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
            this.state = 202;
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
            this.state = 204;
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
            this.state = 206;
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
            this.state = 215;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 4, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 208;
                this.scopeDeclaration();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 209;
                this.registerDeclaration();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 210;
                this.structDeclaration();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 211;
                this.enumDeclaration();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 212;
                this.bitmapDeclaration();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 213;
                this.functionDeclaration();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 214;
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
            this.state = 217;
            this.match(CnxParser.SCOPE);
            this.state = 218;
            this.match(CnxParser.IDENTIFIER);
            this.state = 219;
            this.match(CnxParser.LBRACE);
            this.state = 223;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 8384512) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146973757) !== 0) || _la === 115) {
                {
                {
                this.state = 220;
                this.scopeMember();
                }
                }
                this.state = 225;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 226;
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
            this.state = 252;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 12, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 229;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 228;
                    this.visibilityModifier();
                    }
                }

                this.state = 231;
                this.variableDeclaration();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 233;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 232;
                    this.visibilityModifier();
                    }
                }

                this.state = 235;
                this.functionDeclaration();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 237;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 236;
                    this.visibilityModifier();
                    }
                }

                this.state = 239;
                this.enumDeclaration();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 241;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 240;
                    this.visibilityModifier();
                    }
                }

                this.state = 243;
                this.bitmapDeclaration();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 245;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 244;
                    this.visibilityModifier();
                    }
                }

                this.state = 247;
                this.registerDeclaration();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 249;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 17 || _la === 18) {
                    {
                    this.state = 248;
                    this.visibilityModifier();
                    }
                }

                this.state = 251;
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
            this.state = 254;
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
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 256;
            this.match(CnxParser.REGISTER);
            this.state = 257;
            this.match(CnxParser.IDENTIFIER);
            this.state = 258;
            this.match(CnxParser.AT);
            this.state = 259;
            this.expression();
            this.state = 260;
            this.match(CnxParser.LBRACE);
            this.state = 264;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 115) {
                {
                {
                this.state = 261;
                this.registerMember();
                }
                }
                this.state = 266;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 267;
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
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 269;
            this.match(CnxParser.IDENTIFIER);
            this.state = 270;
            this.match(CnxParser.COLON);
            this.state = 271;
            this.type_();
            this.state = 272;
            this.accessModifier();
            this.state = 273;
            this.match(CnxParser.AT);
            this.state = 274;
            this.expression();
            this.state = 276;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 275;
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
    public accessModifier(): AccessModifierContext {
        let localContext = new AccessModifierContext(this.context, this.state);
        this.enterRule(localContext, 24, CnxParser.RULE_accessModifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 278;
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
        this.enterRule(localContext, 26, CnxParser.RULE_structDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 280;
            this.match(CnxParser.STRUCT);
            this.state = 281;
            this.match(CnxParser.IDENTIFIER);
            this.state = 282;
            this.match(CnxParser.LBRACE);
            this.state = 286;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4243456) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146965505) !== 0) || _la === 115) {
                {
                {
                this.state = 283;
                this.structMember();
                }
                }
                this.state = 288;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 289;
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
        this.enterRule(localContext, 28, CnxParser.RULE_structMember);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 292;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 291;
                this.overflowModifier();
                }
            }

            this.state = 294;
            this.type_();
            this.state = 295;
            this.match(CnxParser.IDENTIFIER);
            this.state = 299;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 102) {
                {
                {
                this.state = 296;
                this.arrayDimension();
                }
                }
                this.state = 301;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 302;
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
        this.enterRule(localContext, 30, CnxParser.RULE_enumDeclaration);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 304;
            this.match(CnxParser.ENUM);
            this.state = 305;
            this.match(CnxParser.IDENTIFIER);
            this.state = 306;
            this.match(CnxParser.LBRACE);
            this.state = 307;
            this.enumMember();
            this.state = 312;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 18, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 308;
                    this.match(CnxParser.COMMA);
                    this.state = 309;
                    this.enumMember();
                    }
                    }
                }
                this.state = 314;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 18, this.context);
            }
            this.state = 316;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 315;
                this.match(CnxParser.COMMA);
                }
            }

            this.state = 318;
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
        this.enterRule(localContext, 32, CnxParser.RULE_enumMember);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 320;
            this.match(CnxParser.IDENTIFIER);
            this.state = 323;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 77) {
                {
                this.state = 321;
                this.match(CnxParser.ASSIGN);
                this.state = 322;
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
        this.enterRule(localContext, 34, CnxParser.RULE_bitmapDeclaration);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 325;
            this.bitmapType();
            this.state = 326;
            this.match(CnxParser.IDENTIFIER);
            this.state = 327;
            this.match(CnxParser.LBRACE);
            this.state = 328;
            this.bitmapMember();
            this.state = 333;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 21, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 329;
                    this.match(CnxParser.COMMA);
                    this.state = 330;
                    this.bitmapMember();
                    }
                    }
                }
                this.state = 335;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 21, this.context);
            }
            this.state = 337;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 336;
                this.match(CnxParser.COMMA);
                }
            }

            this.state = 339;
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
        this.enterRule(localContext, 36, CnxParser.RULE_bitmapType);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 341;
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
        this.enterRule(localContext, 38, CnxParser.RULE_bitmapMember);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 343;
            this.match(CnxParser.IDENTIFIER);
            this.state = 347;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 102) {
                {
                this.state = 344;
                this.match(CnxParser.LBRACKET);
                this.state = 345;
                this.match(CnxParser.INTEGER_LITERAL);
                this.state = 346;
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
        this.enterRule(localContext, 40, CnxParser.RULE_functionDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 350;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 349;
                this.overflowModifier();
                }
            }

            this.state = 352;
            this.type_();
            this.state = 353;
            this.match(CnxParser.IDENTIFIER);
            this.state = 354;
            this.match(CnxParser.LPAREN);
            this.state = 356;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 5816320) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146959361) !== 0) || _la === 115) {
                {
                this.state = 355;
                this.parameterList();
                }
            }

            this.state = 358;
            this.match(CnxParser.RPAREN);
            this.state = 359;
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
        this.enterRule(localContext, 42, CnxParser.RULE_parameterList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 361;
            this.parameter();
            this.state = 366;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 362;
                this.match(CnxParser.COMMA);
                this.state = 363;
                this.parameter();
                }
                }
                this.state = 368;
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
        this.enterRule(localContext, 44, CnxParser.RULE_parameter);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 370;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 19) {
                {
                this.state = 369;
                this.constModifier();
                }
            }

            this.state = 373;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 20) {
                {
                this.state = 372;
                this.mutModifier();
                }
            }

            this.state = 375;
            this.type_();
            this.state = 376;
            this.match(CnxParser.IDENTIFIER);
            this.state = 380;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 102) {
                {
                {
                this.state = 377;
                this.arrayDimension();
                }
                }
                this.state = 382;
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
        this.enterRule(localContext, 46, CnxParser.RULE_constModifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 383;
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
        this.enterRule(localContext, 48, CnxParser.RULE_mutModifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 385;
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
        this.enterRule(localContext, 50, CnxParser.RULE_volatileModifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 387;
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
        this.enterRule(localContext, 52, CnxParser.RULE_overflowModifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 389;
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
        this.enterRule(localContext, 54, CnxParser.RULE_atomicModifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 391;
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
        this.enterRule(localContext, 56, CnxParser.RULE_arrayDimension);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 393;
            this.match(CnxParser.LBRACKET);
            this.state = 395;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879681) !== 0)) {
                {
                this.state = 394;
                this.expression();
                }
            }

            this.state = 397;
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
        this.enterRule(localContext, 58, CnxParser.RULE_variableDeclaration);
        let _la: number;
        try {
            this.state = 435;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 38, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 400;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 49) {
                    {
                    this.state = 399;
                    this.atomicModifier();
                    }
                }

                this.state = 403;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 21) {
                    {
                    this.state = 402;
                    this.volatileModifier();
                    }
                }

                this.state = 406;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 19) {
                    {
                    this.state = 405;
                    this.constModifier();
                    }
                }

                this.state = 409;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 20) {
                    {
                    this.state = 408;
                    this.mutModifier();
                    }
                }

                this.state = 412;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 47 || _la === 48) {
                    {
                    this.state = 411;
                    this.overflowModifier();
                    }
                }

                this.state = 414;
                this.type_();
                this.state = 415;
                this.match(CnxParser.IDENTIFIER);
                this.state = 419;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 102) {
                    {
                    {
                    this.state = 416;
                    this.arrayDimension();
                    }
                    }
                    this.state = 421;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 424;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 77) {
                    {
                    this.state = 422;
                    this.match(CnxParser.ASSIGN);
                    this.state = 423;
                    this.expression();
                    }
                }

                this.state = 426;
                this.match(CnxParser.SEMI);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 428;
                this.type_();
                this.state = 429;
                this.match(CnxParser.IDENTIFIER);
                this.state = 430;
                this.match(CnxParser.LPAREN);
                this.state = 431;
                this.constructorArgumentList();
                this.state = 432;
                this.match(CnxParser.RPAREN);
                this.state = 433;
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
        this.enterRule(localContext, 60, CnxParser.RULE_constructorArgumentList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 437;
            this.match(CnxParser.IDENTIFIER);
            this.state = 442;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 438;
                this.match(CnxParser.COMMA);
                this.state = 439;
                this.match(CnxParser.IDENTIFIER);
                }
                }
                this.state = 444;
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
        this.enterRule(localContext, 62, CnxParser.RULE_block);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 445;
            this.match(CnxParser.LBRACE);
            this.state = 449;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 16579555) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 1048575) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879681) !== 0)) {
                {
                {
                this.state = 446;
                this.statement();
                }
                }
                this.state = 451;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 452;
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
        this.enterRule(localContext, 64, CnxParser.RULE_statement);
        try {
            this.state = 466;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 41, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 454;
                this.variableDeclaration();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 455;
                this.assignmentStatement();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 456;
                this.expressionStatement();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 457;
                this.ifStatement();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 458;
                this.whileStatement();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 459;
                this.doWhileStatement();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 460;
                this.forStatement();
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 461;
                this.foreverStatement();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 462;
                this.switchStatement();
                }
                break;
            case 10:
                this.enterOuterAlt(localContext, 10);
                {
                this.state = 463;
                this.returnStatement();
                }
                break;
            case 11:
                this.enterOuterAlt(localContext, 11);
                {
                this.state = 464;
                this.criticalStatement();
                }
                break;
            case 12:
                this.enterOuterAlt(localContext, 12);
                {
                this.state = 465;
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
        this.enterRule(localContext, 66, CnxParser.RULE_criticalStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 468;
            this.match(CnxParser.CRITICAL);
            this.state = 469;
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
        this.enterRule(localContext, 68, CnxParser.RULE_assignmentStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 471;
            this.assignmentTarget();
            this.state = 472;
            this.assignmentOperator();
            this.state = 473;
            this.expression();
            this.state = 474;
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
        this.enterRule(localContext, 70, CnxParser.RULE_assignmentOperator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 476;
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
        this.enterRule(localContext, 72, CnxParser.RULE_assignmentTarget);
        let _la: number;
        try {
            this.state = 503;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.GLOBAL:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 478;
                this.match(CnxParser.GLOBAL);
                this.state = 479;
                this.match(CnxParser.DOT);
                this.state = 480;
                this.match(CnxParser.IDENTIFIER);
                this.state = 484;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 102 || _la === 106) {
                    {
                    {
                    this.state = 481;
                    this.postfixTargetOp();
                    }
                    }
                    this.state = 486;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case CnxParser.THIS:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 487;
                this.match(CnxParser.THIS);
                this.state = 488;
                this.match(CnxParser.DOT);
                this.state = 489;
                this.match(CnxParser.IDENTIFIER);
                this.state = 493;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 102 || _la === 106) {
                    {
                    {
                    this.state = 490;
                    this.postfixTargetOp();
                    }
                    }
                    this.state = 495;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case CnxParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 496;
                this.match(CnxParser.IDENTIFIER);
                this.state = 500;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 102 || _la === 106) {
                    {
                    {
                    this.state = 497;
                    this.postfixTargetOp();
                    }
                    }
                    this.state = 502;
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
        this.enterRule(localContext, 74, CnxParser.RULE_postfixTargetOp);
        try {
            this.state = 517;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 46, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 505;
                this.match(CnxParser.DOT);
                this.state = 506;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 507;
                this.match(CnxParser.LBRACKET);
                this.state = 508;
                this.expression();
                this.state = 509;
                this.match(CnxParser.RBRACKET);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 511;
                this.match(CnxParser.LBRACKET);
                this.state = 512;
                this.expression();
                this.state = 513;
                this.match(CnxParser.COMMA);
                this.state = 514;
                this.expression();
                this.state = 515;
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
    public expressionStatement(): ExpressionStatementContext {
        let localContext = new ExpressionStatementContext(this.context, this.state);
        this.enterRule(localContext, 76, CnxParser.RULE_expressionStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 519;
            this.expression();
            this.state = 520;
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
        this.enterRule(localContext, 78, CnxParser.RULE_ifStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 522;
            this.match(CnxParser.IF);
            this.state = 523;
            this.match(CnxParser.LPAREN);
            this.state = 524;
            this.expression();
            this.state = 525;
            this.match(CnxParser.RPAREN);
            this.state = 526;
            this.statement();
            this.state = 529;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 47, this.context) ) {
            case 1:
                {
                this.state = 527;
                this.match(CnxParser.ELSE);
                this.state = 528;
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
        this.enterRule(localContext, 80, CnxParser.RULE_whileStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 531;
            this.match(CnxParser.WHILE);
            this.state = 532;
            this.match(CnxParser.LPAREN);
            this.state = 533;
            this.expression();
            this.state = 534;
            this.match(CnxParser.RPAREN);
            this.state = 535;
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
        this.enterRule(localContext, 82, CnxParser.RULE_doWhileStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 537;
            this.match(CnxParser.DO);
            this.state = 538;
            this.block();
            this.state = 539;
            this.match(CnxParser.WHILE);
            this.state = 540;
            this.match(CnxParser.LPAREN);
            this.state = 541;
            this.expression();
            this.state = 542;
            this.match(CnxParser.RPAREN);
            this.state = 543;
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
        this.enterRule(localContext, 84, CnxParser.RULE_forStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 545;
            this.match(CnxParser.FOR);
            this.state = 546;
            this.match(CnxParser.LPAREN);
            this.state = 548;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 7389184) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146973697) !== 0) || _la === 115) {
                {
                this.state = 547;
                this.forInit();
                }
            }

            this.state = 550;
            this.match(CnxParser.SEMI);
            this.state = 552;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879681) !== 0)) {
                {
                this.state = 551;
                this.expression();
                }
            }

            this.state = 554;
            this.match(CnxParser.SEMI);
            this.state = 556;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14 || _la === 15 || _la === 115) {
                {
                this.state = 555;
                this.forUpdate();
                }
            }

            this.state = 558;
            this.match(CnxParser.RPAREN);
            this.state = 559;
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
        this.enterRule(localContext, 86, CnxParser.RULE_foreverStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 561;
            this.match(CnxParser.FOREVER);
            this.state = 562;
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
        this.enterRule(localContext, 88, CnxParser.RULE_forInit);
        try {
            this.state = 566;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 51, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 564;
                this.forVarDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 565;
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
        this.enterRule(localContext, 90, CnxParser.RULE_forVarDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 569;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 49) {
                {
                this.state = 568;
                this.atomicModifier();
                }
            }

            this.state = 572;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 21) {
                {
                this.state = 571;
                this.volatileModifier();
                }
            }

            this.state = 575;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 20) {
                {
                this.state = 574;
                this.mutModifier();
                }
            }

            this.state = 578;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 577;
                this.overflowModifier();
                }
            }

            this.state = 580;
            this.type_();
            this.state = 581;
            this.match(CnxParser.IDENTIFIER);
            this.state = 585;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 102) {
                {
                {
                this.state = 582;
                this.arrayDimension();
                }
                }
                this.state = 587;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 590;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 77) {
                {
                this.state = 588;
                this.match(CnxParser.ASSIGN);
                this.state = 589;
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
        this.enterRule(localContext, 92, CnxParser.RULE_forAssignment);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 592;
            this.assignmentTarget();
            this.state = 593;
            this.assignmentOperator();
            this.state = 594;
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
        this.enterRule(localContext, 94, CnxParser.RULE_forUpdate);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 596;
            this.assignmentTarget();
            this.state = 597;
            this.assignmentOperator();
            this.state = 598;
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
        this.enterRule(localContext, 96, CnxParser.RULE_returnStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 600;
            this.match(CnxParser.RETURN);
            this.state = 602;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879681) !== 0)) {
                {
                this.state = 601;
                this.expression();
                }
            }

            this.state = 604;
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
        this.enterRule(localContext, 98, CnxParser.RULE_switchStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 606;
            this.match(CnxParser.SWITCH);
            this.state = 607;
            this.match(CnxParser.LPAREN);
            this.state = 608;
            this.expression();
            this.state = 609;
            this.match(CnxParser.RPAREN);
            this.state = 610;
            this.match(CnxParser.LBRACE);
            this.state = 612;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 611;
                this.switchCase();
                }
                }
                this.state = 614;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 30);
            this.state = 617;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 31) {
                {
                this.state = 616;
                this.defaultCase();
                }
            }

            this.state = 619;
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
        this.enterRule(localContext, 100, CnxParser.RULE_switchCase);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 621;
            this.match(CnxParser.CASE);
            this.state = 622;
            this.caseLabel();
            this.state = 627;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 90) {
                {
                {
                this.state = 623;
                this.match(CnxParser.OR);
                this.state = 624;
                this.caseLabel();
                }
                }
                this.state = 629;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 630;
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
        this.enterRule(localContext, 102, CnxParser.RULE_caseLabel);
        let _la: number;
        try {
            this.state = 650;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 65, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 632;
                this.qualifiedType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 633;
                _la = this.tokenStream.LA(1);
                if(!(_la === 14 || _la === 15)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 634;
                this.match(CnxParser.DOT);
                this.state = 637;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 62, this.context) ) {
                case 1:
                    {
                    this.state = 635;
                    this.qualifiedType();
                    }
                    break;
                case 2:
                    {
                    this.state = 636;
                    this.match(CnxParser.IDENTIFIER);
                    }
                    break;
                }
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 639;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 641;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 85) {
                    {
                    this.state = 640;
                    this.match(CnxParser.MINUS);
                    }
                }

                this.state = 643;
                this.match(CnxParser.INTEGER_LITERAL);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 645;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 85) {
                    {
                    this.state = 644;
                    this.match(CnxParser.MINUS);
                    }
                }

                this.state = 647;
                this.match(CnxParser.HEX_LITERAL);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 648;
                this.match(CnxParser.BINARY_LITERAL);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 649;
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
        this.enterRule(localContext, 104, CnxParser.RULE_defaultCase);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 652;
            this.match(CnxParser.DEFAULT);
            this.state = 656;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 98) {
                {
                this.state = 653;
                this.match(CnxParser.LPAREN);
                this.state = 654;
                this.match(CnxParser.INTEGER_LITERAL);
                this.state = 655;
                this.match(CnxParser.RPAREN);
                }
            }

            this.state = 658;
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
        this.enterRule(localContext, 106, CnxParser.RULE_expression);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 660;
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
        this.enterRule(localContext, 108, CnxParser.RULE_ternaryExpression);
        try {
            this.state = 671;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 67, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 662;
                this.match(CnxParser.LPAREN);
                this.state = 663;
                this.orExpression();
                this.state = 664;
                this.match(CnxParser.RPAREN);
                this.state = 665;
                this.match(CnxParser.T__0);
                this.state = 666;
                this.orExpression();
                this.state = 667;
                this.match(CnxParser.COLON);
                this.state = 668;
                this.orExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 670;
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
        this.enterRule(localContext, 110, CnxParser.RULE_orExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 673;
            this.andExpression();
            this.state = 678;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 90) {
                {
                {
                this.state = 674;
                this.match(CnxParser.OR);
                this.state = 675;
                this.andExpression();
                }
                }
                this.state = 680;
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
        this.enterRule(localContext, 112, CnxParser.RULE_andExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 681;
            this.equalityExpression();
            this.state = 686;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 89) {
                {
                {
                this.state = 682;
                this.match(CnxParser.AND);
                this.state = 683;
                this.equalityExpression();
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
    public equalityExpression(): EqualityExpressionContext {
        let localContext = new EqualityExpressionContext(this.context, this.state);
        this.enterRule(localContext, 114, CnxParser.RULE_equalityExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 689;
            this.relationalExpression();
            this.state = 694;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 78 || _la === 79) {
                {
                {
                this.state = 690;
                _la = this.tokenStream.LA(1);
                if(!(_la === 78 || _la === 79)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 691;
                this.relationalExpression();
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
    public relationalExpression(): RelationalExpressionContext {
        let localContext = new RelationalExpressionContext(this.context, this.state);
        this.enterRule(localContext, 116, CnxParser.RULE_relationalExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 697;
            this.bitwiseOrExpression();
            this.state = 702;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 15) !== 0)) {
                {
                {
                this.state = 698;
                _la = this.tokenStream.LA(1);
                if(!(((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 15) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 699;
                this.bitwiseOrExpression();
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
    public bitwiseOrExpression(): BitwiseOrExpressionContext {
        let localContext = new BitwiseOrExpressionContext(this.context, this.state);
        this.enterRule(localContext, 118, CnxParser.RULE_bitwiseOrExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 705;
            this.bitwiseXorExpression();
            this.state = 710;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 93) {
                {
                {
                this.state = 706;
                this.match(CnxParser.BITOR);
                this.state = 707;
                this.bitwiseXorExpression();
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
    public bitwiseXorExpression(): BitwiseXorExpressionContext {
        let localContext = new BitwiseXorExpressionContext(this.context, this.state);
        this.enterRule(localContext, 120, CnxParser.RULE_bitwiseXorExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 713;
            this.bitwiseAndExpression();
            this.state = 718;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 94) {
                {
                {
                this.state = 714;
                this.match(CnxParser.BITXOR);
                this.state = 715;
                this.bitwiseAndExpression();
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
    public bitwiseAndExpression(): BitwiseAndExpressionContext {
        let localContext = new BitwiseAndExpressionContext(this.context, this.state);
        this.enterRule(localContext, 122, CnxParser.RULE_bitwiseAndExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 721;
            this.shiftExpression();
            this.state = 726;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 92) {
                {
                {
                this.state = 722;
                this.match(CnxParser.BITAND);
                this.state = 723;
                this.shiftExpression();
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
    public shiftExpression(): ShiftExpressionContext {
        let localContext = new ShiftExpressionContext(this.context, this.state);
        this.enterRule(localContext, 124, CnxParser.RULE_shiftExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 729;
            this.additiveExpression();
            this.state = 734;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 96 || _la === 97) {
                {
                {
                this.state = 730;
                _la = this.tokenStream.LA(1);
                if(!(_la === 96 || _la === 97)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 731;
                this.additiveExpression();
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
    public additiveExpression(): AdditiveExpressionContext {
        let localContext = new AdditiveExpressionContext(this.context, this.state);
        this.enterRule(localContext, 126, CnxParser.RULE_additiveExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 737;
            this.multiplicativeExpression();
            this.state = 742;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 84 || _la === 85) {
                {
                {
                this.state = 738;
                _la = this.tokenStream.LA(1);
                if(!(_la === 84 || _la === 85)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 739;
                this.multiplicativeExpression();
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
    public multiplicativeExpression(): MultiplicativeExpressionContext {
        let localContext = new MultiplicativeExpressionContext(this.context, this.state);
        this.enterRule(localContext, 128, CnxParser.RULE_multiplicativeExpression);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 745;
            this.unaryExpression();
            this.state = 750;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 77, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 746;
                    _la = this.tokenStream.LA(1);
                    if(!(((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 7) !== 0))) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 747;
                    this.unaryExpression();
                    }
                    }
                }
                this.state = 752;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 77, this.context);
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
        this.enterRule(localContext, 130, CnxParser.RULE_unaryExpression);
        try {
            this.state = 762;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.NOT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 753;
                this.match(CnxParser.NOT);
                this.state = 754;
                this.unaryExpression();
                }
                break;
            case CnxParser.MINUS:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 755;
                this.match(CnxParser.MINUS);
                this.state = 756;
                this.unaryExpression();
                }
                break;
            case CnxParser.BITNOT:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 757;
                this.match(CnxParser.BITNOT);
                this.state = 758;
                this.unaryExpression();
                }
                break;
            case CnxParser.BITAND:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 759;
                this.match(CnxParser.BITAND);
                this.state = 760;
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
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 761;
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
        this.enterRule(localContext, 132, CnxParser.RULE_postfixExpression);
        try {
            let alternative: number;
            this.state = 775;
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
                this.state = 764;
                this.primaryExpression();
                this.state = 768;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 79, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 765;
                        this.postfixOp();
                        }
                        }
                    }
                    this.state = 770;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 79, this.context);
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
                this.state = 771;
                this.primitiveType();
                this.state = 772;
                this.match(CnxParser.DOT);
                this.state = 773;
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
        this.enterRule(localContext, 134, CnxParser.RULE_postfixOp);
        let _la: number;
        try {
            this.state = 794;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 82, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 777;
                this.match(CnxParser.DOT);
                this.state = 778;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 779;
                this.match(CnxParser.LBRACKET);
                this.state = 780;
                this.expression();
                this.state = 781;
                this.match(CnxParser.RBRACKET);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 783;
                this.match(CnxParser.LBRACKET);
                this.state = 784;
                this.expression();
                this.state = 785;
                this.match(CnxParser.COMMA);
                this.state = 786;
                this.expression();
                this.state = 787;
                this.match(CnxParser.RBRACKET);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 789;
                this.match(CnxParser.LPAREN);
                this.state = 791;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879681) !== 0)) {
                    {
                    this.state = 790;
                    this.argumentList();
                    }
                }

                this.state = 793;
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
    public primaryExpression(): PrimaryExpressionContext {
        let localContext = new PrimaryExpressionContext(this.context, this.state);
        this.enterRule(localContext, 136, CnxParser.RULE_primaryExpression);
        try {
            this.state = 808;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 83, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 796;
                this.sizeofExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 797;
                this.castExpression();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 798;
                this.structInitializer();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 799;
                this.arrayInitializer();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 800;
                this.match(CnxParser.THIS);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 801;
                this.match(CnxParser.GLOBAL);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 802;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 803;
                this.literal();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 804;
                this.match(CnxParser.LPAREN);
                this.state = 805;
                this.expression();
                this.state = 806;
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
        this.enterRule(localContext, 138, CnxParser.RULE_sizeofExpression);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 810;
            this.match(CnxParser.SIZEOF);
            this.state = 811;
            this.match(CnxParser.LPAREN);
            this.state = 814;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 84, this.context) ) {
            case 1:
                {
                this.state = 812;
                this.type_();
                }
                break;
            case 2:
                {
                this.state = 813;
                this.expression();
                }
                break;
            }
            this.state = 816;
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
        this.enterRule(localContext, 140, CnxParser.RULE_castExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 818;
            this.match(CnxParser.LPAREN);
            this.state = 820;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 819;
                this.overflowModifier();
                }
            }

            this.state = 822;
            this.type_();
            this.state = 823;
            this.match(CnxParser.RPAREN);
            this.state = 824;
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
        this.enterRule(localContext, 142, CnxParser.RULE_structInitializer);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 826;
            this.match(CnxParser.LBRACE);
            this.state = 827;
            this.fieldInitializerList();
            this.state = 828;
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
        this.enterRule(localContext, 144, CnxParser.RULE_fieldInitializerList);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 830;
            this.fieldInitializer();
            this.state = 835;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 86, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 831;
                    this.match(CnxParser.COMMA);
                    this.state = 832;
                    this.fieldInitializer();
                    }
                    }
                }
                this.state = 837;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 86, this.context);
            }
            this.state = 839;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 838;
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
        this.enterRule(localContext, 146, CnxParser.RULE_fieldInitializer);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 841;
            this.match(CnxParser.IDENTIFIER);
            this.state = 842;
            this.match(CnxParser.COLON);
            this.state = 843;
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
        this.enterRule(localContext, 148, CnxParser.RULE_arrayInitializer);
        let _la: number;
        try {
            let alternative: number;
            this.state = 864;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 90, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 845;
                this.match(CnxParser.LBRACKET);
                this.state = 846;
                this.arrayInitializerElement();
                this.state = 851;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 88, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 847;
                        this.match(CnxParser.COMMA);
                        this.state = 848;
                        this.arrayInitializerElement();
                        }
                        }
                    }
                    this.state = 853;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 88, this.context);
                }
                this.state = 855;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 105) {
                    {
                    this.state = 854;
                    this.match(CnxParser.COMMA);
                    }
                }

                this.state = 857;
                this.match(CnxParser.RBRACKET);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 859;
                this.match(CnxParser.LBRACKET);
                this.state = 860;
                this.expression();
                this.state = 861;
                this.match(CnxParser.STAR);
                this.state = 862;
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
        this.enterRule(localContext, 150, CnxParser.RULE_arrayInitializerElement);
        try {
            this.state = 869;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 91, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 866;
                this.expression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 867;
                this.structInitializer();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 868;
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
        this.enterRule(localContext, 152, CnxParser.RULE_argumentList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 871;
            this.expression();
            this.state = 876;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 872;
                this.match(CnxParser.COMMA);
                this.state = 873;
                this.expression();
                }
                }
                this.state = 878;
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
        this.enterRule(localContext, 154, CnxParser.RULE_type);
        try {
            this.state = 888;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 93, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 879;
                this.primitiveType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 880;
                this.stringType();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 881;
                this.scopedType();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 882;
                this.globalType();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 883;
                this.qualifiedType();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 884;
                this.templateType();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 885;
                this.userType();
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 886;
                this.arrayType();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 887;
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
        this.enterRule(localContext, 156, CnxParser.RULE_scopedType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 890;
            this.match(CnxParser.THIS);
            this.state = 891;
            this.match(CnxParser.DOT);
            this.state = 892;
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
        this.enterRule(localContext, 158, CnxParser.RULE_globalType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 894;
            this.match(CnxParser.GLOBAL);
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
    public qualifiedType(): QualifiedTypeContext {
        let localContext = new QualifiedTypeContext(this.context, this.state);
        this.enterRule(localContext, 160, CnxParser.RULE_qualifiedType);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 898;
            this.match(CnxParser.IDENTIFIER);
            this.state = 901;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 899;
                this.match(CnxParser.DOT);
                this.state = 900;
                this.match(CnxParser.IDENTIFIER);
                }
                }
                this.state = 903;
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
        this.enterRule(localContext, 162, CnxParser.RULE_primitiveType);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 905;
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
        this.enterRule(localContext, 164, CnxParser.RULE_userType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 907;
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
        this.enterRule(localContext, 166, CnxParser.RULE_templateType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 909;
            this.match(CnxParser.IDENTIFIER);
            this.state = 910;
            this.match(CnxParser.LT);
            this.state = 911;
            this.templateArgumentList();
            this.state = 912;
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
        this.enterRule(localContext, 168, CnxParser.RULE_templateArgumentList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 914;
            this.templateArgument();
            this.state = 919;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 915;
                this.match(CnxParser.COMMA);
                this.state = 916;
                this.templateArgument();
                }
                }
                this.state = 921;
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
        this.enterRule(localContext, 170, CnxParser.RULE_templateArgument);
        try {
            this.state = 926;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 96, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 922;
                this.templateType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 923;
                this.primitiveType();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 924;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 925;
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
        this.enterRule(localContext, 172, CnxParser.RULE_stringType);
        try {
            this.state = 933;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 97, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 928;
                this.match(CnxParser.STRING);
                this.state = 929;
                this.match(CnxParser.LT);
                this.state = 930;
                this.match(CnxParser.INTEGER_LITERAL);
                this.state = 931;
                this.match(CnxParser.GT);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 932;
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
        this.enterRule(localContext, 174, CnxParser.RULE_arrayType);
        let _la: number;
        try {
            this.state = 971;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 104, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 935;
                this.primitiveType();
                this.state = 937;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 936;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 939;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 941;
                this.userType();
                this.state = 943;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 942;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 945;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 947;
                this.stringType();
                this.state = 949;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 948;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 951;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 953;
                this.scopedType();
                this.state = 955;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 954;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 957;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 959;
                this.qualifiedType();
                this.state = 961;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 960;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 963;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 965;
                this.globalType();
                this.state = 967;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 966;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 969;
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
        this.enterRule(localContext, 176, CnxParser.RULE_arrayTypeDimension);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 973;
            this.match(CnxParser.LBRACKET);
            this.state = 975;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879681) !== 0)) {
                {
                this.state = 974;
                this.expression();
                }
            }

            this.state = 977;
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
        this.enterRule(localContext, 178, CnxParser.RULE_literal);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 979;
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
        4,1,119,982,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,
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
        85,7,85,2,86,7,86,2,87,7,87,2,88,7,88,2,89,7,89,1,0,1,0,5,0,183,
        8,0,10,0,12,0,186,9,0,1,0,5,0,189,8,0,10,0,12,0,192,9,0,1,0,1,0,
        1,1,1,1,1,2,1,2,1,2,3,2,201,8,2,1,3,1,3,1,4,1,4,1,5,1,5,1,6,1,6,
        1,6,1,6,1,6,1,6,1,6,3,6,216,8,6,1,7,1,7,1,7,1,7,5,7,222,8,7,10,7,
        12,7,225,9,7,1,7,1,7,1,8,3,8,230,8,8,1,8,1,8,3,8,234,8,8,1,8,1,8,
        3,8,238,8,8,1,8,1,8,3,8,242,8,8,1,8,1,8,3,8,246,8,8,1,8,1,8,3,8,
        250,8,8,1,8,3,8,253,8,8,1,9,1,9,1,10,1,10,1,10,1,10,1,10,1,10,5,
        10,263,8,10,10,10,12,10,266,9,10,1,10,1,10,1,11,1,11,1,11,1,11,1,
        11,1,11,1,11,3,11,277,8,11,1,12,1,12,1,13,1,13,1,13,1,13,5,13,285,
        8,13,10,13,12,13,288,9,13,1,13,1,13,1,14,3,14,293,8,14,1,14,1,14,
        1,14,5,14,298,8,14,10,14,12,14,301,9,14,1,14,1,14,1,15,1,15,1,15,
        1,15,1,15,1,15,5,15,311,8,15,10,15,12,15,314,9,15,1,15,3,15,317,
        8,15,1,15,1,15,1,16,1,16,1,16,3,16,324,8,16,1,17,1,17,1,17,1,17,
        1,17,1,17,5,17,332,8,17,10,17,12,17,335,9,17,1,17,3,17,338,8,17,
        1,17,1,17,1,18,1,18,1,19,1,19,1,19,1,19,3,19,348,8,19,1,20,3,20,
        351,8,20,1,20,1,20,1,20,1,20,3,20,357,8,20,1,20,1,20,1,20,1,21,1,
        21,1,21,5,21,365,8,21,10,21,12,21,368,9,21,1,22,3,22,371,8,22,1,
        22,3,22,374,8,22,1,22,1,22,1,22,5,22,379,8,22,10,22,12,22,382,9,
        22,1,23,1,23,1,24,1,24,1,25,1,25,1,26,1,26,1,27,1,27,1,28,1,28,3,
        28,396,8,28,1,28,1,28,1,29,3,29,401,8,29,1,29,3,29,404,8,29,1,29,
        3,29,407,8,29,1,29,3,29,410,8,29,1,29,3,29,413,8,29,1,29,1,29,1,
        29,5,29,418,8,29,10,29,12,29,421,9,29,1,29,1,29,3,29,425,8,29,1,
        29,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,29,3,29,436,8,29,1,30,1,
        30,1,30,5,30,441,8,30,10,30,12,30,444,9,30,1,31,1,31,5,31,448,8,
        31,10,31,12,31,451,9,31,1,31,1,31,1,32,1,32,1,32,1,32,1,32,1,32,
        1,32,1,32,1,32,1,32,1,32,1,32,3,32,467,8,32,1,33,1,33,1,33,1,34,
        1,34,1,34,1,34,1,34,1,35,1,35,1,36,1,36,1,36,1,36,5,36,483,8,36,
        10,36,12,36,486,9,36,1,36,1,36,1,36,1,36,5,36,492,8,36,10,36,12,
        36,495,9,36,1,36,1,36,5,36,499,8,36,10,36,12,36,502,9,36,3,36,504,
        8,36,1,37,1,37,1,37,1,37,1,37,1,37,1,37,1,37,1,37,1,37,1,37,1,37,
        3,37,518,8,37,1,38,1,38,1,38,1,39,1,39,1,39,1,39,1,39,1,39,1,39,
        3,39,530,8,39,1,40,1,40,1,40,1,40,1,40,1,40,1,41,1,41,1,41,1,41,
        1,41,1,41,1,41,1,41,1,42,1,42,1,42,3,42,549,8,42,1,42,1,42,3,42,
        553,8,42,1,42,1,42,3,42,557,8,42,1,42,1,42,1,42,1,43,1,43,1,43,1,
        44,1,44,3,44,567,8,44,1,45,3,45,570,8,45,1,45,3,45,573,8,45,1,45,
        3,45,576,8,45,1,45,3,45,579,8,45,1,45,1,45,1,45,5,45,584,8,45,10,
        45,12,45,587,9,45,1,45,1,45,3,45,591,8,45,1,46,1,46,1,46,1,46,1,
        47,1,47,1,47,1,47,1,48,1,48,3,48,603,8,48,1,48,1,48,1,49,1,49,1,
        49,1,49,1,49,1,49,4,49,613,8,49,11,49,12,49,614,1,49,3,49,618,8,
        49,1,49,1,49,1,50,1,50,1,50,1,50,5,50,626,8,50,10,50,12,50,629,9,
        50,1,50,1,50,1,51,1,51,1,51,1,51,1,51,3,51,638,8,51,1,51,1,51,3,
        51,642,8,51,1,51,1,51,3,51,646,8,51,1,51,1,51,1,51,3,51,651,8,51,
        1,52,1,52,1,52,1,52,3,52,657,8,52,1,52,1,52,1,53,1,53,1,54,1,54,
        1,54,1,54,1,54,1,54,1,54,1,54,1,54,3,54,672,8,54,1,55,1,55,1,55,
        5,55,677,8,55,10,55,12,55,680,9,55,1,56,1,56,1,56,5,56,685,8,56,
        10,56,12,56,688,9,56,1,57,1,57,1,57,5,57,693,8,57,10,57,12,57,696,
        9,57,1,58,1,58,1,58,5,58,701,8,58,10,58,12,58,704,9,58,1,59,1,59,
        1,59,5,59,709,8,59,10,59,12,59,712,9,59,1,60,1,60,1,60,5,60,717,
        8,60,10,60,12,60,720,9,60,1,61,1,61,1,61,5,61,725,8,61,10,61,12,
        61,728,9,61,1,62,1,62,1,62,5,62,733,8,62,10,62,12,62,736,9,62,1,
        63,1,63,1,63,5,63,741,8,63,10,63,12,63,744,9,63,1,64,1,64,1,64,5,
        64,749,8,64,10,64,12,64,752,9,64,1,65,1,65,1,65,1,65,1,65,1,65,1,
        65,1,65,1,65,3,65,763,8,65,1,66,1,66,5,66,767,8,66,10,66,12,66,770,
        9,66,1,66,1,66,1,66,1,66,3,66,776,8,66,1,67,1,67,1,67,1,67,1,67,
        1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,3,67,792,8,67,1,67,
        3,67,795,8,67,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,
        1,68,1,68,3,68,809,8,68,1,69,1,69,1,69,1,69,3,69,815,8,69,1,69,1,
        69,1,70,1,70,3,70,821,8,70,1,70,1,70,1,70,1,70,1,71,1,71,1,71,1,
        71,1,72,1,72,1,72,5,72,834,8,72,10,72,12,72,837,9,72,1,72,3,72,840,
        8,72,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,5,74,850,8,74,10,74,
        12,74,853,9,74,1,74,3,74,856,8,74,1,74,1,74,1,74,1,74,1,74,1,74,
        1,74,3,74,865,8,74,1,75,1,75,1,75,3,75,870,8,75,1,76,1,76,1,76,5,
        76,875,8,76,10,76,12,76,878,9,76,1,77,1,77,1,77,1,77,1,77,1,77,1,
        77,1,77,1,77,3,77,889,8,77,1,78,1,78,1,78,1,78,1,79,1,79,1,79,1,
        79,1,80,1,80,1,80,4,80,902,8,80,11,80,12,80,903,1,81,1,81,1,82,1,
        82,1,83,1,83,1,83,1,83,1,83,1,84,1,84,1,84,5,84,918,8,84,10,84,12,
        84,921,9,84,1,85,1,85,1,85,1,85,3,85,927,8,85,1,86,1,86,1,86,1,86,
        1,86,3,86,934,8,86,1,87,1,87,4,87,938,8,87,11,87,12,87,939,1,87,
        1,87,4,87,944,8,87,11,87,12,87,945,1,87,1,87,4,87,950,8,87,11,87,
        12,87,951,1,87,1,87,4,87,956,8,87,11,87,12,87,957,1,87,1,87,4,87,
        962,8,87,11,87,12,87,963,1,87,1,87,4,87,968,8,87,11,87,12,87,969,
        3,87,972,8,87,1,88,1,88,3,88,976,8,88,1,88,1,88,1,89,1,89,1,89,0,
        0,90,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,
        44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,
        88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,
        124,126,128,130,132,134,136,138,140,142,144,146,148,150,152,154,
        156,158,160,162,164,166,168,170,172,174,176,178,0,15,1,0,3,5,1,0,
        6,9,1,0,17,18,1,0,42,46,1,0,38,41,1,0,47,48,1,0,67,77,1,0,14,15,
        1,0,78,79,1,0,80,83,1,0,96,97,1,0,84,85,1,0,86,88,1,0,55,66,3,0,
        33,35,51,54,109,114,1050,0,184,1,0,0,0,2,195,1,0,0,0,4,200,1,0,0,
        0,6,202,1,0,0,0,8,204,1,0,0,0,10,206,1,0,0,0,12,215,1,0,0,0,14,217,
        1,0,0,0,16,252,1,0,0,0,18,254,1,0,0,0,20,256,1,0,0,0,22,269,1,0,
        0,0,24,278,1,0,0,0,26,280,1,0,0,0,28,292,1,0,0,0,30,304,1,0,0,0,
        32,320,1,0,0,0,34,325,1,0,0,0,36,341,1,0,0,0,38,343,1,0,0,0,40,350,
        1,0,0,0,42,361,1,0,0,0,44,370,1,0,0,0,46,383,1,0,0,0,48,385,1,0,
        0,0,50,387,1,0,0,0,52,389,1,0,0,0,54,391,1,0,0,0,56,393,1,0,0,0,
        58,435,1,0,0,0,60,437,1,0,0,0,62,445,1,0,0,0,64,466,1,0,0,0,66,468,
        1,0,0,0,68,471,1,0,0,0,70,476,1,0,0,0,72,503,1,0,0,0,74,517,1,0,
        0,0,76,519,1,0,0,0,78,522,1,0,0,0,80,531,1,0,0,0,82,537,1,0,0,0,
        84,545,1,0,0,0,86,561,1,0,0,0,88,566,1,0,0,0,90,569,1,0,0,0,92,592,
        1,0,0,0,94,596,1,0,0,0,96,600,1,0,0,0,98,606,1,0,0,0,100,621,1,0,
        0,0,102,650,1,0,0,0,104,652,1,0,0,0,106,660,1,0,0,0,108,671,1,0,
        0,0,110,673,1,0,0,0,112,681,1,0,0,0,114,689,1,0,0,0,116,697,1,0,
        0,0,118,705,1,0,0,0,120,713,1,0,0,0,122,721,1,0,0,0,124,729,1,0,
        0,0,126,737,1,0,0,0,128,745,1,0,0,0,130,762,1,0,0,0,132,775,1,0,
        0,0,134,794,1,0,0,0,136,808,1,0,0,0,138,810,1,0,0,0,140,818,1,0,
        0,0,142,826,1,0,0,0,144,830,1,0,0,0,146,841,1,0,0,0,148,864,1,0,
        0,0,150,869,1,0,0,0,152,871,1,0,0,0,154,888,1,0,0,0,156,890,1,0,
        0,0,158,894,1,0,0,0,160,898,1,0,0,0,162,905,1,0,0,0,164,907,1,0,
        0,0,166,909,1,0,0,0,168,914,1,0,0,0,170,926,1,0,0,0,172,933,1,0,
        0,0,174,971,1,0,0,0,176,973,1,0,0,0,178,979,1,0,0,0,180,183,3,2,
        1,0,181,183,3,4,2,0,182,180,1,0,0,0,182,181,1,0,0,0,183,186,1,0,
        0,0,184,182,1,0,0,0,184,185,1,0,0,0,185,190,1,0,0,0,186,184,1,0,
        0,0,187,189,3,12,6,0,188,187,1,0,0,0,189,192,1,0,0,0,190,188,1,0,
        0,0,190,191,1,0,0,0,191,193,1,0,0,0,192,190,1,0,0,0,193,194,5,0,
        0,1,194,1,1,0,0,0,195,196,5,2,0,0,196,3,1,0,0,0,197,201,3,6,3,0,
        198,201,3,8,4,0,199,201,3,10,5,0,200,197,1,0,0,0,200,198,1,0,0,0,
        200,199,1,0,0,0,201,5,1,0,0,0,202,203,7,0,0,0,203,7,1,0,0,0,204,
        205,7,1,0,0,205,9,1,0,0,0,206,207,5,10,0,0,207,11,1,0,0,0,208,216,
        3,14,7,0,209,216,3,20,10,0,210,216,3,26,13,0,211,216,3,30,15,0,212,
        216,3,34,17,0,213,216,3,40,20,0,214,216,3,58,29,0,215,208,1,0,0,
        0,215,209,1,0,0,0,215,210,1,0,0,0,215,211,1,0,0,0,215,212,1,0,0,
        0,215,213,1,0,0,0,215,214,1,0,0,0,216,13,1,0,0,0,217,218,5,11,0,
        0,218,219,5,115,0,0,219,223,5,100,0,0,220,222,3,16,8,0,221,220,1,
        0,0,0,222,225,1,0,0,0,223,221,1,0,0,0,223,224,1,0,0,0,224,226,1,
        0,0,0,225,223,1,0,0,0,226,227,5,101,0,0,227,15,1,0,0,0,228,230,3,
        18,9,0,229,228,1,0,0,0,229,230,1,0,0,0,230,231,1,0,0,0,231,253,3,
        58,29,0,232,234,3,18,9,0,233,232,1,0,0,0,233,234,1,0,0,0,234,235,
        1,0,0,0,235,253,3,40,20,0,236,238,3,18,9,0,237,236,1,0,0,0,237,238,
        1,0,0,0,238,239,1,0,0,0,239,253,3,30,15,0,240,242,3,18,9,0,241,240,
        1,0,0,0,241,242,1,0,0,0,242,243,1,0,0,0,243,253,3,34,17,0,244,246,
        3,18,9,0,245,244,1,0,0,0,245,246,1,0,0,0,246,247,1,0,0,0,247,253,
        3,20,10,0,248,250,3,18,9,0,249,248,1,0,0,0,249,250,1,0,0,0,250,251,
        1,0,0,0,251,253,3,26,13,0,252,229,1,0,0,0,252,233,1,0,0,0,252,237,
        1,0,0,0,252,241,1,0,0,0,252,245,1,0,0,0,252,249,1,0,0,0,253,17,1,
        0,0,0,254,255,7,2,0,0,255,19,1,0,0,0,256,257,5,16,0,0,257,258,5,
        115,0,0,258,259,5,107,0,0,259,260,3,106,53,0,260,264,5,100,0,0,261,
        263,3,22,11,0,262,261,1,0,0,0,263,266,1,0,0,0,264,262,1,0,0,0,264,
        265,1,0,0,0,265,267,1,0,0,0,266,264,1,0,0,0,267,268,5,101,0,0,268,
        21,1,0,0,0,269,270,5,115,0,0,270,271,5,108,0,0,271,272,3,154,77,
        0,272,273,3,24,12,0,273,274,5,107,0,0,274,276,3,106,53,0,275,277,
        5,105,0,0,276,275,1,0,0,0,276,277,1,0,0,0,277,23,1,0,0,0,278,279,
        7,3,0,0,279,25,1,0,0,0,280,281,5,12,0,0,281,282,5,115,0,0,282,286,
        5,100,0,0,283,285,3,28,14,0,284,283,1,0,0,0,285,288,1,0,0,0,286,
        284,1,0,0,0,286,287,1,0,0,0,287,289,1,0,0,0,288,286,1,0,0,0,289,
        290,5,101,0,0,290,27,1,0,0,0,291,293,3,52,26,0,292,291,1,0,0,0,292,
        293,1,0,0,0,293,294,1,0,0,0,294,295,3,154,77,0,295,299,5,115,0,0,
        296,298,3,56,28,0,297,296,1,0,0,0,298,301,1,0,0,0,299,297,1,0,0,
        0,299,300,1,0,0,0,300,302,1,0,0,0,301,299,1,0,0,0,302,303,5,104,
        0,0,303,29,1,0,0,0,304,305,5,13,0,0,305,306,5,115,0,0,306,307,5,
        100,0,0,307,312,3,32,16,0,308,309,5,105,0,0,309,311,3,32,16,0,310,
        308,1,0,0,0,311,314,1,0,0,0,312,310,1,0,0,0,312,313,1,0,0,0,313,
        316,1,0,0,0,314,312,1,0,0,0,315,317,5,105,0,0,316,315,1,0,0,0,316,
        317,1,0,0,0,317,318,1,0,0,0,318,319,5,101,0,0,319,31,1,0,0,0,320,
        323,5,115,0,0,321,322,5,77,0,0,322,324,3,106,53,0,323,321,1,0,0,
        0,323,324,1,0,0,0,324,33,1,0,0,0,325,326,3,36,18,0,326,327,5,115,
        0,0,327,328,5,100,0,0,328,333,3,38,19,0,329,330,5,105,0,0,330,332,
        3,38,19,0,331,329,1,0,0,0,332,335,1,0,0,0,333,331,1,0,0,0,333,334,
        1,0,0,0,334,337,1,0,0,0,335,333,1,0,0,0,336,338,5,105,0,0,337,336,
        1,0,0,0,337,338,1,0,0,0,338,339,1,0,0,0,339,340,5,101,0,0,340,35,
        1,0,0,0,341,342,7,4,0,0,342,37,1,0,0,0,343,347,5,115,0,0,344,345,
        5,102,0,0,345,346,5,112,0,0,346,348,5,103,0,0,347,344,1,0,0,0,347,
        348,1,0,0,0,348,39,1,0,0,0,349,351,3,52,26,0,350,349,1,0,0,0,350,
        351,1,0,0,0,351,352,1,0,0,0,352,353,3,154,77,0,353,354,5,115,0,0,
        354,356,5,98,0,0,355,357,3,42,21,0,356,355,1,0,0,0,356,357,1,0,0,
        0,357,358,1,0,0,0,358,359,5,99,0,0,359,360,3,62,31,0,360,41,1,0,
        0,0,361,366,3,44,22,0,362,363,5,105,0,0,363,365,3,44,22,0,364,362,
        1,0,0,0,365,368,1,0,0,0,366,364,1,0,0,0,366,367,1,0,0,0,367,43,1,
        0,0,0,368,366,1,0,0,0,369,371,3,46,23,0,370,369,1,0,0,0,370,371,
        1,0,0,0,371,373,1,0,0,0,372,374,3,48,24,0,373,372,1,0,0,0,373,374,
        1,0,0,0,374,375,1,0,0,0,375,376,3,154,77,0,376,380,5,115,0,0,377,
        379,3,56,28,0,378,377,1,0,0,0,379,382,1,0,0,0,380,378,1,0,0,0,380,
        381,1,0,0,0,381,45,1,0,0,0,382,380,1,0,0,0,383,384,5,19,0,0,384,
        47,1,0,0,0,385,386,5,20,0,0,386,49,1,0,0,0,387,388,5,21,0,0,388,
        51,1,0,0,0,389,390,7,5,0,0,390,53,1,0,0,0,391,392,5,49,0,0,392,55,
        1,0,0,0,393,395,5,102,0,0,394,396,3,106,53,0,395,394,1,0,0,0,395,
        396,1,0,0,0,396,397,1,0,0,0,397,398,5,103,0,0,398,57,1,0,0,0,399,
        401,3,54,27,0,400,399,1,0,0,0,400,401,1,0,0,0,401,403,1,0,0,0,402,
        404,3,50,25,0,403,402,1,0,0,0,403,404,1,0,0,0,404,406,1,0,0,0,405,
        407,3,46,23,0,406,405,1,0,0,0,406,407,1,0,0,0,407,409,1,0,0,0,408,
        410,3,48,24,0,409,408,1,0,0,0,409,410,1,0,0,0,410,412,1,0,0,0,411,
        413,3,52,26,0,412,411,1,0,0,0,412,413,1,0,0,0,413,414,1,0,0,0,414,
        415,3,154,77,0,415,419,5,115,0,0,416,418,3,56,28,0,417,416,1,0,0,
        0,418,421,1,0,0,0,419,417,1,0,0,0,419,420,1,0,0,0,420,424,1,0,0,
        0,421,419,1,0,0,0,422,423,5,77,0,0,423,425,3,106,53,0,424,422,1,
        0,0,0,424,425,1,0,0,0,425,426,1,0,0,0,426,427,5,104,0,0,427,436,
        1,0,0,0,428,429,3,154,77,0,429,430,5,115,0,0,430,431,5,98,0,0,431,
        432,3,60,30,0,432,433,5,99,0,0,433,434,5,104,0,0,434,436,1,0,0,0,
        435,400,1,0,0,0,435,428,1,0,0,0,436,59,1,0,0,0,437,442,5,115,0,0,
        438,439,5,105,0,0,439,441,5,115,0,0,440,438,1,0,0,0,441,444,1,0,
        0,0,442,440,1,0,0,0,442,443,1,0,0,0,443,61,1,0,0,0,444,442,1,0,0,
        0,445,449,5,100,0,0,446,448,3,64,32,0,447,446,1,0,0,0,448,451,1,
        0,0,0,449,447,1,0,0,0,449,450,1,0,0,0,450,452,1,0,0,0,451,449,1,
        0,0,0,452,453,5,101,0,0,453,63,1,0,0,0,454,467,3,58,29,0,455,467,
        3,68,34,0,456,467,3,76,38,0,457,467,3,78,39,0,458,467,3,80,40,0,
        459,467,3,82,41,0,460,467,3,84,42,0,461,467,3,86,43,0,462,467,3,
        98,49,0,463,467,3,96,48,0,464,467,3,66,33,0,465,467,3,62,31,0,466,
        454,1,0,0,0,466,455,1,0,0,0,466,456,1,0,0,0,466,457,1,0,0,0,466,
        458,1,0,0,0,466,459,1,0,0,0,466,460,1,0,0,0,466,461,1,0,0,0,466,
        462,1,0,0,0,466,463,1,0,0,0,466,464,1,0,0,0,466,465,1,0,0,0,467,
        65,1,0,0,0,468,469,5,50,0,0,469,470,3,62,31,0,470,67,1,0,0,0,471,
        472,3,72,36,0,472,473,3,70,35,0,473,474,3,106,53,0,474,475,5,104,
        0,0,475,69,1,0,0,0,476,477,7,6,0,0,477,71,1,0,0,0,478,479,5,15,0,
        0,479,480,5,106,0,0,480,484,5,115,0,0,481,483,3,74,37,0,482,481,
        1,0,0,0,483,486,1,0,0,0,484,482,1,0,0,0,484,485,1,0,0,0,485,504,
        1,0,0,0,486,484,1,0,0,0,487,488,5,14,0,0,488,489,5,106,0,0,489,493,
        5,115,0,0,490,492,3,74,37,0,491,490,1,0,0,0,492,495,1,0,0,0,493,
        491,1,0,0,0,493,494,1,0,0,0,494,504,1,0,0,0,495,493,1,0,0,0,496,
        500,5,115,0,0,497,499,3,74,37,0,498,497,1,0,0,0,499,502,1,0,0,0,
        500,498,1,0,0,0,500,501,1,0,0,0,501,504,1,0,0,0,502,500,1,0,0,0,
        503,478,1,0,0,0,503,487,1,0,0,0,503,496,1,0,0,0,504,73,1,0,0,0,505,
        506,5,106,0,0,506,518,5,115,0,0,507,508,5,102,0,0,508,509,3,106,
        53,0,509,510,5,103,0,0,510,518,1,0,0,0,511,512,5,102,0,0,512,513,
        3,106,53,0,513,514,5,105,0,0,514,515,3,106,53,0,515,516,5,103,0,
        0,516,518,1,0,0,0,517,505,1,0,0,0,517,507,1,0,0,0,517,511,1,0,0,
        0,518,75,1,0,0,0,519,520,3,106,53,0,520,521,5,104,0,0,521,77,1,0,
        0,0,522,523,5,23,0,0,523,524,5,98,0,0,524,525,3,106,53,0,525,526,
        5,99,0,0,526,529,3,64,32,0,527,528,5,24,0,0,528,530,3,64,32,0,529,
        527,1,0,0,0,529,530,1,0,0,0,530,79,1,0,0,0,531,532,5,25,0,0,532,
        533,5,98,0,0,533,534,3,106,53,0,534,535,5,99,0,0,535,536,3,64,32,
        0,536,81,1,0,0,0,537,538,5,26,0,0,538,539,3,62,31,0,539,540,5,25,
        0,0,540,541,5,98,0,0,541,542,3,106,53,0,542,543,5,99,0,0,543,544,
        5,104,0,0,544,83,1,0,0,0,545,546,5,27,0,0,546,548,5,98,0,0,547,549,
        3,88,44,0,548,547,1,0,0,0,548,549,1,0,0,0,549,550,1,0,0,0,550,552,
        5,104,0,0,551,553,3,106,53,0,552,551,1,0,0,0,552,553,1,0,0,0,553,
        554,1,0,0,0,554,556,5,104,0,0,555,557,3,94,47,0,556,555,1,0,0,0,
        556,557,1,0,0,0,557,558,1,0,0,0,558,559,5,99,0,0,559,560,3,64,32,
        0,560,85,1,0,0,0,561,562,5,28,0,0,562,563,3,62,31,0,563,87,1,0,0,
        0,564,567,3,90,45,0,565,567,3,92,46,0,566,564,1,0,0,0,566,565,1,
        0,0,0,567,89,1,0,0,0,568,570,3,54,27,0,569,568,1,0,0,0,569,570,1,
        0,0,0,570,572,1,0,0,0,571,573,3,50,25,0,572,571,1,0,0,0,572,573,
        1,0,0,0,573,575,1,0,0,0,574,576,3,48,24,0,575,574,1,0,0,0,575,576,
        1,0,0,0,576,578,1,0,0,0,577,579,3,52,26,0,578,577,1,0,0,0,578,579,
        1,0,0,0,579,580,1,0,0,0,580,581,3,154,77,0,581,585,5,115,0,0,582,
        584,3,56,28,0,583,582,1,0,0,0,584,587,1,0,0,0,585,583,1,0,0,0,585,
        586,1,0,0,0,586,590,1,0,0,0,587,585,1,0,0,0,588,589,5,77,0,0,589,
        591,3,106,53,0,590,588,1,0,0,0,590,591,1,0,0,0,591,91,1,0,0,0,592,
        593,3,72,36,0,593,594,3,70,35,0,594,595,3,106,53,0,595,93,1,0,0,
        0,596,597,3,72,36,0,597,598,3,70,35,0,598,599,3,106,53,0,599,95,
        1,0,0,0,600,602,5,32,0,0,601,603,3,106,53,0,602,601,1,0,0,0,602,
        603,1,0,0,0,603,604,1,0,0,0,604,605,5,104,0,0,605,97,1,0,0,0,606,
        607,5,29,0,0,607,608,5,98,0,0,608,609,3,106,53,0,609,610,5,99,0,
        0,610,612,5,100,0,0,611,613,3,100,50,0,612,611,1,0,0,0,613,614,1,
        0,0,0,614,612,1,0,0,0,614,615,1,0,0,0,615,617,1,0,0,0,616,618,3,
        104,52,0,617,616,1,0,0,0,617,618,1,0,0,0,618,619,1,0,0,0,619,620,
        5,101,0,0,620,99,1,0,0,0,621,622,5,30,0,0,622,627,3,102,51,0,623,
        624,5,90,0,0,624,626,3,102,51,0,625,623,1,0,0,0,626,629,1,0,0,0,
        627,625,1,0,0,0,627,628,1,0,0,0,628,630,1,0,0,0,629,627,1,0,0,0,
        630,631,3,62,31,0,631,101,1,0,0,0,632,651,3,160,80,0,633,634,7,7,
        0,0,634,637,5,106,0,0,635,638,3,160,80,0,636,638,5,115,0,0,637,635,
        1,0,0,0,637,636,1,0,0,0,638,651,1,0,0,0,639,651,5,115,0,0,640,642,
        5,85,0,0,641,640,1,0,0,0,641,642,1,0,0,0,642,643,1,0,0,0,643,651,
        5,112,0,0,644,646,5,85,0,0,645,644,1,0,0,0,645,646,1,0,0,0,646,647,
        1,0,0,0,647,651,5,109,0,0,648,651,5,110,0,0,649,651,5,114,0,0,650,
        632,1,0,0,0,650,633,1,0,0,0,650,639,1,0,0,0,650,641,1,0,0,0,650,
        645,1,0,0,0,650,648,1,0,0,0,650,649,1,0,0,0,651,103,1,0,0,0,652,
        656,5,31,0,0,653,654,5,98,0,0,654,655,5,112,0,0,655,657,5,99,0,0,
        656,653,1,0,0,0,656,657,1,0,0,0,657,658,1,0,0,0,658,659,3,62,31,
        0,659,105,1,0,0,0,660,661,3,108,54,0,661,107,1,0,0,0,662,663,5,98,
        0,0,663,664,3,110,55,0,664,665,5,99,0,0,665,666,5,1,0,0,666,667,
        3,110,55,0,667,668,5,108,0,0,668,669,3,110,55,0,669,672,1,0,0,0,
        670,672,3,110,55,0,671,662,1,0,0,0,671,670,1,0,0,0,672,109,1,0,0,
        0,673,678,3,112,56,0,674,675,5,90,0,0,675,677,3,112,56,0,676,674,
        1,0,0,0,677,680,1,0,0,0,678,676,1,0,0,0,678,679,1,0,0,0,679,111,
        1,0,0,0,680,678,1,0,0,0,681,686,3,114,57,0,682,683,5,89,0,0,683,
        685,3,114,57,0,684,682,1,0,0,0,685,688,1,0,0,0,686,684,1,0,0,0,686,
        687,1,0,0,0,687,113,1,0,0,0,688,686,1,0,0,0,689,694,3,116,58,0,690,
        691,7,8,0,0,691,693,3,116,58,0,692,690,1,0,0,0,693,696,1,0,0,0,694,
        692,1,0,0,0,694,695,1,0,0,0,695,115,1,0,0,0,696,694,1,0,0,0,697,
        702,3,118,59,0,698,699,7,9,0,0,699,701,3,118,59,0,700,698,1,0,0,
        0,701,704,1,0,0,0,702,700,1,0,0,0,702,703,1,0,0,0,703,117,1,0,0,
        0,704,702,1,0,0,0,705,710,3,120,60,0,706,707,5,93,0,0,707,709,3,
        120,60,0,708,706,1,0,0,0,709,712,1,0,0,0,710,708,1,0,0,0,710,711,
        1,0,0,0,711,119,1,0,0,0,712,710,1,0,0,0,713,718,3,122,61,0,714,715,
        5,94,0,0,715,717,3,122,61,0,716,714,1,0,0,0,717,720,1,0,0,0,718,
        716,1,0,0,0,718,719,1,0,0,0,719,121,1,0,0,0,720,718,1,0,0,0,721,
        726,3,124,62,0,722,723,5,92,0,0,723,725,3,124,62,0,724,722,1,0,0,
        0,725,728,1,0,0,0,726,724,1,0,0,0,726,727,1,0,0,0,727,123,1,0,0,
        0,728,726,1,0,0,0,729,734,3,126,63,0,730,731,7,10,0,0,731,733,3,
        126,63,0,732,730,1,0,0,0,733,736,1,0,0,0,734,732,1,0,0,0,734,735,
        1,0,0,0,735,125,1,0,0,0,736,734,1,0,0,0,737,742,3,128,64,0,738,739,
        7,11,0,0,739,741,3,128,64,0,740,738,1,0,0,0,741,744,1,0,0,0,742,
        740,1,0,0,0,742,743,1,0,0,0,743,127,1,0,0,0,744,742,1,0,0,0,745,
        750,3,130,65,0,746,747,7,12,0,0,747,749,3,130,65,0,748,746,1,0,0,
        0,749,752,1,0,0,0,750,748,1,0,0,0,750,751,1,0,0,0,751,129,1,0,0,
        0,752,750,1,0,0,0,753,754,5,91,0,0,754,763,3,130,65,0,755,756,5,
        85,0,0,756,763,3,130,65,0,757,758,5,95,0,0,758,763,3,130,65,0,759,
        760,5,92,0,0,760,763,3,130,65,0,761,763,3,132,66,0,762,753,1,0,0,
        0,762,755,1,0,0,0,762,757,1,0,0,0,762,759,1,0,0,0,762,761,1,0,0,
        0,763,131,1,0,0,0,764,768,3,136,68,0,765,767,3,134,67,0,766,765,
        1,0,0,0,767,770,1,0,0,0,768,766,1,0,0,0,768,769,1,0,0,0,769,776,
        1,0,0,0,770,768,1,0,0,0,771,772,3,162,81,0,772,773,5,106,0,0,773,
        774,5,115,0,0,774,776,1,0,0,0,775,764,1,0,0,0,775,771,1,0,0,0,776,
        133,1,0,0,0,777,778,5,106,0,0,778,795,5,115,0,0,779,780,5,102,0,
        0,780,781,3,106,53,0,781,782,5,103,0,0,782,795,1,0,0,0,783,784,5,
        102,0,0,784,785,3,106,53,0,785,786,5,105,0,0,786,787,3,106,53,0,
        787,788,5,103,0,0,788,795,1,0,0,0,789,791,5,98,0,0,790,792,3,152,
        76,0,791,790,1,0,0,0,791,792,1,0,0,0,792,793,1,0,0,0,793,795,5,99,
        0,0,794,777,1,0,0,0,794,779,1,0,0,0,794,783,1,0,0,0,794,789,1,0,
        0,0,795,135,1,0,0,0,796,809,3,138,69,0,797,809,3,140,70,0,798,809,
        3,142,71,0,799,809,3,148,74,0,800,809,5,14,0,0,801,809,5,15,0,0,
        802,809,5,115,0,0,803,809,3,178,89,0,804,805,5,98,0,0,805,806,3,
        106,53,0,806,807,5,99,0,0,807,809,1,0,0,0,808,796,1,0,0,0,808,797,
        1,0,0,0,808,798,1,0,0,0,808,799,1,0,0,0,808,800,1,0,0,0,808,801,
        1,0,0,0,808,802,1,0,0,0,808,803,1,0,0,0,808,804,1,0,0,0,809,137,
        1,0,0,0,810,811,5,37,0,0,811,814,5,98,0,0,812,815,3,154,77,0,813,
        815,3,106,53,0,814,812,1,0,0,0,814,813,1,0,0,0,815,816,1,0,0,0,816,
        817,5,99,0,0,817,139,1,0,0,0,818,820,5,98,0,0,819,821,3,52,26,0,
        820,819,1,0,0,0,820,821,1,0,0,0,821,822,1,0,0,0,822,823,3,154,77,
        0,823,824,5,99,0,0,824,825,3,130,65,0,825,141,1,0,0,0,826,827,5,
        100,0,0,827,828,3,144,72,0,828,829,5,101,0,0,829,143,1,0,0,0,830,
        835,3,146,73,0,831,832,5,105,0,0,832,834,3,146,73,0,833,831,1,0,
        0,0,834,837,1,0,0,0,835,833,1,0,0,0,835,836,1,0,0,0,836,839,1,0,
        0,0,837,835,1,0,0,0,838,840,5,105,0,0,839,838,1,0,0,0,839,840,1,
        0,0,0,840,145,1,0,0,0,841,842,5,115,0,0,842,843,5,108,0,0,843,844,
        3,106,53,0,844,147,1,0,0,0,845,846,5,102,0,0,846,851,3,150,75,0,
        847,848,5,105,0,0,848,850,3,150,75,0,849,847,1,0,0,0,850,853,1,0,
        0,0,851,849,1,0,0,0,851,852,1,0,0,0,852,855,1,0,0,0,853,851,1,0,
        0,0,854,856,5,105,0,0,855,854,1,0,0,0,855,856,1,0,0,0,856,857,1,
        0,0,0,857,858,5,103,0,0,858,865,1,0,0,0,859,860,5,102,0,0,860,861,
        3,106,53,0,861,862,5,86,0,0,862,863,5,103,0,0,863,865,1,0,0,0,864,
        845,1,0,0,0,864,859,1,0,0,0,865,149,1,0,0,0,866,870,3,106,53,0,867,
        870,3,142,71,0,868,870,3,148,74,0,869,866,1,0,0,0,869,867,1,0,0,
        0,869,868,1,0,0,0,870,151,1,0,0,0,871,876,3,106,53,0,872,873,5,105,
        0,0,873,875,3,106,53,0,874,872,1,0,0,0,875,878,1,0,0,0,876,874,1,
        0,0,0,876,877,1,0,0,0,877,153,1,0,0,0,878,876,1,0,0,0,879,889,3,
        162,81,0,880,889,3,172,86,0,881,889,3,156,78,0,882,889,3,158,79,
        0,883,889,3,160,80,0,884,889,3,166,83,0,885,889,3,164,82,0,886,889,
        3,174,87,0,887,889,5,22,0,0,888,879,1,0,0,0,888,880,1,0,0,0,888,
        881,1,0,0,0,888,882,1,0,0,0,888,883,1,0,0,0,888,884,1,0,0,0,888,
        885,1,0,0,0,888,886,1,0,0,0,888,887,1,0,0,0,889,155,1,0,0,0,890,
        891,5,14,0,0,891,892,5,106,0,0,892,893,5,115,0,0,893,157,1,0,0,0,
        894,895,5,15,0,0,895,896,5,106,0,0,896,897,5,115,0,0,897,159,1,0,
        0,0,898,901,5,115,0,0,899,900,5,106,0,0,900,902,5,115,0,0,901,899,
        1,0,0,0,902,903,1,0,0,0,903,901,1,0,0,0,903,904,1,0,0,0,904,161,
        1,0,0,0,905,906,7,13,0,0,906,163,1,0,0,0,907,908,5,115,0,0,908,165,
        1,0,0,0,909,910,5,115,0,0,910,911,5,80,0,0,911,912,3,168,84,0,912,
        913,5,81,0,0,913,167,1,0,0,0,914,919,3,170,85,0,915,916,5,105,0,
        0,916,918,3,170,85,0,917,915,1,0,0,0,918,921,1,0,0,0,919,917,1,0,
        0,0,919,920,1,0,0,0,920,169,1,0,0,0,921,919,1,0,0,0,922,927,3,166,
        83,0,923,927,3,162,81,0,924,927,5,115,0,0,925,927,5,112,0,0,926,
        922,1,0,0,0,926,923,1,0,0,0,926,924,1,0,0,0,926,925,1,0,0,0,927,
        171,1,0,0,0,928,929,5,36,0,0,929,930,5,80,0,0,930,931,5,112,0,0,
        931,934,5,81,0,0,932,934,5,36,0,0,933,928,1,0,0,0,933,932,1,0,0,
        0,934,173,1,0,0,0,935,937,3,162,81,0,936,938,3,176,88,0,937,936,
        1,0,0,0,938,939,1,0,0,0,939,937,1,0,0,0,939,940,1,0,0,0,940,972,
        1,0,0,0,941,943,3,164,82,0,942,944,3,176,88,0,943,942,1,0,0,0,944,
        945,1,0,0,0,945,943,1,0,0,0,945,946,1,0,0,0,946,972,1,0,0,0,947,
        949,3,172,86,0,948,950,3,176,88,0,949,948,1,0,0,0,950,951,1,0,0,
        0,951,949,1,0,0,0,951,952,1,0,0,0,952,972,1,0,0,0,953,955,3,156,
        78,0,954,956,3,176,88,0,955,954,1,0,0,0,956,957,1,0,0,0,957,955,
        1,0,0,0,957,958,1,0,0,0,958,972,1,0,0,0,959,961,3,160,80,0,960,962,
        3,176,88,0,961,960,1,0,0,0,962,963,1,0,0,0,963,961,1,0,0,0,963,964,
        1,0,0,0,964,972,1,0,0,0,965,967,3,158,79,0,966,968,3,176,88,0,967,
        966,1,0,0,0,968,969,1,0,0,0,969,967,1,0,0,0,969,970,1,0,0,0,970,
        972,1,0,0,0,971,935,1,0,0,0,971,941,1,0,0,0,971,947,1,0,0,0,971,
        953,1,0,0,0,971,959,1,0,0,0,971,965,1,0,0,0,972,175,1,0,0,0,973,
        975,5,102,0,0,974,976,3,106,53,0,975,974,1,0,0,0,975,976,1,0,0,0,
        976,977,1,0,0,0,977,978,5,103,0,0,978,177,1,0,0,0,979,980,7,14,0,
        0,980,179,1,0,0,0,106,182,184,190,200,215,223,229,233,237,241,245,
        249,252,264,276,286,292,299,312,316,323,333,337,347,350,356,366,
        370,373,380,395,400,403,406,409,412,419,424,435,442,449,466,484,
        493,500,503,517,529,548,552,556,566,569,572,575,578,585,590,602,
        614,617,627,637,641,645,650,656,671,678,686,694,702,710,718,726,
        734,742,750,762,768,775,791,794,808,814,820,835,839,851,855,864,
        869,876,888,903,919,926,933,939,945,951,957,963,969,971,975
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
    public AT(): antlr.TerminalNode {
        return this.getToken(CnxParser.AT, 0)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.LBRACE, 0)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(CnxParser.RBRACE, 0)!;
    }
    public registerMember(): RegisterMemberContext[];
    public registerMember(i: number): RegisterMemberContext | null;
    public registerMember(i?: number): RegisterMemberContext[] | RegisterMemberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(RegisterMemberContext);
        }

        return this.getRuleContext(i, RegisterMemberContext);
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
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
    }
    public COLON(): antlr.TerminalNode {
        return this.getToken(CnxParser.COLON, 0)!;
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public accessModifier(): AccessModifierContext {
        return this.getRuleContext(0, AccessModifierContext)!;
    }
    public AT(): antlr.TerminalNode {
        return this.getToken(CnxParser.AT, 0)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public COMMA(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.COMMA, 0);
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
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
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
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(CnxParser.IDENTIFIER, 0)!;
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
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IDENTIFIER, 0);
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
    public BITAND(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.BITAND, 0);
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
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(CnxParser.IDENTIFIER, 0);
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
