import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize with environment variable
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateSuggestions(aggregatedResults) {
  if (!API_KEY) {
    return [
      { 
        title: "AI API Key Missing", 
        explanation: "The backend must be started with an API key to generate AI insights.", 
        category: "Configuration" 
      }
    ];
  }

  const findingsSummary = {
    issueSummary: aggregatedResults.issueSummary,
    categories: {}
  };
  
  for (const [catName, catData] of Object.entries(aggregatedResults.categories || {})) {
    findingsSummary.categories[catName] = {
      score: catData.score,
      findings: catData.findings
    };
  }

  const prompt = `You are a senior developer. Review these code quality, security, and accessibility findings from a repository analysis.
  
Identify the top 5 most critical issues to fix, prioritizing security, structural flaws, and high-impact maintainability issues.
Return EXACTLY a JSON array of objects. Do not include any markdown formatting like \`\`\`json, no preamble. Just the raw array.

Format:
[
  { "title": "Short descriptive title", "explanation": "Clear explanation of why it matters and how to fix it in plain English", "category": "Security | Accessibility | Code Quality | Maintainability | Scalability | SEO" }
]

Findings data:
${JSON.stringify(findingsSummary)}
`;

  try {
    // Using the available gemini-2.5-flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    
    let text = result.response.text().trim();
    
    // Safely extract the JSON array in case Gemini includes conversational padding
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      text = text.substring(jsonStart, jsonEnd + 1);
    }
    
    const json = JSON.parse(text);
    return json;
  } catch(e) {
    console.error("AI generation failed:", e);
    return [
      { title: "AI Unavailable", explanation: "Could not generate AI suggestions at this time. " + e.message, category: "System" }
    ];
  }
}
