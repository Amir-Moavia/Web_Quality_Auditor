import { ESLint } from 'eslint';
import fs from 'fs/promises';
import path from 'path';

export async function analyzeCodeQuality(projectPath) {
  let isJsTs = false;
  
  async function detectJsTs(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        
        if (entry.name === 'package.json') {
          isJsTs = true;
          return;
        }
        
        if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
          isJsTs = true;
          return;
        }
        
        if (entry.isDirectory()) {
          await detectJsTs(path.join(dirPath, entry.name));
          if (isJsTs) return;
        }
      }
    } catch (err) {
      // ignore
    }
  }
  
  await detectJsTs(projectPath);
  
  if (!isJsTs) {
    return {
      status: 'unsupported',
      message: 'Not a recognized JavaScript/TypeScript project (no package.json or JS/TS files found).'
    };
  }

  const eslint = new ESLint({
    useEslintrc: false,
    overrideConfig: {
      env: { browser: true, node: true, es2021: true },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      plugins: ['@typescript-eslint'],
      rules: {
        'no-console': 'warn',
        'no-unused-vars': 'warn',
        'no-empty-function': 'warn'
      }
    }
  });

  const globPatterns = [
    `${projectPath}/**/*.js`, 
    `${projectPath}/**/*.jsx`,
    `${projectPath}/**/*.ts`,
    `${projectPath}/**/*.tsx`
  ];

  let results = [];
  try {
    results = await eslint.lintFiles(globPatterns);
  } catch (err) {
    if (err.message.includes('No files matching')) {
      results = [];
    } else {
      throw err;
    }
  }

  if (results.length === 0) {
    return {
      status: 'unsupported',
      message: 'No lintable JavaScript files found.'
    };
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  let linesOfCode = 0;
  const findings = [];

  for (const result of results) {
    totalErrors += result.errorCount;
    totalWarnings += result.warningCount;
    
    try {
      const content = await fs.readFile(result.filePath, 'utf-8');
      linesOfCode += content.split('\n').length;
    } catch (e) {
      // ignore
    }

    for (const msg of result.messages) {
      findings.push({
        rule: msg.ruleId || 'syntax-error',
        severity: msg.severity === 2 ? 'high' : 'medium',
        file: result.filePath.replace(projectPath + '/', ''),
        line: msg.line,
        message: msg.message
      });
    }
  }

  return {
    status: 'success',
    filesLinted: results.length,
    linesOfCode,
    totalErrors,
    totalWarnings,
    findings
  };
}
