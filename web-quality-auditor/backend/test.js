import { cloneAndValidateRepo } from './src/services/repoService.js';
import { analyzeCodeQuality } from './src/analyzers/codeQuality.js';
import { analyzeSecurity } from './src/analyzers/security.js';
import { analyzeAccessibility } from './src/analyzers/accessibility.js';
import { analyzeSEO } from './src/analyzers/seo.js';
import { analyzeMaintainability } from './src/analyzers/maintainability.js';
import { analyzeScalability } from './src/analyzers/scalability.js';
import { aggregateScores } from './src/services/scoreAggregator.js';
import fs from 'fs/promises';

async function run() {
  let tempDir;
  try {
    const repoUrl = 'https://github.com/OWASP/NodeGoat';
    const result = await cloneAndValidateRepo(repoUrl);
    tempDir = result.tempDir;
    
    const [codeQuality, security, accessibility, seo, maintainability, scalability] = await Promise.all([
      analyzeCodeQuality(tempDir),
      analyzeSecurity(tempDir),
      analyzeAccessibility(tempDir),
      analyzeSEO(tempDir),
      analyzeMaintainability(tempDir),
      analyzeScalability(tempDir)
    ]);
    
    const aggregated = aggregateScores({
      codeQuality,
      security,
      accessibility,
      seo,
      maintainability,
      scalability
    });
    
    console.log(JSON.stringify({
      status: 'analyzed',
      repository: {
        fileCount: result.fileCount,
        sizeInMB: result.sizeMB
      },
      ...aggregated
    }, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  }
}
run();
