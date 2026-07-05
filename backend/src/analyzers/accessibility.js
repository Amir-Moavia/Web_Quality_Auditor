import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';

export async function analyzeAccessibility(projectPath) {
  const findings = [];
  const targetExts = new Set(['.html', '.jsx', '.tsx']);

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
            await scanFile(fullPath, ext);
          }
        }
      }
    } catch (e) {}
  }

  async function scanFile(filePath, ext) {
    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      return;
    }
    
    const relPath = filePath.replace(projectPath + '/', '');
    const $ = cheerio.load(content, { xmlMode: ext !== '.html' });

    // 1. img without alt
    $('img').each((i, el) => {
      const alt = $(el).attr('alt');
      if (alt === undefined) {
        findings.push({
          id: 'missing-img-alt',
          severity: 'medium',
          file: relPath,
          line: 0,
          message: '<img> element missing alt attribute.'
        });
      }
    });

    // 2. form elements without label
    $('input, textarea, select').each((i, el) => {
      const $el = $(el);
      const type = $el.attr('type');
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') return;
      
      const ariaLabel = $el.attr('aria-label');
      const ariaLabelledBy = $el.attr('aria-labelledby');
      const id = $el.attr('id');
      
      let hasLabelWrapper = $el.closest('label').length > 0;
      let hasAssociatedLabel = false;
      
      if (id) {
        if ($(`label[for="${id}"], label[htmlFor="${id}"]`).length > 0) {
          hasAssociatedLabel = true;
        }
      }
      
      if (!ariaLabel && !ariaLabelledBy && !hasLabelWrapper && !hasAssociatedLabel) {
        findings.push({
          id: 'missing-form-label',
          severity: 'medium',
          file: relPath,
          line: 0,
          message: `<${el.tagName}> element missing an associated label or aria-label.`
        });
      }
    });

    // 3. Heading skips
    const headings = $('h1, h2, h3, h4, h5, h6').toArray();
    let prevLevel = null;
    headings.forEach((el) => {
      const currentLevel = parseInt(el.tagName.replace('h', ''));
      if (prevLevel !== null) {
        if (currentLevel - prevLevel > 1) {
          findings.push({
            id: 'heading-skipped',
            severity: 'low',
            file: relPath,
            line: 0,
            message: `Heading order skipped from h${prevLevel} to h${currentLevel}.`
          });
        }
      }
      prevLevel = currentLevel;
    });

    // 4. Missing html lang
    if (ext === '.html') {
      const htmlLang = $('html').attr('lang');
      if (!htmlLang) {
        findings.push({
          id: 'missing-html-lang',
          severity: 'low',
          file: relPath,
          line: 0,
          message: '<html> element missing lang attribute.'
        });
      }
    }
  }

  await scanDir(projectPath);

  return {
    status: 'success',
    totalFindings: findings.length,
    findings
  };
}
