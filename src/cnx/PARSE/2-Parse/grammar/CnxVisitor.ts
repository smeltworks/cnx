// Generated from grammar/Cnx.g4 by ANTLR 4.13.1

import { AbstractParseTreeVisitor } from "antlr4ng";


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
import { RegisterEntryContext } from "./CnxParser.js";
import { RegisterMemberContext } from "./CnxParser.js";
import { RegisterGroupContext } from "./CnxParser.js";
import { RegisterGroupMemberContext } from "./CnxParser.js";
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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `CnxParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class CnxVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `CnxParser.program`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitProgram?: (ctx: ProgramContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.includeDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIncludeDirective?: (ctx: IncludeDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.preprocessorDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPreprocessorDirective?: (ctx: PreprocessorDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.defineDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefineDirective?: (ctx: DefineDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.conditionalDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConditionalDirective?: (ctx: ConditionalDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.pragmaDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPragmaDirective?: (ctx: PragmaDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.declaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclaration?: (ctx: DeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.scopeDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitScopeDeclaration?: (ctx: ScopeDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.scopeMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitScopeMember?: (ctx: ScopeMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.visibilityModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVisibilityModifier?: (ctx: VisibilityModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.registerDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRegisterDeclaration?: (ctx: RegisterDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.registerEntry`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRegisterEntry?: (ctx: RegisterEntryContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.registerMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRegisterMember?: (ctx: RegisterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.registerGroup`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRegisterGroup?: (ctx: RegisterGroupContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.registerGroupMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRegisterGroupMember?: (ctx: RegisterGroupMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.memberName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemberName?: (ctx: MemberNameContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.accessModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAccessModifier?: (ctx: AccessModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.structDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructDeclaration?: (ctx: StructDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.structMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructMember?: (ctx: StructMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.enumDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumDeclaration?: (ctx: EnumDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.enumMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumMember?: (ctx: EnumMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.bitmapDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitmapDeclaration?: (ctx: BitmapDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.bitmapType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitmapType?: (ctx: BitmapTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.bitmapMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitmapMember?: (ctx: BitmapMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.functionDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionDeclaration?: (ctx: FunctionDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.parameterList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParameterList?: (ctx: ParameterListContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.parameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParameter?: (ctx: ParameterContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.constModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstModifier?: (ctx: ConstModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.mutModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMutModifier?: (ctx: MutModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.volatileModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVolatileModifier?: (ctx: VolatileModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.overflowModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOverflowModifier?: (ctx: OverflowModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.atomicModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAtomicModifier?: (ctx: AtomicModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.arrayDimension`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayDimension?: (ctx: ArrayDimensionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.variableDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVariableDeclaration?: (ctx: VariableDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.constructorArgumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstructorArgumentList?: (ctx: ConstructorArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.block`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBlock?: (ctx: BlockContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.statement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStatement?: (ctx: StatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.criticalStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCriticalStatement?: (ctx: CriticalStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.assignmentStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentStatement?: (ctx: AssignmentStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.assignmentOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentOperator?: (ctx: AssignmentOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.assignmentTarget`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentTarget?: (ctx: AssignmentTargetContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.postfixTargetOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixTargetOp?: (ctx: PostfixTargetOpContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.expressionStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpressionStatement?: (ctx: ExpressionStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.ifStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIfStatement?: (ctx: IfStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.whileStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWhileStatement?: (ctx: WhileStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.doWhileStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDoWhileStatement?: (ctx: DoWhileStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.forStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForStatement?: (ctx: ForStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.foreverStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForeverStatement?: (ctx: ForeverStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.forInit`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForInit?: (ctx: ForInitContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.forVarDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForVarDecl?: (ctx: ForVarDeclContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.forAssignment`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForAssignment?: (ctx: ForAssignmentContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.forUpdate`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForUpdate?: (ctx: ForUpdateContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.returnStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitReturnStatement?: (ctx: ReturnStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.switchStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSwitchStatement?: (ctx: SwitchStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.switchCase`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSwitchCase?: (ctx: SwitchCaseContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.caseLabel`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCaseLabel?: (ctx: CaseLabelContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.defaultCase`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefaultCase?: (ctx: DefaultCaseContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.expression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpression?: (ctx: ExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.ternaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTernaryExpression?: (ctx: TernaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.orExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOrExpression?: (ctx: OrExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.andExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAndExpression?: (ctx: AndExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.equalityExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEqualityExpression?: (ctx: EqualityExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.relationalExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRelationalExpression?: (ctx: RelationalExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.bitwiseOrExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.bitwiseXorExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.bitwiseAndExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.shiftExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitShiftExpression?: (ctx: ShiftExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.additiveExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAdditiveExpression?: (ctx: AdditiveExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.multiplicativeExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.unaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnaryExpression?: (ctx: UnaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.postfixExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixExpression?: (ctx: PostfixExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.postfixOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixOp?: (ctx: PostfixOpContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.primaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrimaryExpression?: (ctx: PrimaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.sizeofExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSizeofExpression?: (ctx: SizeofExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.castExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCastExpression?: (ctx: CastExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.structInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructInitializer?: (ctx: StructInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.fieldInitializerList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFieldInitializerList?: (ctx: FieldInitializerListContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.fieldInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFieldInitializer?: (ctx: FieldInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.arrayInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayInitializer?: (ctx: ArrayInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.arrayInitializerElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayInitializerElement?: (ctx: ArrayInitializerElementContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.argumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArgumentList?: (ctx: ArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.type`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitType?: (ctx: TypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.scopedType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitScopedType?: (ctx: ScopedTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.globalType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGlobalType?: (ctx: GlobalTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.qualifiedType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitQualifiedType?: (ctx: QualifiedTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.primitiveType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrimitiveType?: (ctx: PrimitiveTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.userType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUserType?: (ctx: UserTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.templateType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateType?: (ctx: TemplateTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.templateArgumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateArgumentList?: (ctx: TemplateArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.templateArgument`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateArgument?: (ctx: TemplateArgumentContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.stringType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStringType?: (ctx: StringTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.arrayType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayType?: (ctx: ArrayTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.arrayTypeDimension`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayTypeDimension?: (ctx: ArrayTypeDimensionContext) => Result;
    /**
     * Visit a parse tree produced by `CnxParser.literal`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteral?: (ctx: LiteralContext) => Result;
}

