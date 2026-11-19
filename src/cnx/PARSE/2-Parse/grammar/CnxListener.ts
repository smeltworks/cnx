// Generated from grammar/Cnx.g4 by ANTLR 4.13.1

import { ErrorNode, ParseTreeListener, ParserRuleContext, TerminalNode } from "antlr4ng";


import { ProgramContext } from "./CnxParser.js";
import { IncludeDirectiveContext } from "./CnxParser.js";
import { PreprocessorDirectiveContext } from "./CnxParser.js";
import { DefineDirectiveContext } from "./CnxParser.js";
import { ConditionalDirectiveContext } from "./CnxParser.js";
import { PragmaDirectiveContext } from "./CnxParser.js";
import { DeclarationContext } from "./CnxParser.js";
import { ScopeDeclarationContext } from "./CnxParser.js";
import { ScopeMemberContext } from "./CnxParser.js";
import { VisibilityModifierContext } from "./CnxParser.js";
import { RegisterDeclarationContext } from "./CnxParser.js";
import { RegisterMemberContext } from "./CnxParser.js";
import { MemberNameContext } from "./CnxParser.js";
import { AccessModifierContext } from "./CnxParser.js";
import { StructDeclarationContext } from "./CnxParser.js";
import { StructMemberContext } from "./CnxParser.js";
import { EnumDeclarationContext } from "./CnxParser.js";
import { EnumMemberContext } from "./CnxParser.js";
import { BitmapDeclarationContext } from "./CnxParser.js";
import { BitmapTypeContext } from "./CnxParser.js";
import { BitmapMemberContext } from "./CnxParser.js";
import { FunctionDeclarationContext } from "./CnxParser.js";
import { ParameterListContext } from "./CnxParser.js";
import { ParameterContext } from "./CnxParser.js";
import { ConstModifierContext } from "./CnxParser.js";
import { MutModifierContext } from "./CnxParser.js";
import { VolatileModifierContext } from "./CnxParser.js";
import { OverflowModifierContext } from "./CnxParser.js";
import { AtomicModifierContext } from "./CnxParser.js";
import { ArrayDimensionContext } from "./CnxParser.js";
import { VariableDeclarationContext } from "./CnxParser.js";
import { ConstructorArgumentListContext } from "./CnxParser.js";
import { BlockContext } from "./CnxParser.js";
import { StatementContext } from "./CnxParser.js";
import { CriticalStatementContext } from "./CnxParser.js";
import { AssignmentStatementContext } from "./CnxParser.js";
import { AssignmentOperatorContext } from "./CnxParser.js";
import { AssignmentTargetContext } from "./CnxParser.js";
import { PostfixTargetOpContext } from "./CnxParser.js";
import { ExpressionStatementContext } from "./CnxParser.js";
import { IfStatementContext } from "./CnxParser.js";
import { WhileStatementContext } from "./CnxParser.js";
import { DoWhileStatementContext } from "./CnxParser.js";
import { ForStatementContext } from "./CnxParser.js";
import { ForeverStatementContext } from "./CnxParser.js";
import { ForInitContext } from "./CnxParser.js";
import { ForVarDeclContext } from "./CnxParser.js";
import { ForAssignmentContext } from "./CnxParser.js";
import { ForUpdateContext } from "./CnxParser.js";
import { ReturnStatementContext } from "./CnxParser.js";
import { SwitchStatementContext } from "./CnxParser.js";
import { SwitchCaseContext } from "./CnxParser.js";
import { CaseLabelContext } from "./CnxParser.js";
import { DefaultCaseContext } from "./CnxParser.js";
import { ExpressionContext } from "./CnxParser.js";
import { TernaryExpressionContext } from "./CnxParser.js";
import { OrExpressionContext } from "./CnxParser.js";
import { AndExpressionContext } from "./CnxParser.js";
import { EqualityExpressionContext } from "./CnxParser.js";
import { RelationalExpressionContext } from "./CnxParser.js";
import { BitwiseOrExpressionContext } from "./CnxParser.js";
import { BitwiseXorExpressionContext } from "./CnxParser.js";
import { BitwiseAndExpressionContext } from "./CnxParser.js";
import { ShiftExpressionContext } from "./CnxParser.js";
import { AdditiveExpressionContext } from "./CnxParser.js";
import { MultiplicativeExpressionContext } from "./CnxParser.js";
import { UnaryExpressionContext } from "./CnxParser.js";
import { PostfixExpressionContext } from "./CnxParser.js";
import { PostfixOpContext } from "./CnxParser.js";
import { PrimaryExpressionContext } from "./CnxParser.js";
import { SizeofExpressionContext } from "./CnxParser.js";
import { CastExpressionContext } from "./CnxParser.js";
import { StructInitializerContext } from "./CnxParser.js";
import { FieldInitializerListContext } from "./CnxParser.js";
import { FieldInitializerContext } from "./CnxParser.js";
import { ArrayInitializerContext } from "./CnxParser.js";
import { ArrayInitializerElementContext } from "./CnxParser.js";
import { ArgumentListContext } from "./CnxParser.js";
import { TypeContext } from "./CnxParser.js";
import { ScopedTypeContext } from "./CnxParser.js";
import { GlobalTypeContext } from "./CnxParser.js";
import { QualifiedTypeContext } from "./CnxParser.js";
import { PrimitiveTypeContext } from "./CnxParser.js";
import { UserTypeContext } from "./CnxParser.js";
import { TemplateTypeContext } from "./CnxParser.js";
import { TemplateArgumentListContext } from "./CnxParser.js";
import { TemplateArgumentContext } from "./CnxParser.js";
import { StringTypeContext } from "./CnxParser.js";
import { ArrayTypeContext } from "./CnxParser.js";
import { ArrayTypeDimensionContext } from "./CnxParser.js";
import { LiteralContext } from "./CnxParser.js";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `CnxParser`.
 */
