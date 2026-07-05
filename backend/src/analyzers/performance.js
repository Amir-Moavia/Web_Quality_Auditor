import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';

export async function analyzePerformance(projectPath) {
  const findings = [];
  let filesScanned = 0;

  async function walk(dirPath) {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = fullPath.replace(projectPath + '/', '');

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        filesScanned++;
        const ext = path.extname(entry.name).toLowerCase();
        
        try {
          const stats = await fs.stat(fullPath);
          const sizeKB = stats.size / 1024;
          
          // Size checks
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            if (sizeKB > 500) {
              findings.push({
                rule: 'large-image',
                severity: sizeKB > 1000 ? 'high' : 'medium',
                file: relativePath,
                message: `Image is very large (${Math.round(sizeKB)}KB). Consider compressing it to improve load times.`
              });
            }
          }

          if (['.js', '.css'].includes(ext)) {
            if (sizeKB > 1000) {
              findings.push({
                rule: 'large-asset',
                severity: 'medium',
                file: relativePath,
                message: `Asset is large (${Math.round(sizeKB)}KB). Consider code splitting or minifying to reduce payload size.`
              });
            }
          }

          // HTML Lazy Loading checks
          if (ext === '.html') {
            const content = await fs.readFile(fullPath, 'utf-8');
            const $ = cheerio.load(content);
            
            $('img').each((i, el) => {
              const src = $(el).attr('src') || 'unknown';
              const loading = $(el).attr('loading');
              
              if (loading !== 'lazy') {
                findings.push({
                  rule: 'missing-lazy-load',
                  severity: 'low',
                  file: relativePath,
                  message: `Image (${src}) is missing loading="lazy" attribute. Add this for offscreen images to save bandwidth.`
                });
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  await walk(projectPath);

  return {
    status: 'success',
    filesScanned,
    findings
  };
}
