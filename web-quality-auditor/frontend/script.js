const analyzeBtn = document.getElementById('analyzeBtn');
const repoUrlInput = document.getElementById('repoUrl');
const reportContainer = document.getElementById('reportContainer');

function getScoreColorClass(score) {
    if (score >= 80) return 'score-green';
    if (score >= 60) return 'score-yellow';
    return 'score-red';
}

function getSeverityBadgeClass(severity) {
    const s = String(severity).toLowerCase();
    if (s === 'high') return 'badge-high';
    if (s === 'medium') return 'badge-medium';
    return 'badge-low';
}

fetch('http://localhost:4000/api/health')
    .then(r => { if(!r.ok) console.warn('Backend returned non-ok status'); })
    .catch(e => console.warn('Backend is disconnected.'));

analyzeBtn.addEventListener('click', async () => {
    const repoUrl = repoUrlInput.value.trim();
    if (!repoUrl) return;

    analyzeBtn.disabled = true;
    renderLoading();

    try {
        const response = await fetch('http://localhost:4000/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoUrl })
        });

        const data = await response.json();
        if (!response.ok) {
            renderError(data.error || `HTTP Error ${response.status}`);
            return;
        }

        renderReport(data);

    } catch (err) {
        renderError('Failed to connect to the backend server. Make sure it is running on port 4000.');
    } finally {
        analyzeBtn.disabled = false;
    }
});

function renderLoading() {
    reportContainer.classList.remove('hidden');
    reportContainer.innerHTML = '';
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-state';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    
    const text = document.createElement('h3');
    text.textContent = 'Cloning and analyzing repository...';
    
    const subtext = document.createElement('p');
    subtext.style.color = 'var(--text-secondary)';
    subtext.style.marginTop = '0.5rem';
    subtext.textContent = 'This deep audit may take 10-30 seconds. Please wait.';
    
    loadingDiv.appendChild(spinner);
    loadingDiv.appendChild(text);
    loadingDiv.appendChild(subtext);
    reportContainer.appendChild(loadingDiv);
}

function renderError(message) {
    reportContainer.classList.remove('hidden');
    reportContainer.innerHTML = ''; 
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    
    const icon = document.createElement('div');
    icon.className = 'error-icon';
    icon.textContent = '⚠️';
    
    const title = document.createElement('h2');
    title.textContent = 'Analysis Failed';
    title.style.marginBottom = '1rem';
    
    const msg = document.createElement('p');
    msg.textContent = message;
    msg.style.color = 'var(--text-secondary)';
    
    errorDiv.appendChild(icon);
    errorDiv.appendChild(title);
    errorDiv.appendChild(msg);
    reportContainer.appendChild(errorDiv);
}

function renderReport(data) {
    reportContainer.classList.remove('hidden');
    reportContainer.innerHTML = '';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'report-header';

    const overallScoreCircle = document.createElement('div');
    overallScoreCircle.className = `overall-score-circle ${getScoreColorClass(data.overallScore)}`;
    overallScoreCircle.textContent = `${Math.round(data.overallScore)}%`;

    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'issue-summary';
    
    if (data.issueSummary) {
        ['high', 'medium', 'low'].forEach(sev => {
            const count = data.issueSummary[sev] || 0;
            const span = document.createElement('span');
            span.className = `badge badge-${sev}`;
            span.textContent = `${count} ${sev.charAt(0).toUpperCase() + sev.slice(1)}`;
            summaryDiv.appendChild(span);
        });
    }

    headerDiv.appendChild(overallScoreCircle);
    headerDiv.appendChild(summaryDiv);
    reportContainer.appendChild(headerDiv);

    // AI Section
    const aiSection = document.createElement('div');
    aiSection.className = 'ai-section';
    aiSection.id = 'aiSection';

    if (data.aiSuggestions) {
        renderAISuggestions(data.aiSuggestions, aiSection);
    } else {
        const aiBtn = document.createElement('button');
        aiBtn.className = 'btn-ai';
        aiBtn.textContent = '✨ Get AI Recommendations';
        aiBtn.onclick = () => fetchAIRecommendations(repoUrlInput.value.trim(), aiSection);
        aiSection.appendChild(aiBtn);
    }

    reportContainer.appendChild(aiSection);

    // Categories Grid
    const gridDiv = document.createElement('div');
    gridDiv.className = 'categories-grid';

    if (data.categories) {
        for (const [catName, catData] of Object.entries(data.categories)) {
            const card = createCategoryCard(catName, catData);
            gridDiv.appendChild(card);
        }
    }

    reportContainer.appendChild(gridDiv);
}