export class CnxListener implements ParseTreeListener {
    /**
     * Enter a parse tree produced by `CnxParser.program`.
     * @param ctx the parse tree
     */
    enterProgram?: (ctx: ProgramContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.program`.
     * @param ctx the parse tree
     */
    exitProgram?: (ctx: ProgramContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.includeDirective`.
     * @param ctx the parse tree
     */
    enterIncludeDirective?: (ctx: IncludeDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.includeDirective`.
     * @param ctx the parse tree
     */
    exitIncludeDirective?: (ctx: IncludeDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.preprocessorDirective`.
     * @param ctx the parse tree
     */
    enterPreprocessorDirective?: (ctx: PreprocessorDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.preprocessorDirective`.
     * @param ctx the parse tree
     */
    exitPreprocessorDirective?: (ctx: PreprocessorDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.defineDirective`.
     * @param ctx the parse tree
     */
    enterDefineDirective?: (ctx: DefineDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.defineDirective`.
     * @param ctx the parse tree
     */
    exitDefineDirective?: (ctx: DefineDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.conditionalDirective`.
     * @param ctx the parse tree
     */
    enterConditionalDirective?: (ctx: ConditionalDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.conditionalDirective`.
     * @param ctx the parse tree
     */
    exitConditionalDirective?: (ctx: ConditionalDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.pragmaDirective`.
     * @param ctx the parse tree
     */
    enterPragmaDirective?: (ctx: PragmaDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.pragmaDirective`.
     * @param ctx the parse tree
     */
    exitPragmaDirective?: (ctx: PragmaDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.declaration`.
     * @param ctx the parse tree
     */
    enterDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.declaration`.
     * @param ctx the parse tree
     */
    exitDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.scopeDeclaration`.
     * @param ctx the parse tree
     */
    enterScopeDeclaration?: (ctx: ScopeDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.scopeDeclaration`.
     * @param ctx the parse tree
     */
    exitScopeDeclaration?: (ctx: ScopeDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.scopeMember`.
     * @param ctx the parse tree
     */
    enterScopeMember?: (ctx: ScopeMemberContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.scopeMember`.
     * @param ctx the parse tree
     */
    exitScopeMember?: (ctx: ScopeMemberContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.visibilityModifier`.
     * @param ctx the parse tree
     */
    enterVisibilityModifier?: (ctx: VisibilityModifierContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.visibilityModifier`.
     * @param ctx the parse tree
     */
    exitVisibilityModifier?: (ctx: VisibilityModifierContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.registerDeclaration`.
     * @param ctx the parse tree
     */
    enterRegisterDeclaration?: (ctx: RegisterDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.registerDeclaration`.
     * @param ctx the parse tree
     */
    exitRegisterDeclaration?: (ctx: RegisterDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.registerMember`.
     * @param ctx the parse tree
     */
    enterRegisterMember?: (ctx: RegisterMemberContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.registerMember`.
     * @param ctx the parse tree
     */
    exitRegisterMember?: (ctx: RegisterMemberContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.memberName`.
     * @param ctx the parse tree
     */
    enterMemberName?: (ctx: MemberNameContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.memberName`.
     * @param ctx the parse tree
     */
    exitMemberName?: (ctx: MemberNameContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.accessModifier`.
     * @param ctx the parse tree
     */
    enterAccessModifier?: (ctx: AccessModifierContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.accessModifier`.
     * @param ctx the parse tree
     */
    exitAccessModifier?: (ctx: AccessModifierContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.structDeclaration`.
     * @param ctx the parse tree
     */
    enterStructDeclaration?: (ctx: StructDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.structDeclaration`.
     * @param ctx the parse tree
     */
    exitStructDeclaration?: (ctx: StructDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.structMember`.
     * @param ctx the parse tree
     */
    enterStructMember?: (ctx: StructMemberContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.structMember`.
     * @param ctx the parse tree
     */
    exitStructMember?: (ctx: StructMemberContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.enumDeclaration`.
     * @param ctx the parse tree
     */
    enterEnumDeclaration?: (ctx: EnumDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.enumDeclaration`.
     * @param ctx the parse tree
     */
    exitEnumDeclaration?: (ctx: EnumDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.enumMember`.
     * @param ctx the parse tree
     */
    enterEnumMember?: (ctx: EnumMemberContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.enumMember`.
     * @param ctx the parse tree
     */
    exitEnumMember?: (ctx: EnumMemberContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.bitmapDeclaration`.
     * @param ctx the parse tree
     */
    enterBitmapDeclaration?: (ctx: BitmapDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.bitmapDeclaration`.
     * @param ctx the parse tree
     */
    exitBitmapDeclaration?: (ctx: BitmapDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.bitmapType`.
     * @param ctx the parse tree
     */
    enterBitmapType?: (ctx: BitmapTypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.bitmapType`.
     * @param ctx the parse tree
     */
    exitBitmapType?: (ctx: BitmapTypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.bitmapMember`.
     * @param ctx the parse tree
     */
    enterBitmapMember?: (ctx: BitmapMemberContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.bitmapMember`.
     * @param ctx the parse tree
     */
    exitBitmapMember?: (ctx: BitmapMemberContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.functionDeclaration`.
     * @param ctx the parse tree
     */
    enterFunctionDeclaration?: (ctx: FunctionDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.functionDeclaration`.
     * @param ctx the parse tree
     */
    exitFunctionDeclaration?: (ctx: FunctionDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.parameterList`.
     * @param ctx the parse tree
     */
    enterParameterList?: (ctx: ParameterListContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.parameterList`.
     * @param ctx the parse tree
     */
    exitParameterList?: (ctx: ParameterListContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.parameter`.
     * @param ctx the parse tree
     */
    enterParameter?: (ctx: ParameterContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.parameter`.
     * @param ctx the parse tree
     */
    exitParameter?: (ctx: ParameterContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.constModifier`.
     * @param ctx the parse tree
     */
    enterConstModifier?: (ctx: ConstModifierContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.constModifier`.
     * @param ctx the parse tree
     */
    exitConstModifier?: (ctx: ConstModifierContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.mutModifier`.
     * @param ctx the parse tree
     */
    enterMutModifier?: (ctx: MutModifierContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.mutModifier`.
     * @param ctx the parse tree
     */
    exitMutModifier?: (ctx: MutModifierContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.volatileModifier`.
     * @param ctx the parse tree
     */
    enterVolatileModifier?: (ctx: VolatileModifierContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.volatileModifier`.
     * @param ctx the parse tree
     */
    exitVolatileModifier?: (ctx: VolatileModifierContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.overflowModifier`.
     * @param ctx the parse tree
     */
    enterOverflowModifier?: (ctx: OverflowModifierContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.overflowModifier`.
     * @param ctx the parse tree
     */
    exitOverflowModifier?: (ctx: OverflowModifierContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.atomicModifier`.
     * @param ctx the parse tree
     */
    enterAtomicModifier?: (ctx: AtomicModifierContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.atomicModifier`.
     * @param ctx the parse tree
     */
    exitAtomicModifier?: (ctx: AtomicModifierContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.arrayDimension`.
     * @param ctx the parse tree
     */
    enterArrayDimension?: (ctx: ArrayDimensionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.arrayDimension`.
     * @param ctx the parse tree
     */
    exitArrayDimension?: (ctx: ArrayDimensionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.variableDeclaration`.
     * @param ctx the parse tree
     */
    enterVariableDeclaration?: (ctx: VariableDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.variableDeclaration`.
     * @param ctx the parse tree
     */
    exitVariableDeclaration?: (ctx: VariableDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.constructorArgumentList`.
     * @param ctx the parse tree
     */
    enterConstructorArgumentList?: (ctx: ConstructorArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.constructorArgumentList`.
     * @param ctx the parse tree
     */
    exitConstructorArgumentList?: (ctx: ConstructorArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.block`.
     * @param ctx the parse tree
     */
    enterBlock?: (ctx: BlockContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.block`.
     * @param ctx the parse tree
     */
    exitBlock?: (ctx: BlockContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.statement`.
     * @param ctx the parse tree
     */
    enterStatement?: (ctx: StatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.statement`.
     * @param ctx the parse tree
     */
    exitStatement?: (ctx: StatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.criticalStatement`.
     * @param ctx the parse tree
     */
    enterCriticalStatement?: (ctx: CriticalStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.criticalStatement`.
     * @param ctx the parse tree
     */
    exitCriticalStatement?: (ctx: CriticalStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.assignmentStatement`.
     * @param ctx the parse tree
     */
    enterAssignmentStatement?: (ctx: AssignmentStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.assignmentStatement`.
     * @param ctx the parse tree
     */
    exitAssignmentStatement?: (ctx: AssignmentStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.assignmentOperator`.
     * @param ctx the parse tree
     */
    enterAssignmentOperator?: (ctx: AssignmentOperatorContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.assignmentOperator`.
     * @param ctx the parse tree
     */
    exitAssignmentOperator?: (ctx: AssignmentOperatorContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.assignmentTarget`.
     * @param ctx the parse tree
     */
    enterAssignmentTarget?: (ctx: AssignmentTargetContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.assignmentTarget`.
     * @param ctx the parse tree
     */
    exitAssignmentTarget?: (ctx: AssignmentTargetContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.postfixTargetOp`.
     * @param ctx the parse tree
     */
    enterPostfixTargetOp?: (ctx: PostfixTargetOpContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.postfixTargetOp`.
     * @param ctx the parse tree
     */
    exitPostfixTargetOp?: (ctx: PostfixTargetOpContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.expressionStatement`.
     * @param ctx the parse tree
     */
    enterExpressionStatement?: (ctx: ExpressionStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.expressionStatement`.
     * @param ctx the parse tree
     */
    exitExpressionStatement?: (ctx: ExpressionStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.ifStatement`.
     * @param ctx the parse tree
     */
    enterIfStatement?: (ctx: IfStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.ifStatement`.
     * @param ctx the parse tree
     */
    exitIfStatement?: (ctx: IfStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.whileStatement`.
     * @param ctx the parse tree
     */
    enterWhileStatement?: (ctx: WhileStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.whileStatement`.
     * @param ctx the parse tree
     */
    exitWhileStatement?: (ctx: WhileStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.doWhileStatement`.
     * @param ctx the parse tree
     */
    enterDoWhileStatement?: (ctx: DoWhileStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.doWhileStatement`.
     * @param ctx the parse tree
     */
    exitDoWhileStatement?: (ctx: DoWhileStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.forStatement`.
     * @param ctx the parse tree
     */
    enterForStatement?: (ctx: ForStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.forStatement`.
     * @param ctx the parse tree
     */
    exitForStatement?: (ctx: ForStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.foreverStatement`.
     * @param ctx the parse tree
     */
    enterForeverStatement?: (ctx: ForeverStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.foreverStatement`.
     * @param ctx the parse tree
     */
    exitForeverStatement?: (ctx: ForeverStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.forInit`.
     * @param ctx the parse tree
     */
    enterForInit?: (ctx: ForInitContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.forInit`.
     * @param ctx the parse tree
     */
    exitForInit?: (ctx: ForInitContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.forVarDecl`.
     * @param ctx the parse tree
     */
    enterForVarDecl?: (ctx: ForVarDeclContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.forVarDecl`.
     * @param ctx the parse tree
     */
    exitForVarDecl?: (ctx: ForVarDeclContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.forAssignment`.
     * @param ctx the parse tree
     */
    enterForAssignment?: (ctx: ForAssignmentContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.forAssignment`.
     * @param ctx the parse tree
     */
    exitForAssignment?: (ctx: ForAssignmentContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.forUpdate`.
     * @param ctx the parse tree
     */
    enterForUpdate?: (ctx: ForUpdateContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.forUpdate`.
     * @param ctx the parse tree
     */
    exitForUpdate?: (ctx: ForUpdateContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.returnStatement`.
     * @param ctx the parse tree
     */
    enterReturnStatement?: (ctx: ReturnStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.returnStatement`.
     * @param ctx the parse tree
     */
    exitReturnStatement?: (ctx: ReturnStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.switchStatement`.
     * @param ctx the parse tree
     */
    enterSwitchStatement?: (ctx: SwitchStatementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.switchStatement`.
     * @param ctx the parse tree
     */
    exitSwitchStatement?: (ctx: SwitchStatementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.switchCase`.
     * @param ctx the parse tree
     */
    enterSwitchCase?: (ctx: SwitchCaseContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.switchCase`.
     * @param ctx the parse tree
     */
    exitSwitchCase?: (ctx: SwitchCaseContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.caseLabel`.
     * @param ctx the parse tree
     */
    enterCaseLabel?: (ctx: CaseLabelContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.caseLabel`.
     * @param ctx the parse tree
     */
    exitCaseLabel?: (ctx: CaseLabelContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.defaultCase`.
     * @param ctx the parse tree
     */
    enterDefaultCase?: (ctx: DefaultCaseContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.defaultCase`.
     * @param ctx the parse tree
     */
    exitDefaultCase?: (ctx: DefaultCaseContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.expression`.
     * @param ctx the parse tree
     */
    enterExpression?: (ctx: ExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.expression`.
     * @param ctx the parse tree
     */
    exitExpression?: (ctx: ExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.ternaryExpression`.
     * @param ctx the parse tree
     */
    enterTernaryExpression?: (ctx: TernaryExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.ternaryExpression`.
     * @param ctx the parse tree
     */
    exitTernaryExpression?: (ctx: TernaryExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.orExpression`.
     * @param ctx the parse tree
     */
    enterOrExpression?: (ctx: OrExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.orExpression`.
     * @param ctx the parse tree
     */
    exitOrExpression?: (ctx: OrExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.andExpression`.
     * @param ctx the parse tree
     */
    enterAndExpression?: (ctx: AndExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.andExpression`.
     * @param ctx the parse tree
     */
    exitAndExpression?: (ctx: AndExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.equalityExpression`.
     * @param ctx the parse tree
     */
    enterEqualityExpression?: (ctx: EqualityExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.equalityExpression`.
     * @param ctx the parse tree
     */
    exitEqualityExpression?: (ctx: EqualityExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.relationalExpression`.
     * @param ctx the parse tree
     */
    enterRelationalExpression?: (ctx: RelationalExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.relationalExpression`.
     * @param ctx the parse tree
     */
    exitRelationalExpression?: (ctx: RelationalExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.bitwiseOrExpression`.
     * @param ctx the parse tree
     */
    enterBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.bitwiseOrExpression`.
     * @param ctx the parse tree
     */
    exitBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.bitwiseXorExpression`.
     * @param ctx the parse tree
     */
    enterBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.bitwiseXorExpression`.
     * @param ctx the parse tree
     */
    exitBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.bitwiseAndExpression`.
     * @param ctx the parse tree
     */
    enterBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.bitwiseAndExpression`.
     * @param ctx the parse tree
     */
    exitBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.shiftExpression`.
     * @param ctx the parse tree
     */
    enterShiftExpression?: (ctx: ShiftExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.shiftExpression`.
     * @param ctx the parse tree
     */
    exitShiftExpression?: (ctx: ShiftExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.additiveExpression`.
     * @param ctx the parse tree
     */
    enterAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.additiveExpression`.
     * @param ctx the parse tree
     */
    exitAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.multiplicativeExpression`.
     * @param ctx the parse tree
     */
    enterMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.multiplicativeExpression`.
     * @param ctx the parse tree
     */
    exitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.unaryExpression`.
     * @param ctx the parse tree
     */
    enterUnaryExpression?: (ctx: UnaryExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.unaryExpression`.
     * @param ctx the parse tree
     */
    exitUnaryExpression?: (ctx: UnaryExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.postfixExpression`.
     * @param ctx the parse tree
     */
    enterPostfixExpression?: (ctx: PostfixExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.postfixExpression`.
     * @param ctx the parse tree
     */
    exitPostfixExpression?: (ctx: PostfixExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.postfixOp`.
     * @param ctx the parse tree
     */
    enterPostfixOp?: (ctx: PostfixOpContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.postfixOp`.
     * @param ctx the parse tree
     */
    exitPostfixOp?: (ctx: PostfixOpContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.primaryExpression`.
     * @param ctx the parse tree
     */
    enterPrimaryExpression?: (ctx: PrimaryExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.primaryExpression`.
     * @param ctx the parse tree
     */
    exitPrimaryExpression?: (ctx: PrimaryExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.sizeofExpression`.
     * @param ctx the parse tree
     */
    enterSizeofExpression?: (ctx: SizeofExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.sizeofExpression`.
     * @param ctx the parse tree
     */
    exitSizeofExpression?: (ctx: SizeofExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.castExpression`.
     * @param ctx the parse tree
     */
    enterCastExpression?: (ctx: CastExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.castExpression`.
     * @param ctx the parse tree
     */
    exitCastExpression?: (ctx: CastExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.structInitializer`.
     * @param ctx the parse tree
     */
    enterStructInitializer?: (ctx: StructInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.structInitializer`.
     * @param ctx the parse tree
     */
    exitStructInitializer?: (ctx: StructInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.fieldInitializerList`.
     * @param ctx the parse tree
     */
    enterFieldInitializerList?: (ctx: FieldInitializerListContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.fieldInitializerList`.
     * @param ctx the parse tree
     */
    exitFieldInitializerList?: (ctx: FieldInitializerListContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.fieldInitializer`.
     * @param ctx the parse tree
     */
    enterFieldInitializer?: (ctx: FieldInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.fieldInitializer`.
     * @param ctx the parse tree
     */
    exitFieldInitializer?: (ctx: FieldInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.arrayInitializer`.
     * @param ctx the parse tree
     */
    enterArrayInitializer?: (ctx: ArrayInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.arrayInitializer`.
     * @param ctx the parse tree
     */
    exitArrayInitializer?: (ctx: ArrayInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.arrayInitializerElement`.
     * @param ctx the parse tree
     */
    enterArrayInitializerElement?: (ctx: ArrayInitializerElementContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.arrayInitializerElement`.
     * @param ctx the parse tree
     */
    exitArrayInitializerElement?: (ctx: ArrayInitializerElementContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.argumentList`.
     * @param ctx the parse tree
     */
    enterArgumentList?: (ctx: ArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.argumentList`.
     * @param ctx the parse tree
     */
    exitArgumentList?: (ctx: ArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.type`.
     * @param ctx the parse tree
     */
    enterType?: (ctx: TypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.type`.
     * @param ctx the parse tree
     */
    exitType?: (ctx: TypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.scopedType`.
     * @param ctx the parse tree
     */
    enterScopedType?: (ctx: ScopedTypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.scopedType`.
     * @param ctx the parse tree
     */
    exitScopedType?: (ctx: ScopedTypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.globalType`.
     * @param ctx the parse tree
     */
    enterGlobalType?: (ctx: GlobalTypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.globalType`.
     * @param ctx the parse tree
     */
    exitGlobalType?: (ctx: GlobalTypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.qualifiedType`.
     * @param ctx the parse tree
     */
    enterQualifiedType?: (ctx: QualifiedTypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.qualifiedType`.
     * @param ctx the parse tree
     */
    exitQualifiedType?: (ctx: QualifiedTypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.primitiveType`.
     * @param ctx the parse tree
     */
    enterPrimitiveType?: (ctx: PrimitiveTypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.primitiveType`.
     * @param ctx the parse tree
     */
    exitPrimitiveType?: (ctx: PrimitiveTypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.userType`.
     * @param ctx the parse tree
     */
    enterUserType?: (ctx: UserTypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.userType`.
     * @param ctx the parse tree
     */
    exitUserType?: (ctx: UserTypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.templateType`.
     * @param ctx the parse tree
     */
    enterTemplateType?: (ctx: TemplateTypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.templateType`.
     * @param ctx the parse tree
     */
    exitTemplateType?: (ctx: TemplateTypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.templateArgumentList`.
     * @param ctx the parse tree
     */
    enterTemplateArgumentList?: (ctx: TemplateArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.templateArgumentList`.
     * @param ctx the parse tree
     */
    exitTemplateArgumentList?: (ctx: TemplateArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.templateArgument`.
     * @param ctx the parse tree
     */
    enterTemplateArgument?: (ctx: TemplateArgumentContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.templateArgument`.
     * @param ctx the parse tree
     */
    exitTemplateArgument?: (ctx: TemplateArgumentContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.stringType`.
     * @param ctx the parse tree
     */
    enterStringType?: (ctx: StringTypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.stringType`.
     * @param ctx the parse tree
     */
    exitStringType?: (ctx: StringTypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.arrayType`.
     * @param ctx the parse tree
     */
    enterArrayType?: (ctx: ArrayTypeContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.arrayType`.
     * @param ctx the parse tree
     */
    exitArrayType?: (ctx: ArrayTypeContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.arrayTypeDimension`.
     * @param ctx the parse tree
     */
    enterArrayTypeDimension?: (ctx: ArrayTypeDimensionContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.arrayTypeDimension`.
     * @param ctx the parse tree
     */
    exitArrayTypeDimension?: (ctx: ArrayTypeDimensionContext) => void;
    /**
     * Enter a parse tree produced by `CnxParser.literal`.
     * @param ctx the parse tree
     */
    enterLiteral?: (ctx: LiteralContext) => void;
    /**
     * Exit a parse tree produced by `CnxParser.literal`.
     * @param ctx the parse tree
     */
    exitLiteral?: (ctx: LiteralContext) => void;

    visitTerminal(node: TerminalNode): void {}
    visitErrorNode(node: ErrorNode): void {}
    enterEveryRule(node: ParserRuleContext): void {}
    exitEveryRule(node: ParserRuleContext): void {}
}

