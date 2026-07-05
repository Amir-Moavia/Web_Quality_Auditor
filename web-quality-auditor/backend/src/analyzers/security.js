import fs from 'fs/promises';
import path from 'path';

export async function analyzeSecurity(projectPath) {
  const findings = [];
  let hasHtmlFiles = false;
  let hasCspTag = false;
  
  const targetExts = new Set(['.js', '.jsx', '.ts', '.tsx', '.html']);

  async function scanDir(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (targetExts.has(ext)) {
          await scanFile(fullPath, ext);
        }
      }
    }
  }

  async function scanFile(filePath, ext) {
    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      return;
    }
    
    const lines = content.split('\n');
    const relPath = filePath.replace(projectPath + '/', '');

    if (ext === '.html') {
      hasHtmlFiles = true;
      if (/<meta\s+http-equiv\s*=\s*['"]Content-Security-Policy['"]/i.test(content)) {
        hasCspTag = true;
      }
    }

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // 1. innerHTML / dangerouslySetInnerHTML
      if (/(innerHTML\s*=|dangerouslySetInnerHTML)/.test(line)) {
        findings.push({
          id: 'unsafe-dom-manipulation',
          severity: 'medium',
          file: relPath,
          line: lineNum,
          message: 'Usage of innerHTML or dangerouslySetInnerHTML can lead to XSS vulnerabilities.'
        });
      }
      
      // 2. eval(
      if (/eval\s*\(/.test(line)) {
        findings.push({
          id: 'eval-usage',
          severity: 'high',
          file: relPath,
          line: lineNum,
          message: 'Usage of eval() is highly discouraged due to security and performance risks.'
        });
      }
      
      // 3. API Keys/Secrets
      if (/(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i.test(line)) {
        findings.push({
          id: 'hardcoded-secret',
          severity: 'high',
          file: relPath,
          line: lineNum,
          message: 'Possible hardcoded API key or secret.'
        });
      }
      
      // 4. Storage token
      if (/(?:local|session)Storage\.setItem\s*\(\s*['"]?[^'",]*(?:token|jwt|auth)[^'",]*['"]?\s*,/i.test(line)) {
        findings.push({
          id: 'insecure-storage',
          severity: 'medium',
          file: relPath,
          line: lineNum,
          message: 'Storing authentication tokens in localStorage/sessionStorage is prone to XSS attacks.'
        });
      }
      
      // 5. Password input without autocomplete
      if (/<input\b[^>]*type\s*=\s*['"]password['"][^>]*>/i.test(line)) {
        if (!/autocomplete\s*=\s*['"](?:off|new-password)['"]/i.test(line)) {
          findings.push({
            id: 'missing-password-autocomplete',
            severity: 'low',
            file: relPath,
            line: lineNum,
            message: 'Password input missing autocomplete="off" or "new-password".'
          });
        }
      }
      
      // 6. Hardcoded http:// URLs in fetch/XHR
      if (/(?:fetch|open|axios(?:\.[a-z]+)?|request)\s*\(\s*['"]?(?:[A-Z]+)?['"]?\s*,?\s*['"](http:\/\/(?!localhost|127\.0\.0\.1)[^'"]+)['"]/i.test(line)) {
        findings.push({
          id: 'insecure-http-request',
          severity: 'medium',
          file: relPath,
          line: lineNum,
          message: 'Hardcoded http:// URL used in request (not localhost). Prefer https://.'
        });
      }
    });
  }

  await scanDir(projectPath);

  // 7. CSP Tag
  if (hasHtmlFiles && !hasCspTag) {
    findings.push({
      id: 'missing-csp',
      severity: 'medium',
      file: 'Global',
      line: 0,
      message: 'No Content Security Policy detected in HTML files.'
    });
  }

  // 8. .env file check
  let gitignoreContent = '';
  try {
    gitignoreContent = await fs.readFile(path.join(projectPath, '.gitignore'), 'utf-8');
  } catch (e) {
    // ignore
  }
  
  const isEnvIgnored = gitignoreContent.split('\n').map(l => l.trim()).includes('.env');
  
  async function searchEnv(currentDir) {
    const dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of dirEntries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      
      if (entry.name === '.env' || entry.name === '.env.local' || entry.name === '.env.production') {
        const isThisEnvIgnored = gitignoreContent.split('\n').map(l => l.trim()).includes(entry.name);
        if (!isThisEnvIgnored && !isEnvIgnored) {
          findings.push({
            id: 'unignored-env-file',
            severity: 'high',
            file: path.join(currentDir, entry.name).replace(projectPath + '/', ''),
            line: 0,
            message: `${entry.name} file exists but is not included in .gitignore.`
          });
        }
      } else if (entry.isDirectory()) {
        await searchEnv(path.join(currentDir, entry.name));
      }
    }
  }
  
  await searchEnv(projectPath);

  return {
    status: 'success',
    totalFindings: findings.length,
    findings
  };
}