async function fetchAIRecommendations(repoUrl, aiContainer) {
    aiContainer.innerHTML = '';
    const aiLoading = document.createElement('div');
    aiLoading.className = 'ai-loading';
    aiLoading.innerHTML = '<div class="spinner spinner-small"></div><span>Gemini is prioritizing findings...</span>';
    aiContainer.appendChild(aiLoading);

    try {
        const response = await fetch('http://localhost:4000/api/analyze?withAI=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoUrl })
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error);
        
        renderAISuggestions(data.aiSuggestions || [], aiContainer);
    } catch(e) {
        aiContainer.innerHTML = '';
        const errP = document.createElement('p');
        errP.style.color = 'var(--score-red)';
        errP.textContent = 'Failed to load AI suggestions: ' + e.message;
        aiContainer.appendChild(errP);
    }
}

function renderAISuggestions(suggestions, container) {
    container.innerHTML = '';
    
    const title = document.createElement('h3');
    title.className = 'ai-title';
    title.textContent = '✨ AI Top Priorities';
    container.appendChild(title);

    const list = document.createElement('div');
    list.className = 'ai-list';

    suggestions.forEach((sug, i) => {
        const card = document.createElement('div');
        card.className = 'ai-card';
        
        const header = document.createElement('div');
        header.className = 'ai-card-header';
        
        const num = document.createElement('span');
        num.className = 'ai-num';
        num.textContent = `#${i+1}`;
        
        const cat = document.createElement('span');
        cat.className = 'badge badge-low'; 
        cat.textContent = sug.category;
        
        header.appendChild(num);
        header.appendChild(cat);
        
        const stitle = document.createElement('h4');
        stitle.className = 'ai-card-title';
        stitle.textContent = sug.title;
        
        const expl = document.createElement('p');
        expl.className = 'ai-card-desc';
        expl.textContent = sug.explanation;

        card.appendChild(header);
        card.appendChild(stitle);
        card.appendChild(expl);
        list.appendChild(card);
    });

    container.appendChild(list);
}

function createCategoryCard(name, data) {
    const card = document.createElement('div');
    card.className = 'category-card';

    const header = document.createElement('div');
    header.className = 'card-header';
    
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    const score = document.createElement('div');
    score.className = `card-score ${getScoreColorClass(data.score)}`;
    score.textContent = Math.round(data.score || 0);

    header.appendChild(title);
    header.appendChild(score);
    card.appendChild(header);

    if (data.findings && data.findings.length > 0) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = `View ${data.findings.length} findings`;
        details.appendChild(summary);

        const list = document.createElement('div');
        list.className = 'finding-list';

        data.findings.forEach(finding => {
            const item = document.createElement('div');
            item.className = 'finding-item';

            const meta = document.createElement('div');
            meta.className = 'finding-meta';

            const badge = document.createElement('span');
            badge.className = `badge ${getSeverityBadgeClass(finding.severity)}`;
            badge.textContent = String(finding.severity).toUpperCase();

            const fileSpan = document.createElement('span');
            fileSpan.className = 'finding-file';
            fileSpan.textContent = `${finding.file || 'Global'}${finding.line ? `:${finding.line}` : ''}`;

            meta.appendChild(badge);
            meta.appendChild(fileSpan);

            const msg = document.createElement('div');
            msg.className = 'finding-msg';
            msg.textContent = finding.message;

            item.appendChild(meta);
            item.appendChild(msg);
            list.appendChild(item);
        });

        details.appendChild(list);
        card.appendChild(details);
    } else {
        const p = document.createElement('p');
        p.textContent = 'No issues found! 🎉';
        p.style.color = 'var(--score-green)';
        p.style.fontWeight = '500';
        p.style.marginTop = '1rem';
        card.appendChild(p);
    }

    return card;
}
