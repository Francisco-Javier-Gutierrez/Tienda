import { Project, SyntaxKind } from 'ts-morph';

const project = new Project();
project.addSourceFilesAtPaths('src/modules/**/*.service.ts');

const files = project.getSourceFiles();

let changedFiles = 0;

for (const file of files) {
  let changed = false;

  const variableStatements = file.getDescendantsOfKind(SyntaxKind.VariableStatement);
  for (const stmt of variableStatements) {
    const text = stmt.getText();
    // find: const error: any = new Error('...');
    if (text.includes('const error: any = new Error(')) {
      const parentBlock = stmt.getParentIfKind(SyntaxKind.Block) || stmt.getParentIfKind(SyntaxKind.SourceFile);
      if (!parentBlock) continue;

      const statements = parentBlock.getStatements();
      const stmtIndex = statements.indexOf(stmt);
      if (stmtIndex === -1) continue;
      
      const nextStmt1 = statements[stmtIndex + 1];
      const nextStmt2 = statements[stmtIndex + 2];
      
      if (nextStmt1 && nextStmt2) {
        const next1Text = nextStmt1.getText();
        const next2Text = nextStmt2.getText();
        
        if (next1Text.includes('error.status =') && next2Text.includes('throw error')) {
          // Extract the error message and the status
          const matchError = text.match(/new Error\((.+)\);/);
          const matchStatus = next1Text.match(/error\.status = (\d+);/);
          
          if (matchError && matchStatus) {
            const message = matchError[1];
            const status = matchStatus[1];
            
            // replace the 3 statements with a single throw
            stmt.replaceWithText(`throw errorFuncional(${message}, ${status});`);
            nextStmt1.remove();
            nextStmt2.remove();
            changed = true;
          }
        }
      }
    }
  }

  if (changed) {
    // Ensure errorFuncional is imported
    const hasImport = file.getImportDeclarations().some(imp => 
      imp.getNamedImports().some(named => named.getName() === 'errorFuncional')
    );
    
    if (!hasImport) {
      // Find where formatters is imported, or add it
      const formattersImport = file.getImportDeclaration(imp => imp.getModuleSpecifierValue().includes('utils/formatters'));
      if (formattersImport) {
        formattersImport.addNamedImport('errorFuncional');
      } else {
        file.addImportDeclaration({
          namedImports: ['errorFuncional'],
          moduleSpecifier: '../../utils/formatters'
        });
      }
    }
    
    file.saveSync();
    changedFiles++;
    console.log(`Refactored ${file.getBaseName()}`);
  }
}

console.log(`Total services refactored: ${changedFiles}`);
