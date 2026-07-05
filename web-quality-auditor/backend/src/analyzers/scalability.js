import fs from 'fs/promises';
import path from 'path';

export async function analyzeScalability(projectPath) {
  const findings = [];
  const modularDirs = ['components', 'services', 'hooks', 'utils'];
  let foundDirs = 0;
  
  async function checkModularStructure() {
    const srcPath = path.join(projectPath, 'src');
    try {
      const entries = await fs.readdir(srcPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && modularDirs.includes(entry.name)) {
          foundDirs++;
        }
      }
    } catch(e) {}
  }
  
  await checkModularStructure();
  
  if (foundDirs < 2) {
    findings.push({
      id: 'lacking-modular-structure',
      severity: 'medium',
      file: 'Project Structure',
      line: 0,
      message: 'Project lacks a clear modular folder structure (e.g. src/components, src/services).'
    });
  }

  let globalVarCount = 0;
  let hardcodedUrlCount = 0;

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
          if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
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
    
    const lines = content.split('\n');
    const relPath = filePath.replace(projectPath + '/', '');

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      if (/(?:window|global)\.[a-zA-Z0-9_]+\s*=/.test(line)) {
        globalVarCount++;
        findings.push({
          id: 'global-variable-assignment',
          severity: 'low',
          file: relPath,
          line: lineNum,
          message: 'Assignment to global/window object detected.'
        });
      }
      
      if (/http:\/\/localhost:\d+/.test(line)) {
        hardcodedUrlCount++;
        findings.push({
          id: 'hardcoded-localhost',
          severity: 'medium',
          file: relPath,
          line: lineNum,
          message: 'Hardcoded localhost URL detected.'
        });
      }
      
      if (/(?:const|let|var)\s+PORT\s*=\s*\d+/.test(line) || /app\.listen\(\s*\d+\s*[,\)]/.test(line)) {
        if (!/process\.env/.test(line)) {
          hardcodedUrlCount++;
          findings.push({
            id: 'hardcoded-port',
            severity: 'medium',
            file: relPath,
            line: lineNum,
            message: 'Hardcoded port detected without environment variable fallback.'
          });
        }
      }
    });
  }

  await scanDir(projectPath);

  return {
    status: 'success',
    note: 'Structural indicators only — not a load-tested measurement.',
    metrics: {
      globalVariableAssignments: globalVarCount,
      hardcodedUrlsOrPorts: hardcodedUrlCount,
      modularDirectoriesFound: foundDirs
    },
    totalFindings: findings.length,
    findings
  };
}
