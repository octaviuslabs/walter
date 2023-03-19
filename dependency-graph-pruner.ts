import * as ts from "typescript";
import DependencyGraphParser from "./dependency-graph-parser";
import Log from "./log";

export const getSourceForTargets = (
  dependencyGraph: DependencyGraphParser,
  targets: string[]
): string => {
  Log.info(`Getting source for target identifiers: ${targets.join(", ")}`);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const sourceFile = dependencyGraph.toSourceFile();
  let foundNodes: { name: string; node: ts.Node }[] = [];

  ts.forEachChild(sourceFile, (node) => {
    let name = "";

    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      name = node.name.text;
    } else if (ts.isVariableStatement(node)) {
      name = node.declarationList.declarations[0].name.getText(sourceFile);
    } else if (ts.isInterfaceDeclaration(node)) {
      name = node.name.text;
    }

    if (targets.includes(name)) {
      foundNodes.push({ name, node });
    }
  });

  const nodesList = foundNodes.map((found) => {
    const { node } = found;
    return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
  });

  return nodesList.join("\n");
};

export const extractRelevantIdentifiers = (source: ts.SourceFile): string[] => {
  const identifiers: string[] = [];
  //console.log("STATEMENTS", source.statements);
  const walker = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      identifiers.push(node.expression.getText(source));
    }
    ts.forEachChild(node, walker);
  };
  walker(source);
  return identifiers;
};

export const getDependenciesForSection = (
  dependencyGraph: DependencyGraphParser,
  section: string
): string => {
  const sectionSource = ts.createSourceFile(
    "section.ts",
    section,
    ts.ScriptTarget.ES2015,
    true
  );

  const targets: string[] = extractRelevantIdentifiers(sectionSource);

  return getSourceForTargets(dependencyGraph, targets);
};
