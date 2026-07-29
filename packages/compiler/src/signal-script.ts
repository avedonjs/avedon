import ts from 'typescript'

const SIGNAL_API = new Set(['get', 'set', 'update', 'subscribe'])

/** Callees that take a Signal and must not receive an auto-unwrapped value. */
const SIGNAL_ARG_CALLEES = new Set(['readonly'])

/** Factories whose result is treated like a signal binding for auto-unwrap. */
const SIGNAL_FACTORY = new Set(['signal', 'readonly'])

const COMPOUND_TO_BIN: Partial<Record<ts.SyntaxKind, ts.BinaryOperator>> = {
  [ts.SyntaxKind.PlusEqualsToken]: ts.SyntaxKind.PlusToken,
  [ts.SyntaxKind.MinusEqualsToken]: ts.SyntaxKind.MinusToken,
  [ts.SyntaxKind.AsteriskEqualsToken]: ts.SyntaxKind.AsteriskToken,
  [ts.SyntaxKind.SlashEqualsToken]: ts.SyntaxKind.SlashToken,
  [ts.SyntaxKind.PercentEqualsToken]: ts.SyntaxKind.PercentToken,
  [ts.SyntaxKind.AsteriskAsteriskEqualsToken]: ts.SyntaxKind.AsteriskAsteriskToken,
  [ts.SyntaxKind.AmpersandEqualsToken]: ts.SyntaxKind.AmpersandToken,
  [ts.SyntaxKind.BarEqualsToken]: ts.SyntaxKind.BarToken,
  [ts.SyntaxKind.CaretEqualsToken]: ts.SyntaxKind.CaretToken,
  [ts.SyntaxKind.LessThanLessThanEqualsToken]: ts.SyntaxKind.LessThanLessThanToken,
  [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: ts.SyntaxKind.GreaterThanGreaterThanToken,
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]:
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
  [ts.SyntaxKind.BarBarEqualsToken]: ts.SyntaxKind.BarBarToken,
  [ts.SyntaxKind.AmpersandAmpersandEqualsToken]: ts.SyntaxKind.AmpersandAmpersandToken,
  [ts.SyntaxKind.QuestionQuestionEqualsToken]: ts.SyntaxKind.QuestionQuestionToken,
}

/**
 * Collect top-level `const|let|var name = signal(...)` bindings via the TS AST
 * (ignores strings/comments and nested scopes).
 */
export function collectSignalNames(source: string): Set<string> {
  const names = new Set<string>()
  if (!source.trim()) return names
  const sf = ts.createSourceFile('script.ts', source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
      if (isSignalCall(decl.initializer)) names.add(decl.name.text)
    }
  }
  return names
}

function isSignalCall(node: ts.Expression): boolean {
  if (!ts.isCallExpression(node)) return false
  const expr = node.expression
  if (ts.isIdentifier(expr)) return SIGNAL_FACTORY.has(expr.text)
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    return SIGNAL_FACTORY.has(expr.name.text)
  }
  return false
}

/**
 * Rewrite signal reads (`active` → `active.get()`) and writes (`active = x` → `active.set(x)`)
 * inside a JS/TS expression or script snippet.
 */
