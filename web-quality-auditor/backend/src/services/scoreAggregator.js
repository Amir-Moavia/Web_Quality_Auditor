export function aggregateScores(analyzerResults) {
  const { codeQuality, security, accessibility, seo, maintainability, scalability, performance } = analyzerResults;
  
  const totalLinesOfCode = codeQuality?.linesOfCode || 1000;
  const normalizationFactor = Math.max(1, totalLinesOfCode / 1000);

  const categoriesConfig = {
    security: { weight: 0.15, data: security },
    codeQuality: { weight: 0.15, data: codeQuality },
    performance: { weight: 0.15, data: performance },
    scalability: { weight: 0.15, data: scalability },
    accessibility: { weight: 0.15, data: accessibility },
    maintainability: { weight: 0.15, data: maintainability },
    seo: { weight: 0.1, data: seo }
  };

  const issueSummary = { high: 0, medium: 0, low: 0 };
  const categories = {};
  let overallScore = 0;

  for (const [catName, config] of Object.entries(categoriesConfig)) {
    const findings = config.data?.findings || [];
    
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const finding of findings) {
      if (finding.severity === 'high') {
        high++;
        issueSummary.high++;
      } else if (finding.severity === 'medium') {
        medium++;
        issueSummary.medium++;
      } else if (finding.severity === 'low') {
        low++;
        issueSummary.low++;
      }
    }

    const penalty = ((high * 10) + (medium * 5) + (low * 1)) / normalizationFactor;
    let score = 100 - penalty;
    score = Math.max(0, Math.min(100, score)); // Clamp between 0 and 100
    
    score = Math.round(score * 100) / 100; // Round to 2 decimals

    categories[catName] = {
      score,
      ...config.data,
      findings
    };

    overallScore += score * config.weight;
  }

  overallScore = Math.round(overallScore * 100) / 100;

  return {
    overallScore,
    issueSummary,
    categories
  };
}
