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
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
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
            while (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 16579555) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 1048575) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
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
        let _la: number;
        try {
            this.state = 515;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.DOT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 505;
                this.match(CnxParser.DOT);
                this.state = 506;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case CnxParser.LBRACKET:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 507;
                this.match(CnxParser.LBRACKET);
                this.state = 508;
                this.expression();
                this.state = 511;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 105) {
                    {
                    this.state = 509;
                    this.match(CnxParser.COMMA);
                    this.state = 510;
                    this.expression();
                    }
                }

                this.state = 513;
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
        this.enterRule(localContext, 76, CnxParser.RULE_expressionStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 517;
            this.expression();
            this.state = 518;
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
            this.state = 520;
            this.match(CnxParser.IF);
            this.state = 521;
            this.match(CnxParser.LPAREN);
            this.state = 522;
            this.expression();
            this.state = 523;
            this.match(CnxParser.RPAREN);
            this.state = 524;
            this.statement();
            this.state = 527;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 48, this.context) ) {
            case 1:
                {
                this.state = 525;
                this.match(CnxParser.ELSE);
                this.state = 526;
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
            this.state = 529;
            this.match(CnxParser.WHILE);
            this.state = 530;
            this.match(CnxParser.LPAREN);
            this.state = 531;
            this.expression();
            this.state = 532;
            this.match(CnxParser.RPAREN);
            this.state = 533;
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
            this.state = 535;
            this.match(CnxParser.DO);
            this.state = 536;
            this.block();
            this.state = 537;
            this.match(CnxParser.WHILE);
            this.state = 538;
            this.match(CnxParser.LPAREN);
            this.state = 539;
            this.expression();
            this.state = 540;
            this.match(CnxParser.RPAREN);
            this.state = 541;
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
            this.state = 543;
            this.match(CnxParser.FOR);
            this.state = 544;
            this.match(CnxParser.LPAREN);
            this.state = 546;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 7389184) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 2146973697) !== 0) || _la === 115) {
                {
                this.state = 545;
                this.forInit();
                }
            }

            this.state = 548;
            this.match(CnxParser.SEMI);
            this.state = 550;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                {
                this.state = 549;
                this.expression();
                }
            }

            this.state = 552;
            this.match(CnxParser.SEMI);
            this.state = 554;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14 || _la === 15 || _la === 115) {
                {
                this.state = 553;
                this.forUpdate();
                }
            }

            this.state = 556;
            this.match(CnxParser.RPAREN);
            this.state = 557;
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
            this.state = 559;
            this.match(CnxParser.FOREVER);
            this.state = 560;
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
            this.state = 564;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 52, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 562;
                this.forVarDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 563;
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
            this.state = 567;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 49) {
                {
                this.state = 566;
                this.atomicModifier();
                }
            }

            this.state = 570;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 21) {
                {
                this.state = 569;
                this.volatileModifier();
                }
            }

            this.state = 573;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 20) {
                {
                this.state = 572;
                this.mutModifier();
                }
            }

            this.state = 576;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 575;
                this.overflowModifier();
                }
            }

            this.state = 578;
            this.type_();
            this.state = 579;
            this.match(CnxParser.IDENTIFIER);
            this.state = 583;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 102) {
                {
                {
                this.state = 580;
                this.arrayDimension();
                }
                }
                this.state = 585;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 588;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 77) {
                {
                this.state = 586;
                this.match(CnxParser.ASSIGN);
                this.state = 587;
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
            this.state = 590;
            this.assignmentTarget();
            this.state = 591;
            this.assignmentOperator();
            this.state = 592;
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
            this.state = 594;
            this.assignmentTarget();
            this.state = 595;
            this.assignmentOperator();
            this.state = 596;
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
            this.state = 598;
            this.match(CnxParser.RETURN);
            this.state = 600;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                {
                this.state = 599;
                this.expression();
                }
            }

            this.state = 602;
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
            this.state = 604;
            this.match(CnxParser.SWITCH);
            this.state = 605;
            this.match(CnxParser.LPAREN);
            this.state = 606;
            this.expression();
            this.state = 607;
            this.match(CnxParser.RPAREN);
            this.state = 608;
            this.match(CnxParser.LBRACE);
            this.state = 610;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 609;
                this.switchCase();
                }
                }
                this.state = 612;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 30);
            this.state = 615;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 31) {
                {
                this.state = 614;
                this.defaultCase();
                }
            }

            this.state = 617;
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
            this.state = 619;
            this.match(CnxParser.CASE);
            this.state = 620;
            this.caseLabel();
            this.state = 625;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 90) {
                {
                {
                this.state = 621;
                this.match(CnxParser.OR);
                this.state = 622;
                this.caseLabel();
                }
                }
                this.state = 627;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 628;
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
            this.state = 648;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 66, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 630;
                this.qualifiedType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 631;
                _la = this.tokenStream.LA(1);
                if(!(_la === 14 || _la === 15)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 632;
                this.match(CnxParser.DOT);
                this.state = 635;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 63, this.context) ) {
                case 1:
                    {
                    this.state = 633;
                    this.qualifiedType();
                    }
                    break;
                case 2:
                    {
                    this.state = 634;
                    this.match(CnxParser.IDENTIFIER);
                    }
                    break;
                }
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 637;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 639;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 85) {
                    {
                    this.state = 638;
                    this.match(CnxParser.MINUS);
                    }
                }

                this.state = 641;
                this.match(CnxParser.INTEGER_LITERAL);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 643;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 85) {
                    {
                    this.state = 642;
                    this.match(CnxParser.MINUS);
                    }
                }

                this.state = 645;
                this.match(CnxParser.HEX_LITERAL);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 646;
                this.match(CnxParser.BINARY_LITERAL);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 647;
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
            this.state = 650;
            this.match(CnxParser.DEFAULT);
            this.state = 654;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 98) {
                {
                this.state = 651;
                this.match(CnxParser.LPAREN);
                this.state = 652;
                this.match(CnxParser.INTEGER_LITERAL);
                this.state = 653;
                this.match(CnxParser.RPAREN);
                }
            }

            this.state = 656;
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
            this.state = 658;
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
            this.state = 669;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 68, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 660;
                this.match(CnxParser.LPAREN);
                this.state = 661;
                this.orExpression();
                this.state = 662;
                this.match(CnxParser.RPAREN);
                this.state = 663;
                this.match(CnxParser.T__0);
                this.state = 664;
                this.orExpression();
                this.state = 665;
                this.match(CnxParser.COLON);
                this.state = 666;
                this.orExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 668;
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
            this.state = 671;
            this.andExpression();
            this.state = 676;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 90) {
                {
                {
                this.state = 672;
                this.match(CnxParser.OR);
                this.state = 673;
                this.andExpression();
                }
                }
                this.state = 678;
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
            this.state = 679;
            this.equalityExpression();
            this.state = 684;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 89) {
                {
                {
                this.state = 680;
                this.match(CnxParser.AND);
                this.state = 681;
                this.equalityExpression();
                }
                }
                this.state = 686;
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
            this.state = 687;
            this.relationalExpression();
            this.state = 692;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 78 || _la === 79) {
                {
                {
                this.state = 688;
                _la = this.tokenStream.LA(1);
                if(!(_la === 78 || _la === 79)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 689;
                this.relationalExpression();
                }
                }
                this.state = 694;
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
            this.state = 695;
            this.bitwiseOrExpression();
            this.state = 700;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 15) !== 0)) {
                {
                {
                this.state = 696;
                _la = this.tokenStream.LA(1);
                if(!(((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 15) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 697;
                this.bitwiseOrExpression();
                }
                }
                this.state = 702;
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
            this.state = 703;
            this.bitwiseXorExpression();
            this.state = 708;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 93) {
                {
                {
                this.state = 704;
                this.match(CnxParser.BITOR);
                this.state = 705;
                this.bitwiseXorExpression();
                }
                }
                this.state = 710;
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
            this.state = 711;
            this.bitwiseAndExpression();
            this.state = 716;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 94) {
                {
                {
                this.state = 712;
                this.match(CnxParser.BITXOR);
                this.state = 713;
                this.bitwiseAndExpression();
                }
                }
                this.state = 718;
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
            this.state = 719;
            this.shiftExpression();
            this.state = 724;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 92) {
                {
                {
                this.state = 720;
                this.match(CnxParser.BITAND);
                this.state = 721;
                this.shiftExpression();
                }
                }
                this.state = 726;
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
            this.state = 727;
            this.additiveExpression();
            this.state = 732;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 96 || _la === 97) {
                {
                {
                this.state = 728;
                _la = this.tokenStream.LA(1);
                if(!(_la === 96 || _la === 97)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 729;
                this.additiveExpression();
                }
                }
                this.state = 734;
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
            this.state = 735;
            this.multiplicativeExpression();
            this.state = 740;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 84 || _la === 85) {
                {
                {
                this.state = 736;
                _la = this.tokenStream.LA(1);
                if(!(_la === 84 || _la === 85)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 737;
                this.multiplicativeExpression();
                }
                }
                this.state = 742;
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
            this.state = 743;
            this.unaryExpression();
            this.state = 748;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 78, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 744;
                    _la = this.tokenStream.LA(1);
                    if(!(((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 7) !== 0))) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 745;
                    this.unaryExpression();
                    }
                    }
                }
                this.state = 750;
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
        this.enterRule(localContext, 130, CnxParser.RULE_unaryExpression);
        try {
            this.state = 758;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.NOT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 751;
                this.match(CnxParser.NOT);
                this.state = 752;
                this.unaryExpression();
                }
                break;
            case CnxParser.MINUS:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 753;
                this.match(CnxParser.MINUS);
                this.state = 754;
                this.unaryExpression();
                }
                break;
            case CnxParser.BITNOT:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 755;
                this.match(CnxParser.BITNOT);
                this.state = 756;
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
                this.state = 757;
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
            this.state = 771;
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
                this.state = 760;
                this.primaryExpression();
                this.state = 764;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 80, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 761;
                        this.postfixOp();
                        }
                        }
                    }
                    this.state = 766;
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
                this.state = 767;
                this.primitiveType();
                this.state = 768;
                this.match(CnxParser.DOT);
                this.state = 769;
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
            this.state = 788;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CnxParser.DOT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 773;
                this.match(CnxParser.DOT);
                this.state = 774;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case CnxParser.LBRACKET:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 775;
                this.match(CnxParser.LBRACKET);
                this.state = 776;
                this.expression();
                this.state = 779;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 105) {
                    {
                    this.state = 777;
                    this.match(CnxParser.COMMA);
                    this.state = 778;
                    this.expression();
                    }
                }

                this.state = 781;
                this.match(CnxParser.RBRACKET);
                }
                break;
            case CnxParser.LPAREN:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 783;
                this.match(CnxParser.LPAREN);
                this.state = 785;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                    {
                    this.state = 784;
                    this.argumentList();
                    }
                }

                this.state = 787;
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
        this.enterRule(localContext, 136, CnxParser.RULE_primaryExpression);
        try {
            this.state = 802;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 85, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 790;
                this.sizeofExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 791;
                this.castExpression();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 792;
                this.structInitializer();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 793;
                this.arrayInitializer();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 794;
                this.match(CnxParser.THIS);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 795;
                this.match(CnxParser.GLOBAL);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 796;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 797;
                this.literal();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 798;
                this.match(CnxParser.LPAREN);
                this.state = 799;
                this.expression();
                this.state = 800;
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
            this.state = 804;
            this.match(CnxParser.SIZEOF);
            this.state = 805;
            this.match(CnxParser.LPAREN);
            this.state = 808;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 86, this.context) ) {
            case 1:
                {
                this.state = 806;
                this.type_();
                }
                break;
            case 2:
                {
                this.state = 807;
                this.expression();
                }
                break;
            }
            this.state = 810;
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
            this.state = 812;
            this.match(CnxParser.LPAREN);
            this.state = 814;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47 || _la === 48) {
                {
                this.state = 813;
                this.overflowModifier();
                }
            }

            this.state = 816;
            this.type_();
            this.state = 817;
            this.match(CnxParser.RPAREN);
            this.state = 818;
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
            this.state = 820;
            this.match(CnxParser.LBRACE);
            this.state = 821;
            this.fieldInitializerList();
            this.state = 822;
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
            this.state = 824;
            this.fieldInitializer();
            this.state = 829;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 88, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 825;
                    this.match(CnxParser.COMMA);
                    this.state = 826;
                    this.fieldInitializer();
                    }
                    }
                }
                this.state = 831;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 88, this.context);
            }
            this.state = 833;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 832;
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
            this.state = 835;
            this.match(CnxParser.IDENTIFIER);
            this.state = 836;
            this.match(CnxParser.COLON);
            this.state = 837;
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
            this.state = 858;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 92, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 839;
                this.match(CnxParser.LBRACKET);
                this.state = 840;
                this.arrayInitializerElement();
                this.state = 845;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 90, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 841;
                        this.match(CnxParser.COMMA);
                        this.state = 842;
                        this.arrayInitializerElement();
                        }
                        }
                    }
                    this.state = 847;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 90, this.context);
                }
                this.state = 849;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 105) {
                    {
                    this.state = 848;
                    this.match(CnxParser.COMMA);
                    }
                }

                this.state = 851;
                this.match(CnxParser.RBRACKET);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 853;
                this.match(CnxParser.LBRACKET);
                this.state = 854;
                this.expression();
                this.state = 855;
                this.match(CnxParser.STAR);
                this.state = 856;
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
            this.state = 863;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 93, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 860;
                this.expression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 861;
                this.structInitializer();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 862;
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
            this.state = 865;
            this.expression();
            this.state = 870;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 866;
                this.match(CnxParser.COMMA);
                this.state = 867;
                this.expression();
                }
                }
                this.state = 872;
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
            this.state = 882;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 95, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 873;
                this.primitiveType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 874;
                this.stringType();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 875;
                this.scopedType();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 876;
                this.globalType();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 877;
                this.qualifiedType();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 878;
                this.templateType();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 879;
                this.userType();
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 880;
                this.arrayType();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 881;
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
            this.state = 884;
            this.match(CnxParser.THIS);
            this.state = 885;
            this.match(CnxParser.DOT);
            this.state = 886;
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
            this.state = 888;
            this.match(CnxParser.GLOBAL);
            this.state = 889;
            this.match(CnxParser.DOT);
            this.state = 890;
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
            this.state = 892;
            this.match(CnxParser.IDENTIFIER);
            this.state = 895;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 893;
                this.match(CnxParser.DOT);
                this.state = 894;
                this.match(CnxParser.IDENTIFIER);
                }
                }
                this.state = 897;
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
            this.state = 899;
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
            this.state = 901;
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
            this.state = 903;
            this.match(CnxParser.IDENTIFIER);
            this.state = 904;
            this.match(CnxParser.LT);
            this.state = 905;
            this.templateArgumentList();
            this.state = 906;
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
            this.state = 908;
            this.templateArgument();
            this.state = 913;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 105) {
                {
                {
                this.state = 909;
                this.match(CnxParser.COMMA);
                this.state = 910;
                this.templateArgument();
                }
                }
                this.state = 915;
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
            this.state = 920;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 98, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 916;
                this.templateType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 917;
                this.primitiveType();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 918;
                this.match(CnxParser.IDENTIFIER);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 919;
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
            this.state = 927;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 99, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 922;
                this.match(CnxParser.STRING);
                this.state = 923;
                this.match(CnxParser.LT);
                this.state = 924;
                this.match(CnxParser.INTEGER_LITERAL);
                this.state = 925;
                this.match(CnxParser.GT);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 926;
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
            this.state = 965;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 106, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 929;
                this.primitiveType();
                this.state = 931;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 930;
                    this.arrayTypeDimension();
                    }
                    }
                    this.state = 933;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 102);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 935;
                this.userType();
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
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 941;
                this.stringType();
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
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 947;
                this.scopedType();
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
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 953;
                this.qualifiedType();
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
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 959;
                this.globalType();
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
            this.state = 967;
            this.match(CnxParser.LBRACKET);
            this.state = 969;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 14)) & ~0x1F) === 0 && ((1 << (_la - 14)) & 12058627) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 65535) !== 0) || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 2130879553) !== 0)) {
                {
                this.state = 968;
                this.expression();
                }
            }

            this.state = 971;
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
            this.state = 973;
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
        4,1,119,976,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,
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
        8,36,1,37,1,37,1,37,1,37,1,37,1,37,3,37,512,8,37,1,37,1,37,3,37,
        516,8,37,1,38,1,38,1,38,1,39,1,39,1,39,1,39,1,39,1,39,1,39,3,39,
        528,8,39,1,40,1,40,1,40,1,40,1,40,1,40,1,41,1,41,1,41,1,41,1,41,
        1,41,1,41,1,41,1,42,1,42,1,42,3,42,547,8,42,1,42,1,42,3,42,551,8,
        42,1,42,1,42,3,42,555,8,42,1,42,1,42,1,42,1,43,1,43,1,43,1,44,1,
        44,3,44,565,8,44,1,45,3,45,568,8,45,1,45,3,45,571,8,45,1,45,3,45,
        574,8,45,1,45,3,45,577,8,45,1,45,1,45,1,45,5,45,582,8,45,10,45,12,
        45,585,9,45,1,45,1,45,3,45,589,8,45,1,46,1,46,1,46,1,46,1,47,1,47,
        1,47,1,47,1,48,1,48,3,48,601,8,48,1,48,1,48,1,49,1,49,1,49,1,49,
        1,49,1,49,4,49,611,8,49,11,49,12,49,612,1,49,3,49,616,8,49,1,49,
        1,49,1,50,1,50,1,50,1,50,5,50,624,8,50,10,50,12,50,627,9,50,1,50,
        1,50,1,51,1,51,1,51,1,51,1,51,3,51,636,8,51,1,51,1,51,3,51,640,8,
        51,1,51,1,51,3,51,644,8,51,1,51,1,51,1,51,3,51,649,8,51,1,52,1,52,
        1,52,1,52,3,52,655,8,52,1,52,1,52,1,53,1,53,1,54,1,54,1,54,1,54,
        1,54,1,54,1,54,1,54,1,54,3,54,670,8,54,1,55,1,55,1,55,5,55,675,8,
        55,10,55,12,55,678,9,55,1,56,1,56,1,56,5,56,683,8,56,10,56,12,56,
        686,9,56,1,57,1,57,1,57,5,57,691,8,57,10,57,12,57,694,9,57,1,58,
        1,58,1,58,5,58,699,8,58,10,58,12,58,702,9,58,1,59,1,59,1,59,5,59,
        707,8,59,10,59,12,59,710,9,59,1,60,1,60,1,60,5,60,715,8,60,10,60,
        12,60,718,9,60,1,61,1,61,1,61,5,61,723,8,61,10,61,12,61,726,9,61,
        1,62,1,62,1,62,5,62,731,8,62,10,62,12,62,734,9,62,1,63,1,63,1,63,
        5,63,739,8,63,10,63,12,63,742,9,63,1,64,1,64,1,64,5,64,747,8,64,
        10,64,12,64,750,9,64,1,65,1,65,1,65,1,65,1,65,1,65,1,65,3,65,759,
        8,65,1,66,1,66,5,66,763,8,66,10,66,12,66,766,9,66,1,66,1,66,1,66,
        1,66,3,66,772,8,66,1,67,1,67,1,67,1,67,1,67,1,67,3,67,780,8,67,1,
        67,1,67,1,67,1,67,3,67,786,8,67,1,67,3,67,789,8,67,1,68,1,68,1,68,
        1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,3,68,803,8,68,1,69,
        1,69,1,69,1,69,3,69,809,8,69,1,69,1,69,1,70,1,70,3,70,815,8,70,1,
        70,1,70,1,70,1,70,1,71,1,71,1,71,1,71,1,72,1,72,1,72,5,72,828,8,
        72,10,72,12,72,831,9,72,1,72,3,72,834,8,72,1,73,1,73,1,73,1,73,1,
        74,1,74,1,74,1,74,5,74,844,8,74,10,74,12,74,847,9,74,1,74,3,74,850,
        8,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,3,74,859,8,74,1,75,1,75,
        1,75,3,75,864,8,75,1,76,1,76,1,76,5,76,869,8,76,10,76,12,76,872,
        9,76,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,3,77,883,8,77,
        1,78,1,78,1,78,1,78,1,79,1,79,1,79,1,79,1,80,1,80,1,80,4,80,896,
        8,80,11,80,12,80,897,1,81,1,81,1,82,1,82,1,83,1,83,1,83,1,83,1,83,
        1,84,1,84,1,84,5,84,912,8,84,10,84,12,84,915,9,84,1,85,1,85,1,85,
        1,85,3,85,921,8,85,1,86,1,86,1,86,1,86,1,86,3,86,928,8,86,1,87,1,
        87,4,87,932,8,87,11,87,12,87,933,1,87,1,87,4,87,938,8,87,11,87,12,
        87,939,1,87,1,87,4,87,944,8,87,11,87,12,87,945,1,87,1,87,4,87,950,
        8,87,11,87,12,87,951,1,87,1,87,4,87,956,8,87,11,87,12,87,957,1,87,
        1,87,4,87,962,8,87,11,87,12,87,963,3,87,966,8,87,1,88,1,88,3,88,
        970,8,88,1,88,1,88,1,89,1,89,1,89,0,0,90,0,2,4,6,8,10,12,14,16,18,
        20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,
        64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,
        106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,
        138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,168,
        170,172,174,176,178,0,15,1,0,3,5,1,0,6,9,1,0,17,18,1,0,42,46,1,0,
        38,41,1,0,47,48,1,0,67,77,1,0,14,15,1,0,78,79,1,0,80,83,1,0,96,97,
        1,0,84,85,1,0,86,88,1,0,55,66,3,0,33,35,51,54,109,114,1043,0,184,
        1,0,0,0,2,195,1,0,0,0,4,200,1,0,0,0,6,202,1,0,0,0,8,204,1,0,0,0,
        10,206,1,0,0,0,12,215,1,0,0,0,14,217,1,0,0,0,16,252,1,0,0,0,18,254,
        1,0,0,0,20,256,1,0,0,0,22,269,1,0,0,0,24,278,1,0,0,0,26,280,1,0,
        0,0,28,292,1,0,0,0,30,304,1,0,0,0,32,320,1,0,0,0,34,325,1,0,0,0,
        36,341,1,0,0,0,38,343,1,0,0,0,40,350,1,0,0,0,42,361,1,0,0,0,44,370,
        1,0,0,0,46,383,1,0,0,0,48,385,1,0,0,0,50,387,1,0,0,0,52,389,1,0,
        0,0,54,391,1,0,0,0,56,393,1,0,0,0,58,435,1,0,0,0,60,437,1,0,0,0,
        62,445,1,0,0,0,64,466,1,0,0,0,66,468,1,0,0,0,68,471,1,0,0,0,70,476,
        1,0,0,0,72,503,1,0,0,0,74,515,1,0,0,0,76,517,1,0,0,0,78,520,1,0,
        0,0,80,529,1,0,0,0,82,535,1,0,0,0,84,543,1,0,0,0,86,559,1,0,0,0,
        88,564,1,0,0,0,90,567,1,0,0,0,92,590,1,0,0,0,94,594,1,0,0,0,96,598,
        1,0,0,0,98,604,1,0,0,0,100,619,1,0,0,0,102,648,1,0,0,0,104,650,1,
        0,0,0,106,658,1,0,0,0,108,669,1,0,0,0,110,671,1,0,0,0,112,679,1,
        0,0,0,114,687,1,0,0,0,116,695,1,0,0,0,118,703,1,0,0,0,120,711,1,
        0,0,0,122,719,1,0,0,0,124,727,1,0,0,0,126,735,1,0,0,0,128,743,1,
        0,0,0,130,758,1,0,0,0,132,771,1,0,0,0,134,788,1,0,0,0,136,802,1,
        0,0,0,138,804,1,0,0,0,140,812,1,0,0,0,142,820,1,0,0,0,144,824,1,
        0,0,0,146,835,1,0,0,0,148,858,1,0,0,0,150,863,1,0,0,0,152,865,1,
        0,0,0,154,882,1,0,0,0,156,884,1,0,0,0,158,888,1,0,0,0,160,892,1,
        0,0,0,162,899,1,0,0,0,164,901,1,0,0,0,166,903,1,0,0,0,168,908,1,
        0,0,0,170,920,1,0,0,0,172,927,1,0,0,0,174,965,1,0,0,0,176,967,1,
        0,0,0,178,973,1,0,0,0,180,183,3,2,1,0,181,183,3,4,2,0,182,180,1,
        0,0,0,182,181,1,0,0,0,183,186,1,0,0,0,184,182,1,0,0,0,184,185,1,
        0,0,0,185,190,1,0,0,0,186,184,1,0,0,0,187,189,3,12,6,0,188,187,1,
        0,0,0,189,192,1,0,0,0,190,188,1,0,0,0,190,191,1,0,0,0,191,193,1,
        0,0,0,192,190,1,0,0,0,193,194,5,0,0,1,194,1,1,0,0,0,195,196,5,2,
        0,0,196,3,1,0,0,0,197,201,3,6,3,0,198,201,3,8,4,0,199,201,3,10,5,
        0,200,197,1,0,0,0,200,198,1,0,0,0,200,199,1,0,0,0,201,5,1,0,0,0,
        202,203,7,0,0,0,203,7,1,0,0,0,204,205,7,1,0,0,205,9,1,0,0,0,206,
        207,5,10,0,0,207,11,1,0,0,0,208,216,3,14,7,0,209,216,3,20,10,0,210,
        216,3,26,13,0,211,216,3,30,15,0,212,216,3,34,17,0,213,216,3,40,20,
        0,214,216,3,58,29,0,215,208,1,0,0,0,215,209,1,0,0,0,215,210,1,0,
        0,0,215,211,1,0,0,0,215,212,1,0,0,0,215,213,1,0,0,0,215,214,1,0,
        0,0,216,13,1,0,0,0,217,218,5,11,0,0,218,219,5,115,0,0,219,223,5,
        100,0,0,220,222,3,16,8,0,221,220,1,0,0,0,222,225,1,0,0,0,223,221,
        1,0,0,0,223,224,1,0,0,0,224,226,1,0,0,0,225,223,1,0,0,0,226,227,
        5,101,0,0,227,15,1,0,0,0,228,230,3,18,9,0,229,228,1,0,0,0,229,230,
        1,0,0,0,230,231,1,0,0,0,231,253,3,58,29,0,232,234,3,18,9,0,233,232,
        1,0,0,0,233,234,1,0,0,0,234,235,1,0,0,0,235,253,3,40,20,0,236,238,
        3,18,9,0,237,236,1,0,0,0,237,238,1,0,0,0,238,239,1,0,0,0,239,253,
        3,30,15,0,240,242,3,18,9,0,241,240,1,0,0,0,241,242,1,0,0,0,242,243,
        1,0,0,0,243,253,3,34,17,0,244,246,3,18,9,0,245,244,1,0,0,0,245,246,
        1,0,0,0,246,247,1,0,0,0,247,253,3,20,10,0,248,250,3,18,9,0,249,248,
        1,0,0,0,249,250,1,0,0,0,250,251,1,0,0,0,251,253,3,26,13,0,252,229,
        1,0,0,0,252,233,1,0,0,0,252,237,1,0,0,0,252,241,1,0,0,0,252,245,
        1,0,0,0,252,249,1,0,0,0,253,17,1,0,0,0,254,255,7,2,0,0,255,19,1,
        0,0,0,256,257,5,16,0,0,257,258,5,115,0,0,258,259,5,107,0,0,259,260,
        3,106,53,0,260,264,5,100,0,0,261,263,3,22,11,0,262,261,1,0,0,0,263,
        266,1,0,0,0,264,262,1,0,0,0,264,265,1,0,0,0,265,267,1,0,0,0,266,
        264,1,0,0,0,267,268,5,101,0,0,268,21,1,0,0,0,269,270,5,115,0,0,270,
        271,5,108,0,0,271,272,3,154,77,0,272,273,3,24,12,0,273,274,5,107,
        0,0,274,276,3,106,53,0,275,277,5,105,0,0,276,275,1,0,0,0,276,277,
        1,0,0,0,277,23,1,0,0,0,278,279,7,3,0,0,279,25,1,0,0,0,280,281,5,
        12,0,0,281,282,5,115,0,0,282,286,5,100,0,0,283,285,3,28,14,0,284,
        283,1,0,0,0,285,288,1,0,0,0,286,284,1,0,0,0,286,287,1,0,0,0,287,
        289,1,0,0,0,288,286,1,0,0,0,289,290,5,101,0,0,290,27,1,0,0,0,291,
        293,3,52,26,0,292,291,1,0,0,0,292,293,1,0,0,0,293,294,1,0,0,0,294,
        295,3,154,77,0,295,299,5,115,0,0,296,298,3,56,28,0,297,296,1,0,0,
        0,298,301,1,0,0,0,299,297,1,0,0,0,299,300,1,0,0,0,300,302,1,0,0,
        0,301,299,1,0,0,0,302,303,5,104,0,0,303,29,1,0,0,0,304,305,5,13,
        0,0,305,306,5,115,0,0,306,307,5,100,0,0,307,312,3,32,16,0,308,309,
        5,105,0,0,309,311,3,32,16,0,310,308,1,0,0,0,311,314,1,0,0,0,312,
        310,1,0,0,0,312,313,1,0,0,0,313,316,1,0,0,0,314,312,1,0,0,0,315,
        317,5,105,0,0,316,315,1,0,0,0,316,317,1,0,0,0,317,318,1,0,0,0,318,
        319,5,101,0,0,319,31,1,0,0,0,320,323,5,115,0,0,321,322,5,77,0,0,
        322,324,3,106,53,0,323,321,1,0,0,0,323,324,1,0,0,0,324,33,1,0,0,
        0,325,326,3,36,18,0,326,327,5,115,0,0,327,328,5,100,0,0,328,333,
        3,38,19,0,329,330,5,105,0,0,330,332,3,38,19,0,331,329,1,0,0,0,332,
        335,1,0,0,0,333,331,1,0,0,0,333,334,1,0,0,0,334,337,1,0,0,0,335,
        333,1,0,0,0,336,338,5,105,0,0,337,336,1,0,0,0,337,338,1,0,0,0,338,
        339,1,0,0,0,339,340,5,101,0,0,340,35,1,0,0,0,341,342,7,4,0,0,342,
        37,1,0,0,0,343,347,5,115,0,0,344,345,5,102,0,0,345,346,5,112,0,0,
        346,348,5,103,0,0,347,344,1,0,0,0,347,348,1,0,0,0,348,39,1,0,0,0,
        349,351,3,52,26,0,350,349,1,0,0,0,350,351,1,0,0,0,351,352,1,0,0,
        0,352,353,3,154,77,0,353,354,5,115,0,0,354,356,5,98,0,0,355,357,
        3,42,21,0,356,355,1,0,0,0,356,357,1,0,0,0,357,358,1,0,0,0,358,359,
        5,99,0,0,359,360,3,62,31,0,360,41,1,0,0,0,361,366,3,44,22,0,362,
        363,5,105,0,0,363,365,3,44,22,0,364,362,1,0,0,0,365,368,1,0,0,0,
        366,364,1,0,0,0,366,367,1,0,0,0,367,43,1,0,0,0,368,366,1,0,0,0,369,
        371,3,46,23,0,370,369,1,0,0,0,370,371,1,0,0,0,371,373,1,0,0,0,372,
        374,3,48,24,0,373,372,1,0,0,0,373,374,1,0,0,0,374,375,1,0,0,0,375,
        376,3,154,77,0,376,380,5,115,0,0,377,379,3,56,28,0,378,377,1,0,0,
        0,379,382,1,0,0,0,380,378,1,0,0,0,380,381,1,0,0,0,381,45,1,0,0,0,
        382,380,1,0,0,0,383,384,5,19,0,0,384,47,1,0,0,0,385,386,5,20,0,0,
        386,49,1,0,0,0,387,388,5,21,0,0,388,51,1,0,0,0,389,390,7,5,0,0,390,
        53,1,0,0,0,391,392,5,49,0,0,392,55,1,0,0,0,393,395,5,102,0,0,394,
        396,3,106,53,0,395,394,1,0,0,0,395,396,1,0,0,0,396,397,1,0,0,0,397,
        398,5,103,0,0,398,57,1,0,0,0,399,401,3,54,27,0,400,399,1,0,0,0,400,
        401,1,0,0,0,401,403,1,0,0,0,402,404,3,50,25,0,403,402,1,0,0,0,403,
        404,1,0,0,0,404,406,1,0,0,0,405,407,3,46,23,0,406,405,1,0,0,0,406,
        407,1,0,0,0,407,409,1,0,0,0,408,410,3,48,24,0,409,408,1,0,0,0,409,
        410,1,0,0,0,410,412,1,0,0,0,411,413,3,52,26,0,412,411,1,0,0,0,412,
        413,1,0,0,0,413,414,1,0,0,0,414,415,3,154,77,0,415,419,5,115,0,0,
        416,418,3,56,28,0,417,416,1,0,0,0,418,421,1,0,0,0,419,417,1,0,0,
        0,419,420,1,0,0,0,420,424,1,0,0,0,421,419,1,0,0,0,422,423,5,77,0,
        0,423,425,3,106,53,0,424,422,1,0,0,0,424,425,1,0,0,0,425,426,1,0,
        0,0,426,427,5,104,0,0,427,436,1,0,0,0,428,429,3,154,77,0,429,430,
        5,115,0,0,430,431,5,98,0,0,431,432,3,60,30,0,432,433,5,99,0,0,433,
        434,5,104,0,0,434,436,1,0,0,0,435,400,1,0,0,0,435,428,1,0,0,0,436,
        59,1,0,0,0,437,442,5,115,0,0,438,439,5,105,0,0,439,441,5,115,0,0,
        440,438,1,0,0,0,441,444,1,0,0,0,442,440,1,0,0,0,442,443,1,0,0,0,
        443,61,1,0,0,0,444,442,1,0,0,0,445,449,5,100,0,0,446,448,3,64,32,
        0,447,446,1,0,0,0,448,451,1,0,0,0,449,447,1,0,0,0,449,450,1,0,0,
        0,450,452,1,0,0,0,451,449,1,0,0,0,452,453,5,101,0,0,453,63,1,0,0,
        0,454,467,3,58,29,0,455,467,3,68,34,0,456,467,3,76,38,0,457,467,
        3,78,39,0,458,467,3,80,40,0,459,467,3,82,41,0,460,467,3,84,42,0,
        461,467,3,86,43,0,462,467,3,98,49,0,463,467,3,96,48,0,464,467,3,
        66,33,0,465,467,3,62,31,0,466,454,1,0,0,0,466,455,1,0,0,0,466,456,
        1,0,0,0,466,457,1,0,0,0,466,458,1,0,0,0,466,459,1,0,0,0,466,460,
        1,0,0,0,466,461,1,0,0,0,466,462,1,0,0,0,466,463,1,0,0,0,466,464,
        1,0,0,0,466,465,1,0,0,0,467,65,1,0,0,0,468,469,5,50,0,0,469,470,
        3,62,31,0,470,67,1,0,0,0,471,472,3,72,36,0,472,473,3,70,35,0,473,
        474,3,106,53,0,474,475,5,104,0,0,475,69,1,0,0,0,476,477,7,6,0,0,
        477,71,1,0,0,0,478,479,5,15,0,0,479,480,5,106,0,0,480,484,5,115,
        0,0,481,483,3,74,37,0,482,481,1,0,0,0,483,486,1,0,0,0,484,482,1,
        0,0,0,484,485,1,0,0,0,485,504,1,0,0,0,486,484,1,0,0,0,487,488,5,
        14,0,0,488,489,5,106,0,0,489,493,5,115,0,0,490,492,3,74,37,0,491,
        490,1,0,0,0,492,495,1,0,0,0,493,491,1,0,0,0,493,494,1,0,0,0,494,
        504,1,0,0,0,495,493,1,0,0,0,496,500,5,115,0,0,497,499,3,74,37,0,
        498,497,1,0,0,0,499,502,1,0,0,0,500,498,1,0,0,0,500,501,1,0,0,0,
        501,504,1,0,0,0,502,500,1,0,0,0,503,478,1,0,0,0,503,487,1,0,0,0,
        503,496,1,0,0,0,504,73,1,0,0,0,505,506,5,106,0,0,506,516,5,115,0,
        0,507,508,5,102,0,0,508,511,3,106,53,0,509,510,5,105,0,0,510,512,
        3,106,53,0,511,509,1,0,0,0,511,512,1,0,0,0,512,513,1,0,0,0,513,514,
        5,103,0,0,514,516,1,0,0,0,515,505,1,0,0,0,515,507,1,0,0,0,516,75,
        1,0,0,0,517,518,3,106,53,0,518,519,5,104,0,0,519,77,1,0,0,0,520,
        521,5,23,0,0,521,522,5,98,0,0,522,523,3,106,53,0,523,524,5,99,0,
        0,524,527,3,64,32,0,525,526,5,24,0,0,526,528,3,64,32,0,527,525,1,
        0,0,0,527,528,1,0,0,0,528,79,1,0,0,0,529,530,5,25,0,0,530,531,5,
        98,0,0,531,532,3,106,53,0,532,533,5,99,0,0,533,534,3,64,32,0,534,
        81,1,0,0,0,535,536,5,26,0,0,536,537,3,62,31,0,537,538,5,25,0,0,538,
        539,5,98,0,0,539,540,3,106,53,0,540,541,5,99,0,0,541,542,5,104,0,
        0,542,83,1,0,0,0,543,544,5,27,0,0,544,546,5,98,0,0,545,547,3,88,
        44,0,546,545,1,0,0,0,546,547,1,0,0,0,547,548,1,0,0,0,548,550,5,104,
        0,0,549,551,3,106,53,0,550,549,1,0,0,0,550,551,1,0,0,0,551,552,1,
        0,0,0,552,554,5,104,0,0,553,555,3,94,47,0,554,553,1,0,0,0,554,555,
        1,0,0,0,555,556,1,0,0,0,556,557,5,99,0,0,557,558,3,64,32,0,558,85,
        1,0,0,0,559,560,5,28,0,0,560,561,3,62,31,0,561,87,1,0,0,0,562,565,
        3,90,45,0,563,565,3,92,46,0,564,562,1,0,0,0,564,563,1,0,0,0,565,
        89,1,0,0,0,566,568,3,54,27,0,567,566,1,0,0,0,567,568,1,0,0,0,568,
        570,1,0,0,0,569,571,3,50,25,0,570,569,1,0,0,0,570,571,1,0,0,0,571,
        573,1,0,0,0,572,574,3,48,24,0,573,572,1,0,0,0,573,574,1,0,0,0,574,
        576,1,0,0,0,575,577,3,52,26,0,576,575,1,0,0,0,576,577,1,0,0,0,577,
        578,1,0,0,0,578,579,3,154,77,0,579,583,5,115,0,0,580,582,3,56,28,
        0,581,580,1,0,0,0,582,585,1,0,0,0,583,581,1,0,0,0,583,584,1,0,0,
        0,584,588,1,0,0,0,585,583,1,0,0,0,586,587,5,77,0,0,587,589,3,106,
        53,0,588,586,1,0,0,0,588,589,1,0,0,0,589,91,1,0,0,0,590,591,3,72,
        36,0,591,592,3,70,35,0,592,593,3,106,53,0,593,93,1,0,0,0,594,595,
        3,72,36,0,595,596,3,70,35,0,596,597,3,106,53,0,597,95,1,0,0,0,598,
        600,5,32,0,0,599,601,3,106,53,0,600,599,1,0,0,0,600,601,1,0,0,0,
        601,602,1,0,0,0,602,603,5,104,0,0,603,97,1,0,0,0,604,605,5,29,0,
        0,605,606,5,98,0,0,606,607,3,106,53,0,607,608,5,99,0,0,608,610,5,
        100,0,0,609,611,3,100,50,0,610,609,1,0,0,0,611,612,1,0,0,0,612,610,
        1,0,0,0,612,613,1,0,0,0,613,615,1,0,0,0,614,616,3,104,52,0,615,614,
        1,0,0,0,615,616,1,0,0,0,616,617,1,0,0,0,617,618,5,101,0,0,618,99,
        1,0,0,0,619,620,5,30,0,0,620,625,3,102,51,0,621,622,5,90,0,0,622,
        624,3,102,51,0,623,621,1,0,0,0,624,627,1,0,0,0,625,623,1,0,0,0,625,
        626,1,0,0,0,626,628,1,0,0,0,627,625,1,0,0,0,628,629,3,62,31,0,629,
        101,1,0,0,0,630,649,3,160,80,0,631,632,7,7,0,0,632,635,5,106,0,0,
        633,636,3,160,80,0,634,636,5,115,0,0,635,633,1,0,0,0,635,634,1,0,
        0,0,636,649,1,0,0,0,637,649,5,115,0,0,638,640,5,85,0,0,639,638,1,
        0,0,0,639,640,1,0,0,0,640,641,1,0,0,0,641,649,5,112,0,0,642,644,
        5,85,0,0,643,642,1,0,0,0,643,644,1,0,0,0,644,645,1,0,0,0,645,649,
        5,109,0,0,646,649,5,110,0,0,647,649,5,114,0,0,648,630,1,0,0,0,648,
        631,1,0,0,0,648,637,1,0,0,0,648,639,1,0,0,0,648,643,1,0,0,0,648,
        646,1,0,0,0,648,647,1,0,0,0,649,103,1,0,0,0,650,654,5,31,0,0,651,
        652,5,98,0,0,652,653,5,112,0,0,653,655,5,99,0,0,654,651,1,0,0,0,
        654,655,1,0,0,0,655,656,1,0,0,0,656,657,3,62,31,0,657,105,1,0,0,
        0,658,659,3,108,54,0,659,107,1,0,0,0,660,661,5,98,0,0,661,662,3,
        110,55,0,662,663,5,99,0,0,663,664,5,1,0,0,664,665,3,110,55,0,665,
        666,5,108,0,0,666,667,3,110,55,0,667,670,1,0,0,0,668,670,3,110,55,
        0,669,660,1,0,0,0,669,668,1,0,0,0,670,109,1,0,0,0,671,676,3,112,
        56,0,672,673,5,90,0,0,673,675,3,112,56,0,674,672,1,0,0,0,675,678,
        1,0,0,0,676,674,1,0,0,0,676,677,1,0,0,0,677,111,1,0,0,0,678,676,
        1,0,0,0,679,684,3,114,57,0,680,681,5,89,0,0,681,683,3,114,57,0,682,
        680,1,0,0,0,683,686,1,0,0,0,684,682,1,0,0,0,684,685,1,0,0,0,685,
        113,1,0,0,0,686,684,1,0,0,0,687,692,3,116,58,0,688,689,7,8,0,0,689,
        691,3,116,58,0,690,688,1,0,0,0,691,694,1,0,0,0,692,690,1,0,0,0,692,
        693,1,0,0,0,693,115,1,0,0,0,694,692,1,0,0,0,695,700,3,118,59,0,696,
        697,7,9,0,0,697,699,3,118,59,0,698,696,1,0,0,0,699,702,1,0,0,0,700,
        698,1,0,0,0,700,701,1,0,0,0,701,117,1,0,0,0,702,700,1,0,0,0,703,
        708,3,120,60,0,704,705,5,93,0,0,705,707,3,120,60,0,706,704,1,0,0,
        0,707,710,1,0,0,0,708,706,1,0,0,0,708,709,1,0,0,0,709,119,1,0,0,
        0,710,708,1,0,0,0,711,716,3,122,61,0,712,713,5,94,0,0,713,715,3,
        122,61,0,714,712,1,0,0,0,715,718,1,0,0,0,716,714,1,0,0,0,716,717,
        1,0,0,0,717,121,1,0,0,0,718,716,1,0,0,0,719,724,3,124,62,0,720,721,
        5,92,0,0,721,723,3,124,62,0,722,720,1,0,0,0,723,726,1,0,0,0,724,
        722,1,0,0,0,724,725,1,0,0,0,725,123,1,0,0,0,726,724,1,0,0,0,727,
        732,3,126,63,0,728,729,7,10,0,0,729,731,3,126,63,0,730,728,1,0,0,
        0,731,734,1,0,0,0,732,730,1,0,0,0,732,733,1,0,0,0,733,125,1,0,0,
        0,734,732,1,0,0,0,735,740,3,128,64,0,736,737,7,11,0,0,737,739,3,
        128,64,0,738,736,1,0,0,0,739,742,1,0,0,0,740,738,1,0,0,0,740,741,
        1,0,0,0,741,127,1,0,0,0,742,740,1,0,0,0,743,748,3,130,65,0,744,745,
        7,12,0,0,745,747,3,130,65,0,746,744,1,0,0,0,747,750,1,0,0,0,748,
        746,1,0,0,0,748,749,1,0,0,0,749,129,1,0,0,0,750,748,1,0,0,0,751,
        752,5,91,0,0,752,759,3,130,65,0,753,754,5,85,0,0,754,759,3,130,65,
        0,755,756,5,95,0,0,756,759,3,130,65,0,757,759,3,132,66,0,758,751,
        1,0,0,0,758,753,1,0,0,0,758,755,1,0,0,0,758,757,1,0,0,0,759,131,
        1,0,0,0,760,764,3,136,68,0,761,763,3,134,67,0,762,761,1,0,0,0,763,
        766,1,0,0,0,764,762,1,0,0,0,764,765,1,0,0,0,765,772,1,0,0,0,766,
        764,1,0,0,0,767,768,3,162,81,0,768,769,5,106,0,0,769,770,5,115,0,
        0,770,772,1,0,0,0,771,760,1,0,0,0,771,767,1,0,0,0,772,133,1,0,0,
        0,773,774,5,106,0,0,774,789,5,115,0,0,775,776,5,102,0,0,776,779,
        3,106,53,0,777,778,5,105,0,0,778,780,3,106,53,0,779,777,1,0,0,0,
        779,780,1,0,0,0,780,781,1,0,0,0,781,782,5,103,0,0,782,789,1,0,0,
        0,783,785,5,98,0,0,784,786,3,152,76,0,785,784,1,0,0,0,785,786,1,
        0,0,0,786,787,1,0,0,0,787,789,5,99,0,0,788,773,1,0,0,0,788,775,1,
        0,0,0,788,783,1,0,0,0,789,135,1,0,0,0,790,803,3,138,69,0,791,803,
        3,140,70,0,792,803,3,142,71,0,793,803,3,148,74,0,794,803,5,14,0,
        0,795,803,5,15,0,0,796,803,5,115,0,0,797,803,3,178,89,0,798,799,
        5,98,0,0,799,800,3,106,53,0,800,801,5,99,0,0,801,803,1,0,0,0,802,
        790,1,0,0,0,802,791,1,0,0,0,802,792,1,0,0,0,802,793,1,0,0,0,802,
        794,1,0,0,0,802,795,1,0,0,0,802,796,1,0,0,0,802,797,1,0,0,0,802,
        798,1,0,0,0,803,137,1,0,0,0,804,805,5,37,0,0,805,808,5,98,0,0,806,
        809,3,154,77,0,807,809,3,106,53,0,808,806,1,0,0,0,808,807,1,0,0,
        0,809,810,1,0,0,0,810,811,5,99,0,0,811,139,1,0,0,0,812,814,5,98,
        0,0,813,815,3,52,26,0,814,813,1,0,0,0,814,815,1,0,0,0,815,816,1,
        0,0,0,816,817,3,154,77,0,817,818,5,99,0,0,818,819,3,130,65,0,819,
        141,1,0,0,0,820,821,5,100,0,0,821,822,3,144,72,0,822,823,5,101,0,
        0,823,143,1,0,0,0,824,829,3,146,73,0,825,826,5,105,0,0,826,828,3,
        146,73,0,827,825,1,0,0,0,828,831,1,0,0,0,829,827,1,0,0,0,829,830,
        1,0,0,0,830,833,1,0,0,0,831,829,1,0,0,0,832,834,5,105,0,0,833,832,
        1,0,0,0,833,834,1,0,0,0,834,145,1,0,0,0,835,836,5,115,0,0,836,837,
        5,108,0,0,837,838,3,106,53,0,838,147,1,0,0,0,839,840,5,102,0,0,840,
        845,3,150,75,0,841,842,5,105,0,0,842,844,3,150,75,0,843,841,1,0,
        0,0,844,847,1,0,0,0,845,843,1,0,0,0,845,846,1,0,0,0,846,849,1,0,
        0,0,847,845,1,0,0,0,848,850,5,105,0,0,849,848,1,0,0,0,849,850,1,
        0,0,0,850,851,1,0,0,0,851,852,5,103,0,0,852,859,1,0,0,0,853,854,
        5,102,0,0,854,855,3,106,53,0,855,856,5,86,0,0,856,857,5,103,0,0,
        857,859,1,0,0,0,858,839,1,0,0,0,858,853,1,0,0,0,859,149,1,0,0,0,
        860,864,3,106,53,0,861,864,3,142,71,0,862,864,3,148,74,0,863,860,
        1,0,0,0,863,861,1,0,0,0,863,862,1,0,0,0,864,151,1,0,0,0,865,870,
        3,106,53,0,866,867,5,105,0,0,867,869,3,106,53,0,868,866,1,0,0,0,
        869,872,1,0,0,0,870,868,1,0,0,0,870,871,1,0,0,0,871,153,1,0,0,0,
        872,870,1,0,0,0,873,883,3,162,81,0,874,883,3,172,86,0,875,883,3,
        156,78,0,876,883,3,158,79,0,877,883,3,160,80,0,878,883,3,166,83,
        0,879,883,3,164,82,0,880,883,3,174,87,0,881,883,5,22,0,0,882,873,
        1,0,0,0,882,874,1,0,0,0,882,875,1,0,0,0,882,876,1,0,0,0,882,877,
        1,0,0,0,882,878,1,0,0,0,882,879,1,0,0,0,882,880,1,0,0,0,882,881,
        1,0,0,0,883,155,1,0,0,0,884,885,5,14,0,0,885,886,5,106,0,0,886,887,
        5,115,0,0,887,157,1,0,0,0,888,889,5,15,0,0,889,890,5,106,0,0,890,
        891,5,115,0,0,891,159,1,0,0,0,892,895,5,115,0,0,893,894,5,106,0,
        0,894,896,5,115,0,0,895,893,1,0,0,0,896,897,1,0,0,0,897,895,1,0,
        0,0,897,898,1,0,0,0,898,161,1,0,0,0,899,900,7,13,0,0,900,163,1,0,
        0,0,901,902,5,115,0,0,902,165,1,0,0,0,903,904,5,115,0,0,904,905,
        5,80,0,0,905,906,3,168,84,0,906,907,5,81,0,0,907,167,1,0,0,0,908,
        913,3,170,85,0,909,910,5,105,0,0,910,912,3,170,85,0,911,909,1,0,
        0,0,912,915,1,0,0,0,913,911,1,0,0,0,913,914,1,0,0,0,914,169,1,0,
        0,0,915,913,1,0,0,0,916,921,3,166,83,0,917,921,3,162,81,0,918,921,
        5,115,0,0,919,921,5,112,0,0,920,916,1,0,0,0,920,917,1,0,0,0,920,
        918,1,0,0,0,920,919,1,0,0,0,921,171,1,0,0,0,922,923,5,36,0,0,923,
        924,5,80,0,0,924,925,5,112,0,0,925,928,5,81,0,0,926,928,5,36,0,0,
        927,922,1,0,0,0,927,926,1,0,0,0,928,173,1,0,0,0,929,931,3,162,81,
        0,930,932,3,176,88,0,931,930,1,0,0,0,932,933,1,0,0,0,933,931,1,0,
        0,0,933,934,1,0,0,0,934,966,1,0,0,0,935,937,3,164,82,0,936,938,3,
        176,88,0,937,936,1,0,0,0,938,939,1,0,0,0,939,937,1,0,0,0,939,940,
        1,0,0,0,940,966,1,0,0,0,941,943,3,172,86,0,942,944,3,176,88,0,943,
        942,1,0,0,0,944,945,1,0,0,0,945,943,1,0,0,0,945,946,1,0,0,0,946,
        966,1,0,0,0,947,949,3,156,78,0,948,950,3,176,88,0,949,948,1,0,0,
        0,950,951,1,0,0,0,951,949,1,0,0,0,951,952,1,0,0,0,952,966,1,0,0,
        0,953,955,3,160,80,0,954,956,3,176,88,0,955,954,1,0,0,0,956,957,
        1,0,0,0,957,955,1,0,0,0,957,958,1,0,0,0,958,966,1,0,0,0,959,961,
        3,158,79,0,960,962,3,176,88,0,961,960,1,0,0,0,962,963,1,0,0,0,963,
        961,1,0,0,0,963,964,1,0,0,0,964,966,1,0,0,0,965,929,1,0,0,0,965,
        935,1,0,0,0,965,941,1,0,0,0,965,947,1,0,0,0,965,953,1,0,0,0,965,
        959,1,0,0,0,966,175,1,0,0,0,967,969,5,102,0,0,968,970,3,106,53,0,
        969,968,1,0,0,0,969,970,1,0,0,0,970,971,1,0,0,0,971,972,5,103,0,
        0,972,177,1,0,0,0,973,974,7,14,0,0,974,179,1,0,0,0,108,182,184,190,
        200,215,223,229,233,237,241,245,249,252,264,276,286,292,299,312,
        316,323,333,337,347,350,356,366,370,373,380,395,400,403,406,409,
        412,419,424,435,442,449,466,484,493,500,503,511,515,527,546,550,
        554,564,567,570,573,576,583,588,600,612,615,625,635,639,643,648,
        654,669,676,684,692,700,708,716,724,732,740,748,758,764,771,779,
        785,788,802,808,814,829,833,845,849,858,863,870,882,897,913,920,
        927,933,939,945,951,957,963,965,969
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
