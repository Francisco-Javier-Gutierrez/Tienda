import { Project, SyntaxKind } from 'ts-morph';

const project = new Project();
project.addSourceFilesAtPaths('src/modules/**/*.controller.ts');

const files = project.getSourceFiles();

let changedFiles = 0;

for (const file of files) {
  let changed = false;

  const tryStatements = file.getDescendantsOfKind(SyntaxKind.TryStatement);
  for (const tryStmt of tryStatements) {
    const catchClause = tryStmt.getCatchClause();
    if (catchClause) {
      const catchBlock = catchClause.getBlock();
      const catchStatements = catchBlock.getStatements();
      
      const hasErrorServidor = catchStatements.some(s => s.getText().includes('errorServidor'));
      const hasFsUnlink = catchStatements.some(s => s.getText().includes('fs.unlink'));
      
      if (hasErrorServidor && !hasFsUnlink) {
        // We can safely unwrap
        const tryBlock = tryStmt.getTryBlock();
        const tryStatementsText = tryBlock.getStatements().map(s => s.getText()).join('\n');
        tryStmt.replaceWithText(tryStatementsText);
        changed = true;
      } else if (hasErrorServidor && hasFsUnlink) {
          // Do nothing or handle separately
      }
    }
  }
  
  if (changed) {
    // Remove import of errorServidor
    const imports = file.getImportDeclarations();
    for (const imp of imports) {
      const namedImports = imp.getNamedImports();
      for (const named of namedImports) {
        if (named.getName() === 'errorServidor') {
          named.remove();
        }
      }
      if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
        imp.remove();
      }
    }
    
    file.saveSync();
    changedFiles++;
    console.log(`Refactored ${file.getBaseName()}`);
  }
}

console.log(`Total files refactored: ${changedFiles}`);