export function prepareSignalExpr(source: string, signalNames?: Set<string>): string {
  const names = signalNames ?? collectSignalNames(source)
  if (names.size === 0 || !source.trim()) return source

  const wrapAsExpr = shouldWrapAsExpr(source)
  const parseSource = wrapAsExpr ? `(${source})` : source

  const sourceFile = ts.createSourceFile(
    'script.ts',
    parseSource,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  )

  const factory = ts.factory

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left) && names.has(node.left.text)) {
        const op = node.operatorToken.kind
        if (op === ts.SyntaxKind.EqualsToken) {
          return factory.createCallExpression(
            factory.createPropertyAccessExpression(factory.createIdentifier(node.left.text), 'set'),
            undefined,
            [ts.visitNode(node.right, visit) as ts.Expression],
          )
        }
        const binOp = COMPOUND_TO_BIN[op]
        if (binOp != null) {
          const read = factory.createCallExpression(
            factory.createPropertyAccessExpression(factory.createIdentifier(node.left.text), 'get'),
            undefined,
            [],
          )
          const rhs = factory.createBinaryExpression(
            read,
            binOp,
            ts.visitNode(node.right, visit) as ts.Expression,
          )
          return factory.createCallExpression(
            factory.createPropertyAccessExpression(factory.createIdentifier(node.left.text), 'set'),
            undefined,
            [rhs],
          )
        }
      }

      if (
        ts.isPrefixUnaryExpression(node) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken) &&
        ts.isIdentifier(node.operand) &&
        names.has(node.operand.text)
      ) {
        const delta =
          node.operator === ts.SyntaxKind.PlusPlusToken
            ? factory.createNumericLiteral(1)
            : factory.createPrefixUnaryExpression(
                ts.SyntaxKind.MinusToken,
                factory.createNumericLiteral(1),
              )
        return factory.createCallExpression(
          factory.createPropertyAccessExpression(factory.createIdentifier(node.operand.text), 'update'),
          undefined,
          [
            factory.createArrowFunction(
              undefined,
              undefined,
              [factory.createParameterDeclaration(undefined, undefined, 'v')],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              factory.createBinaryExpression(
                factory.createIdentifier('v'),
                ts.SyntaxKind.PlusToken,
                delta,
              ),
            ),
          ],
        )
      }

      if (
        ts.isPostfixUnaryExpression(node) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken) &&
        ts.isIdentifier(node.operand) &&
        names.has(node.operand.text)
      ) {
        const delta =
          node.operator === ts.SyntaxKind.PlusPlusToken
            ? factory.createNumericLiteral(1)
            : factory.createPrefixUnaryExpression(
                ts.SyntaxKind.MinusToken,
                factory.createNumericLiteral(1),
              )
        // Postfix: update then the expression value is the previous — approximate with update.
        return factory.createCallExpression(
          factory.createPropertyAccessExpression(factory.createIdentifier(node.operand.text), 'update'),
          undefined,
          [
            factory.createArrowFunction(
              undefined,
              undefined,
              [factory.createParameterDeclaration(undefined, undefined, 'v')],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              factory.createBinaryExpression(
                factory.createIdentifier('v'),
                ts.SyntaxKind.PlusToken,
                delta,
              ),
            ),
          ],
        )
      }

      if (ts.isIdentifier(node) && shouldUnwrapSignalRead(node, names)) {
        return factory.createCallExpression(
          factory.createPropertyAccessExpression(factory.createIdentifier(node.text), 'get'),
          undefined,
          [],
        )
      }

      return ts.visitEachChild(node, visit, context)
    }
    return (sf) => ts.visitNode(sf, visit) as ts.SourceFile
  }

  const result = ts.transform(sourceFile, [transformer])
  const printer = ts.createPrinter({ removeComments: false, newLine: ts.NewLineKind.LineFeed })
  let out = printer.printFile(result.transformed[0] as ts.SourceFile)
  result.dispose()
  if (wrapAsExpr) {
    out = out.replace(/^\(/, '').replace(/\)\s*;?\s*$/, '')
  }
  return out.trim()
}

function shouldWrapAsExpr(source: string): boolean {
  const trimmed = source.trim()
  if (/^\s*(?:import|export)\b/.test(trimmed)) return false
  if (trimmed.includes('\n')) return false
  if (/^\s*(?:const|let|var|function|class)\b/.test(trimmed)) return false
  return true
}

function shouldUnwrapSignalRead(node: ts.Identifier, names: Set<string>): boolean {
  if (!names.has(node.text)) return false
  const parent = node.parent
  if (!parent) return true

  if (ts.isBinaryExpression(parent) && parent.left === node) {
    const op = parent.operatorToken.kind
    if (op === ts.SyntaxKind.EqualsToken || COMPOUND_TO_BIN[op] != null) return false
  }

  if (
    (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
    parent.operand === node &&
    (parent.operator === ts.SyntaxKind.PlusPlusToken ||
      parent.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    return false
  }

  if (ts.isVariableDeclaration(parent) && parent.name === node) return false
  if (ts.isParameter(parent) && parent.name === node) return false
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return false
  if (ts.isFunctionExpression(parent) && parent.name === node) return false
  if (ts.isMethodDeclaration(parent) && parent.name === node) return false
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return false
  if (ts.isClassDeclaration(parent) && parent.name === node) return false
  if (ts.isBindingElement(parent) && parent.name === node) return false
  if (ts.isImportSpecifier(parent) && parent.name === node) return false
  if (ts.isImportClause(parent) && parent.name === node) return false
  if (ts.isNamespaceImport(parent) && parent.name === node) return false
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return false

  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
    if (SIGNAL_API.has(parent.name.text)) return false
  }
  if (ts.isCallExpression(parent)) {
    const argIndex = parent.arguments.indexOf(node as ts.Expression)
    if (argIndex >= 0) {
      const callee = parent.expression
      if (ts.isIdentifier(callee) && SIGNAL_ARG_CALLEES.has(callee.text)) return false
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.name) &&
        SIGNAL_ARG_CALLEES.has(callee.name.text)
      ) {
        return false
      }
    }
  }
  if (ts.isMetaProperty(parent)) return false

  return true
}
