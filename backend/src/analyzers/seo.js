import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';

export async function analyzeSEO(projectPath) {
  const findings = [];
  
  let hasRobots = false;
  let hasSitemap = false;
  
  try {
    await fs.stat(path.join(projectPath, 'robots.txt'));
    hasRobots = true;
  } catch (e) {}
  
  try {
    await fs.stat(path.join(projectPath, 'sitemap.xml'));
    hasSitemap = true;
  } catch (e) {}
  
  if (!hasRobots) {
    findings.push({
      id: 'missing-robots-txt',
      severity: 'low',
      file: 'robots.txt',
      line: 0,
      message: 'No robots.txt found in project root.'
    });
  }
  
  if (!hasSitemap) {
    findings.push({
      id: 'missing-sitemap-xml',
      severity: 'low',
      file: 'sitemap.xml',
      line: 0,
      message: 'No sitemap.xml found in project root.'
    });
  }

  const htmlFilesToScan = [];
  
  async function findRootHtmlFiles() {
    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.html')) {
          htmlFilesToScan.push(path.join(projectPath, entry.name));
        } else if (entry.isDirectory() && (entry.name === 'public' || entry.name === 'src')) {
          try {
            const subEntries = await fs.readdir(path.join(projectPath, entry.name), { withFileTypes: true });
            for (const sub of subEntries) {
              if (sub.isFile() && sub.name.endsWith('.html')) {
                htmlFilesToScan.push(path.join(projectPath, entry.name, sub.name));
              }
            }
          } catch(e) {}
        }
      }
    } catch(e) {}
  }

  await findRootHtmlFiles();

  for (const filePath of htmlFilesToScan) {
    const relPath = filePath.replace(projectPath + '/', '');
    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      continue;
    }
    
    const $ = cheerio.load(content);
    
    const title = $('title').text().trim();
    if (!title) {
      findings.push({
        id: 'missing-title',
        severity: 'medium',
        file: relPath,
        line: 0,
        message: 'Missing or empty <title> tag.'
      });
    }
    
    const description = $('meta[name="description"]').attr('content');
    if (!description || description.trim() === '') {
      findings.push({
        id: 'missing-meta-description',
        severity: 'medium',
        file: relPath,
        line: 0,
        message: 'Missing or empty <meta name="description">.'
      });
    }
    
    const canonical = $('link[rel="canonical"]').attr('href');
    if (!canonical) {
      findings.push({
        id: 'missing-canonical',
        severity: 'low',
        file: relPath,
        line: 0,
        message: 'Missing <link rel="canonical">.'
      });
    }
  }

  return {
    status: 'success',
    totalFindings: findings.length,
    findings
  };
}
