# Web Quality Auditor

A blazingly fast, modern web quality analysis platform. This tool allows users to input any public GitHub repository URL and instantly runs 6 concurrent static analysis pipelines to audit the codebase for Code Quality, Security, Accessibility, SEO, Maintainability, and Scalability.

Built with a **Node.js/Express** backend and a beautiful, framework-free **Vanilla HTML/CSS/JS** dashboard.

It also features a **Google Gemini 2.5 Flash** integration that prioritizes the top 5 most critical issues found in your project.

## Features
- **Concurrent Analysis**: Runs 6 distinct AST/Regex/DOM analyzers in parallel.
- **AI-Powered Priority Layer**: Uses Google Gemini to find the most pressing fixes out of hundreds of findings.
- **Secure Sandbox**: Clones the repo strictly for read-only static scanning (no `eval` or remote execution).
- **Hardened Backend**: Includes global 60-second timeouts, strict 200MB/5000-file thresholds, and IP-based rate limiting.
- **No-Framework UI**: A purely vanilla Javascript frontend that guarantees zero build steps and ultimate control over DOM safety (XSS prevention).

---

## Getting Started

### 1. Setup the Backend
The backend engine handles the GitHub cloning and the Gemini AI requests.

```bash
cd backend
npm install
```

**Environment Variables**
Create a `.env` file in the `backend` folder and add your Gemini API Key:
```env
GEMINI_API_KEY=your_api_key_here
```
*(Note: Do not commit your `.env` file to GitHub!)*

**Start the Server**
```bash
npm run dev
# The backend will start at http://localhost:4000
```

### 2. Setup the Frontend
The frontend requires zero build tools. You just need to serve it!

```bash
cd frontend
# Start a simple Python web server
python3 -m http.server 3000
```
Open `http://localhost:3000` in your web browser. Paste a public GitHub URL and click "Audit Now"!

---
## Analyzers Included
1. **Code Quality** (Programmatic ESLint)
2. **Security** (Secret detection, XSS hunting, CSP headers)
3. **Accessibility** (Cheerio-based WCAG audits)
4. **SEO** (Metadata validation)
5. **Maintainability** (Cyclomatic complexity via escomplex & duplication checks via jscpd)
6. **Scalability** (Heuristic structural checks)
