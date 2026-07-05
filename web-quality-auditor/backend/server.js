import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { cloneAndValidateRepo } from './src/services/repoService.js';
import { analyzeCodeQuality } from './src/analyzers/codeQuality.js';
import { analyzeSecurity } from './src/analyzers/security.js';
import { analyzeAccessibility } from './src/analyzers/accessibility.js';
import { analyzeSEO } from './src/analyzers/seo.js';
import { analyzeMaintainability } from './src/analyzers/maintainability.js';
import { analyzeScalability } from './src/analyzers/scalability.js';
import { analyzePerformance } from './src/analyzers/performance.js';
import { aggregateScores } from './src/services/scoreAggregator.js';
import { generateSuggestions } from './src/services/aiSuggestions.js';
import fs from 'fs/promises';

const app = express();
const PORT = 4000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const analyzeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 100, // Increased for local testing (default: 5)
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many analysis requests from this IP, please try again after 10 minutes' }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const analysisCache = new Map();

app.post('/api/analyze', analyzeLimiter, async (req, res) => {
  const { repoUrl } = req.body;
  const withAI = req.query.withAI === 'true';

  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });
  if (!repoUrl.startsWith('https://github.com/')) {
    return res.status(400).json({ error: 'Invalid URL. Only https://github.com/ repositories are supported.' });
  }

  const cacheKey = repoUrl.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  let finalResponse = analysisCache.get(cacheKey);

  if (finalResponse) {
    console.log(`\n[CACHE] Using cached analysis for ${repoUrl}`);
    finalResponse = JSON.parse(JSON.stringify(finalResponse)); // Deep clone
  } else {
    const startTime = Date.now();
    console.log(`\n[START] Analysis requested for repository: ${repoUrl}`);

    let tempDir;

    const analysisPromise = (async () => {
      const result = await cloneAndValidateRepo(repoUrl);
      tempDir = result.tempDir;

      console.log(`[PROGRESS] Cloned ${repoUrl}. Running 7 analyzers...`);
      const [codeQuality, security, accessibility, seo, maintainability, scalability, performance] = await Promise.all([
        analyzeCodeQuality(tempDir), analyzeSecurity(tempDir), analyzeAccessibility(tempDir),
        analyzeSEO(tempDir), analyzeMaintainability(tempDir), analyzeScalability(tempDir), analyzePerformance(tempDir)
      ]);

      return { result, codeQuality, security, accessibility, seo, maintainability, scalability, performance };
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PIPELINE_TIMEOUT')), 60000)
    );

    try {
      const { result, codeQuality, security, accessibility, seo, maintainability, scalability, performance } = await Promise.race([analysisPromise, timeoutPromise]);
      const aggregated = aggregateScores({ codeQuality, security, accessibility, seo, maintainability, scalability, performance });

      finalResponse = {
        status: 'analyzed',
        repository: { path: tempDir, fileCount: result.fileCount, sizeInMB: result.sizeMB },
        ...aggregated
      };

      // Cache the result for 30 minutes
      analysisCache.set(cacheKey, JSON.parse(JSON.stringify(finalResponse)));
      setTimeout(() => analysisCache.delete(cacheKey), 30 * 60 * 1000);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[COMPLETED] Analysis for ${repoUrl} finished in ${duration}s`);
    } catch (error) {
      if (error.message === 'PIPELINE_TIMEOUT' || error.message === 'CLONE_TIMEOUT') {
        console.error(`[TIMEOUT] Analysis for ${repoUrl} timed out.`);
        return res.status(504).json({ error: 'Analysis operation timed out (exceeded 60 seconds limit).' });
      }
      console.error(`[ERROR] Analysis failed for ${repoUrl}:`, error.message);
      if (error.message.includes('not found') || error.message.includes('could not read')) {
        return res.status(404).json({ error: 'Repository not found or is private.' });
      }
      if (error.message.includes('exceeds limit')) {
        return res.status(413).json({ error: error.message });
      }
      return res.status(500).json({ error: `Internal server error: ${error.message}` });
    } finally {
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log(`[CLEANUP] Removed temp directory: ${tempDir}`);
        } catch (e) { }
      }
    }
  }

  // AI Step
  if (withAI && !finalResponse.aiSuggestions) {
    console.log(`[AI] Generating suggestions for ${repoUrl}...`);
    const aiSuggestions = await generateSuggestions(finalResponse);
    finalResponse.aiSuggestions = aiSuggestions;

    // Update cache
    analysisCache.set(cacheKey, JSON.parse(JSON.stringify(finalResponse)));
  }

  return res.json(finalResponse);
});

app.listen(PORT, () => {
  console.log(`[SERVER] Backend running on http://localhost:${PORT}`);
});
