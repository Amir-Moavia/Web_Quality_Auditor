import fs from 'fs/promises';
import path from 'path';
import escomplex from 'typhonjs-escomplex';
import { execFile } from 'child_process';
import util from 'util';

const execFilePromise = util.promisify(execFile);

export async function analyzeMaintainability(projectPath) {
  const findings = [];
  const targetExts = new Set(['.js', '.jsx']);
  
  async function scanDir(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (targetExts.has(ext)) {
            await scanFile(fullPath);
          }
        }
      }
    } catch(e) {}
  }

  async function scanFile(filePath) {
    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      return;
    }
    
    const relPath = filePath.replace(projectPath + '/', '');
    
    try {
      const analyzer = escomplex.analyzeModule || (escomplex.default && escomplex.default.analyzeModule);
      if (analyzer) {
        const report = analyzer(content);
        if (report && report.methods) {
          for (const method of report.methods) {
            const fnName = method.name || 'anonymous';
            const lines = method.sloc.physical;
            const cyclomatic = method.cyclomatic;
            
            if (lines > 50) {
              findings.push({
                id: 'function-too-long',
                severity: 'low',
                file: relPath,
                line: method.lineStart || 0,
                message: `Function ${fnName} is ${lines} lines long (limit: 50).`
              });
            }
            
            if (cyclomatic > 10) {
              findings.push({
                id: 'high-cyclomatic-complexity',
                severity: 'medium',
                file: relPath,
                line: method.lineStart || 0,
                message: `Function ${fnName} has cyclomatic complexity of ${cyclomatic} (limit: 10).`
              });
            }
          }
        }
      }
    } catch (err) {
      // ignore parser errors
    }

    let maxNesting = 0;
    let maxNestingLine = 0;
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const indentMatch = line.match(/^([ \t]+)/);
      if (indentMatch) {
        const spaces = indentMatch[1].replace(/\t/g, '    ').length;
        const depth = Math.floor(spaces / 4);
        if (depth > maxNesting) {
          maxNesting = depth;
          maxNestingLine = index + 1;
        }
      }
    });

    if (maxNesting > 4) {
      findings.push({
        id: 'deep-nesting',
        severity: 'medium',
        file: relPath,
        line: maxNestingLine,
        message: `Deep nesting detected (approx depth: ${maxNesting}, limit: 4).`
      });
    }
  }

  await scanDir(projectPath);

  let duplicationPercent = 0;
  const reportDir = path.join(projectPath, 'jscpd-report');
  
  try {
    const jscpdCmd = path.resolve(process.cwd(), 'node_modules/.bin/jscpd');
    await execFilePromise(jscpdCmd, [
      projectPath,
      '--silent',
      '--reporters', 'json',
      '--output', reportDir,
      '--ignore', '**/.git/**,**/node_modules/**'
    ]);
  } catch(e) {
    // Exec throws if clones are found (exit code 1)
  }

  try {
    const reportStr = await fs.readFile(path.join(reportDir, 'jscpd-report.json'), 'utf-8');
    const report = JSON.parse(reportStr);
    
    if (report && report.statistics) {
      duplicationPercent = report.statistics.total.percentage || 0;
      
      if (report.duplicates) {
        report.duplicates.forEach(clone => {
          if (clone.lines > 10) {
            findings.push({
              id: 'code-duplication',
              severity: 'medium',
              file: clone.firstFile.name.replace(projectPath + '/', ''),
              line: clone.firstFile.start,
              message: `Duplicated code block found (${clone.lines} lines).`
            });
          }
        });
      }
    }
  } catch(e) {}

  return {
    status: 'success',
    duplicationPercent,
    totalFindings: findings.length,
    findings
  };
}
