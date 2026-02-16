/**
 * PI Triage System - Frontend Application
 * Handles API key setup, contact intake, and chat interface
 */

// ============================================================================
// Glossary – Sajith's key terms (show context when founder doesn't understand)
// ============================================================================

const GLOSSARY = {
    'PMF': 'Product-Market Fit. PMF = PPF + MMF. Before you go big, you need to get it right.',
    'PPF': 'Product-to-Problem Fit. Does the pain go away when customers use your product?',
    'MMF': 'Motion-to-Market Fit. Can you reliably, affordably acquire lookalike customers?',
    'GRUE': 'Growth with Retention and Unit Economics – a shorthand for PMF.',
    'CM2+': 'Contribution margin after acquisition costs, positive. A good shorthand for PMF.',
    'Congruent Square': 'Product, Market, GTM, and Team must align. Loose alignment hurts PMF.',
    'India1': '~10% of India – urban, English-speaking, 40% of consumer spends.',
    'India2': '100–200M – vernacular, emerging middle class. Not the same as India1.',
    'India3': 'Rural, low income, hard to serve profitably.',
    'hero channel': 'The one acquisition channel that works. Uncomfortably narrow is good.',
    'GTM': 'Go-to-market. Pouring GTM fuel before PMF = premature scaling.',
    'ICP': 'Ideal Customer Profile. Uncomfortably narrow personas.',
    'Sean Ellis test': '40%+ say "very disappointed" if product disappeared = strong PPF signal.',
    'nailing before scaling': 'PMF is the nailing before the scaling. Get it right first.',
    'LTV/CAC': 'Lifetime value to customer acquisition cost. Aim for 3:1.',
    'retention curve': 'B2C: flatline at ~10% at D90 is a PPF signal.',
    'pre-PMF': 'PrePMF startups are a learning machine, not an earning machine.',
    'Believe what they do': 'Trust customer behaviour, not what they say in interviews.',
    'Focus on the monkey': 'Solve the hardest thing first – focus on the monkey, not the pedestal.',
};

// Term order for wrapping: longest first so "Congruent Square" matches before "Square"
const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

// ============================================================================
// State Management
// ============================================================================

const state = {
    apiKey: null,
    workspaceId: null,
    calendlyUrl: null,
    conversationId: null,
    conversationState: null,
    turnCount: 0,
    signalCount: 0,
    isLoading: false,
    evaluationComplete: false,
    lastAnalyzeResult: null
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
    // Sections
    apiKeySection: document.getElementById('api-key-section'),
    intakeSection: document.getElementById('intake-section'),
    analyzeSection: document.getElementById('analyze-section'),
    chatSection: document.getElementById('chat-section'),
    evaluationSection: document.getElementById('evaluation-section'),

    // Forms
    apiKeyForm: document.getElementById('api-key-form'),
    intakeForm: document.getElementById('intake-form'),
    analyzeForm: document.getElementById('analyze-form'),
    chatForm: document.getElementById('chat-form'),

    // Inputs
    apiKeyInput: document.getElementById('api-key'),
    chatInput: document.getElementById('chat-input'),
    micBtn: document.getElementById('mic-btn'),
    micIcon: document.getElementById('mic-icon'),
    micStatus: document.getElementById('mic-status'),

    // Display elements
    chatMessages: document.getElementById('chat-messages'),
    turnCounter: document.getElementById('turn-counter'),
    signalCount: document.getElementById('signal-count'),
    evaluationContent: document.getElementById('evaluation-content'),
    statusIndicator: document.getElementById('status-indicator'),

    // Buttons
    sendBtn: document.getElementById('send-btn'),
    startOverBtn: document.getElementById('start-over-btn'),
    clearKeyLink: document.getElementById('clear-key-link'),

    // Loading
    loadingOverlay: document.getElementById('loading-overlay'),
    contextToggle: document.getElementById('context-toggle'),
    contextPanel: document.getElementById('context-panel'),
    contextPanelClose: document.getElementById('context-panel-close'),
    contextPanelList: document.getElementById('context-panel-list'),
    termTooltip: document.getElementById('term-tooltip'),
    // Analyze (Robin.ai SPA)
    analyzeResults: document.getElementById('analyze-results'),
    analyzeVerdict: document.getElementById('analyze-verdict'),
    analyzeEvidence: document.getElementById('analyze-evidence'),
    analyzeGrue: document.getElementById('analyze-grue'),
    analyzeConflicts: document.getElementById('analyze-conflicts'),
    goToAnalyze: document.getElementById('go-to-analyze'),
    goToIntake: document.getElementById('go-to-intake'),
    pipelineSection: document.getElementById('pipeline-section'),
    pipelineStats: document.getElementById('pipeline-stats'),
    pipelineTableWrap: document.getElementById('pipeline-table-wrap'),
    pipelineBack: document.getElementById('pipeline-back'),
    goToPipeline: document.getElementById('go-to-pipeline'),
    analyzeHistory: document.getElementById('analyze-history'),
    workspaceInput: document.getElementById('workspace-id')
};

// ============================================================================
// API Functions
// ============================================================================

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

async function apiRequest(endpoint, method, body = null, queryParams = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    const token = localStorage.getItem('robin_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (state.apiKey) headers['X-API-Key'] = state.apiKey;
    if (state.workspaceId) headers['X-Workspace-Id'] = state.workspaceId;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    let url = `${API_BASE}/${endpoint}`;
    if (queryParams && typeof queryParams === 'object') {
        const qs = new URLSearchParams(queryParams).toString();
        if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    const response = await fetch(url, options);
    let data;
    try {
        data = await response.json();
    } catch (_) {
        throw new Error(`Server returned non-JSON (${response.status})`);
    }
    if (!response.ok) {
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    return data;
}

async function checkHealth() {
    try {
        const data = await apiRequest('health', 'GET');
        state.calendlyUrl = data.calendly_url || null;
        elements.statusIndicator.textContent = 'Connected';
        elements.statusIndicator.style.color = '#22c55e';
        return true;
    } catch (error) {
        elements.statusIndicator.textContent = 'Offline';
        elements.statusIndicator.style.color = '#ef4444';
        state.lastHealthError = error.message || 'Network error';
        return false;
    }
}

async function submitIntake(name, email, currentWork, raisingStatus = '', segment = '') {
    const body = { name, email, current_work: currentWork };
    if (raisingStatus) body.raising_status = raisingStatus;
    if (segment) body.segment = segment;
    if (state.workspaceId) body.workspace_id = state.workspaceId;
    return apiRequest('intake', 'POST', body);
}

async function sendMessage(message) {
    return apiRequest('chat', 'POST', {
        message,
        conversation_id: state.conversationId,
        state: state.conversationState
    });
}

// ============================================================================
// UI Functions
// ============================================================================

function showSection(sectionId) {
    elements.apiKeySection.classList.add('hidden');
    elements.intakeSection.classList.add('hidden');
    if (elements.analyzeSection) elements.analyzeSection.classList.add('hidden');
    if (elements.pipelineSection) elements.pipelineSection.classList.add('hidden');
    elements.chatSection.classList.add('hidden');
    elements.evaluationSection.classList.add('hidden');

    // Show requested section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
    }
}

function showLoading(show = true, text = 'Processing...') {
    state.isLoading = show;
    if (show) {
        elements.loadingOverlay.classList.remove('hidden');
        elements.loadingOverlay.querySelector('.loading-text').textContent = text;
    } else {
        elements.loadingOverlay.classList.add('hidden');
    }
}

const MAX_TURNS = 7;

function updateTurnCounter() {
    elements.turnCounter.textContent = `Turn ${state.turnCount}/${MAX_TURNS}`;
}

function updateSignalCount() {
    elements.signalCount.textContent = state.signalCount;
}

/** Escape string for use inside RegExp */
function regexEscape(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wrap glossary terms in assistant messages with hint spans for tooltips */
function wrapTermsForHints(text) {
    if (!text || typeof text !== 'string') return '';
    let out = escapeHtml(text);
    GLOSSARY_TERMS.forEach(term => {
        const pattern = regexEscape(escapeHtml(term));
        const re = new RegExp(`(${pattern})`, 'gi');
        out = out.replace(re, `<span class="term-hint" data-term="${escapeHtml(term)}" tabindex="0">$1</span>`);
    });
    return out;
}

function addMessage(content, role, meta = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    if (role === 'assistant') {
        contentDiv.innerHTML = wrapTermsForHints(content);
        bindTermHints(contentDiv);
    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);

    if (meta) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'message-meta';

        if (meta.aiWarning) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'ai-warning';
            warningDiv.textContent = meta.aiWarning;
            messageDiv.appendChild(warningDiv);
        }

        if (meta.timestamp) {
            metaDiv.textContent = meta.timestamp;
            messageDiv.appendChild(metaDiv);
        }
    }

    elements.chatMessages.appendChild(messageDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message message-assistant';
    typingDiv.id = 'typing-indicator';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';

    typingDiv.appendChild(indicator);
    elements.chatMessages.appendChild(typingDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function showEvaluation(evaluation) {
    const scoreClass = evaluation.score <= 4 ? 'score-low' :
                       evaluation.score <= 6 ? 'score-medium' : 'score-high';

    const rationaleHtml = evaluation.rationale
        ? evaluation.rationale.map(r => `<li>${escapeHtml(r)}</li>`).join('')
        : '<li>No detailed rationale available</li>';

    const claimsHtml = evaluation.key_claims_to_verify
        ? evaluation.key_claims_to_verify.map(c => `<li>${escapeHtml(c)}</li>`).join('')
        : '';

    elements.evaluationContent.innerHTML = `
        <div class="evaluation-score">
            <div class="score-circle ${scoreClass}">${evaluation.score}/10</div>
            <div class="score-details">
                <h3>${getRecommendationTitle(evaluation.recommendation)}</h3>
                <p>${escapeHtml(evaluation.recommendation_text || '')}</p>
            </div>
        </div>

        <div class="evaluation-rationale">
            <h4>Assessment</h4>
            <ul>${rationaleHtml}</ul>
        </div>

        ${evaluation.suggested_meeting_focus ? `
        <div class="evaluation-rationale">
            <h4>Suggested Discussion Topics</h4>
            <p>${escapeHtml(evaluation.suggested_meeting_focus)}</p>
        </div>
        ` : ''}

        ${claimsHtml ? `
        <div class="evaluation-rationale">
            <h4>Claims to Verify</h4>
            <ul>${claimsHtml}</ul>
        </div>
        ` : ''}

        <div class="evaluation-rationale">
            <h4>Scoring Breakdown</h4>
            <ul>
                <li>Authenticity Score: ${evaluation.authenticity_score || 'N/A'}/10</li>
                <li>Quality Score: ${evaluation.quality_score || 'N/A'}/10</li>
                <li>Final Score: ${evaluation.score}/10</li>
                ${evaluation.hardcoded_override ? `<li>Note: Score adjusted by system rules (original LLM score: ${evaluation.original_llm_score})</li>` : ''}
            </ul>
        </div>
    `;

    if (evaluation.recommendation === 'recommend_meeting' && state.calendlyUrl) {
        elements.evaluationContent.insertAdjacentHTML('beforeend',
            `<div class="evaluation-cta"><a href="${escapeHtml(state.calendlyUrl)}" target="_blank" rel="noopener" class="btn btn-primary">Schedule intro</a></div>`);
    }

    showSection('evaluation-section');
}

function getRecommendationTitle(recommendation) {
    const titles = {
        'do_not_recommend': 'Not Recommended',
        'refer_out': 'Consider Other Resources',
        'recommend_if_bandwidth': 'Worth Considering',
        'recommend_meeting': 'Recommended for Meeting'
    };
    return titles[recommendation] || recommendation;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/** Show tooltip for a term hint */
function showTermTooltip(term, el) {
    const def = GLOSSARY[term];
    if (!def || !elements.termTooltip) return;
    elements.termTooltip.textContent = def;
    elements.termTooltip.classList.remove('hidden');
    const rect = el.getBoundingClientRect();
    elements.termTooltip.style.left = `${rect.left}px`;
    elements.termTooltip.style.top = `${rect.top - 6}px`;
    elements.termTooltip.style.transform = 'translateY(-100%)';
}

function hideTermTooltip() {
    if (elements.termTooltip) {
        elements.termTooltip.classList.add('hidden');
    }
}

/** Bind hover/focus to term hints inside a container */
function bindTermHints(container) {
    if (!container) return;
    container.querySelectorAll('.term-hint').forEach(span => {
        const term = span.getAttribute('data-term');
        if (!term || !GLOSSARY[term]) return;
        span.addEventListener('mouseenter', () => showTermTooltip(term, span));
        span.addEventListener('mouseleave', hideTermTooltip);
        span.addEventListener('focus', () => showTermTooltip(term, span));
        span.addEventListener('blur', hideTermTooltip);
    });
}

/** Populate and toggle the Key terms context panel */
function renderContextPanel() {
    if (!elements.contextPanelList) return;
    elements.contextPanelList.innerHTML = GLOSSARY_TERMS.map(term => {
        const def = GLOSSARY[term];
        return `<div class="context-term"><strong>${escapeHtml(term)}</strong><span>${escapeHtml(def)}</span></div>`;
    }).join('');
}

function toggleContextPanel() {
    if (!elements.contextPanel) return;
    elements.contextPanel.classList.toggle('open');
    elements.contextToggle?.setAttribute('aria-expanded', elements.contextPanel.classList.contains('open'));
}

function closeContextPanel() {
    elements.contextPanel?.classList.remove('open');
    elements.contextToggle?.setAttribute('aria-expanded', 'false');
}

function showError(message) {
    alert(message);  // Simple error handling - could be improved
}

// ============================================================================
// Event Handlers
// ============================================================================

// Analyze (Robin.ai SPA): call /api/analyze and render Evidence Map, GRUE, Conflicts
async function submitAnalyze(transcriptText, dictationText) {
    const body = {};
    if (transcriptText && dictationText) {
        body.transcript_text = transcriptText;
        body.dictation_text = dictationText;
    } else if (transcriptText) {
        body.transcript_text = transcriptText;
    } else if (dictationText) {
        body.dictation_text = dictationText;
    } else {
        throw new Error('Enter transcript and/or dictation');
    }
    if (state.workspaceId) body.workspace_id = state.workspaceId;
    return apiRequest('analyze', 'POST', body);
}

function renderAnalyzeResults(data) {
    state.lastAnalyzeResult = data;
    const appraisal = data.immediate_appraisal || {};
    const grueVerdict = appraisal.grue_verdict || 'Low';
    const convictionScore = appraisal.conviction_score != null ? appraisal.conviction_score : null;
    const aiPolish = data.ai_polish;

    // Verdict + Conviction score (Phase 3) + AI Polish (Phase 2)
    let verdictHtml = '<h3>GRUE Verdict: ' + escapeHtml(grueVerdict) + '</h3>';
    if (convictionScore != null) {
        verdictHtml += '<p class="conviction-score">Conviction score: <strong>' + Math.round(convictionScore * 100) + '%</strong></p>';
    }
    if (aiPolish && typeof aiPolish.cumulative_score === 'number') {
        const pct = Math.round(aiPolish.cumulative_score * 100);
        const label = pct >= 50 ? 'High AI polish (narrative risk)' : pct >= 30 ? 'Moderate AI polish' : 'Low AI polish';
        verdictHtml += '<p class="ai-polish">Narrative authenticity: ' + escapeHtml(label) + ' (' + pct + '%)</p>';
    }
    if (appraisal.immediate_appraisal_markdown) {
        verdictHtml += '<div class="appraisal-markdown">' + escapeHtml(appraisal.immediate_appraisal_markdown).replace(/\n/g, '<br>') + '</div>';
    }
    elements.analyzeVerdict.innerHTML = verdictHtml;

    // Evidence Map
    const evidenceLog = data.evidence_log || [];
    let evidenceHtml = '<h3>Evidence Map</h3>';
    if (evidenceLog.length === 0) {
        evidenceHtml += '<p class="muted">No extracted signals.</p>';
    } else {
        evidenceHtml += '<ul class="evidence-list">';
        evidenceLog.forEach(e => {
            const verified = e.verified ? ' <span class="badge verified">verified</span>' : ' <span class="badge unverified">unverified</span>';
            const quote = (e.evidence || e.value || '').trim();
            const counter = (e.counter_question || '').trim();
            evidenceHtml += '<li><strong>' + escapeHtml(String(e.signal || e.value)) + '</strong>' + verified;
            if (quote) evidenceHtml += '<blockquote>' + escapeHtml(quote) + '</blockquote>';
            if (counter) evidenceHtml += '<p class="counter-q">' + escapeHtml(counter) + '</p>';
            evidenceHtml += '</li>';
        });
        evidenceHtml += '</ul>';
    }
    elements.analyzeEvidence.innerHTML = evidenceHtml;

    // GRUE checklist: blind spots + questions for next meeting
    const blindSpots = data.blind_spots || [];
    const questions = data.questions_for_next_meeting || [];
    let grueHtml = '<h3>GRUE Diligence Checklist</h3>';
    if (blindSpots.length) {
        grueHtml += '<p><strong>Blind spots (not mentioned):</strong></p><ul>';
        blindSpots.forEach(b => { grueHtml += '<li>' + escapeHtml(b) + '</li>'; });
        grueHtml += '</ul>';
    }
    if (questions.length) {
        grueHtml += '<p><strong>Questions for next meeting:</strong></p><ul>';
        questions.forEach(q => { grueHtml += '<li>' + escapeHtml(q) + '</li>'; });
        grueHtml += '</ul>';
    }
    if (!blindSpots.length && !questions.length) {
        grueHtml += '<p class="muted">No blind spots or follow-up questions.</p>';
    }
    elements.analyzeGrue.innerHTML = grueHtml;

    // Conflict Report (Type A/B factual + Type C omission)
    const conflicts = data.conflict_report || [];
    let conflictHtml = '<h3>Conflict Report</h3>';
    if (conflicts.length === 0) {
        conflictHtml += '<p class="muted">No conflicts (single source or transcript and dictation align).</p>';
    } else {
        conflictHtml += '<ul class="conflict-list">';
        conflicts.forEach(c => {
            const typeLabel = c.conflict_type === 'omission' ? ' [Omission]' : '';
            if (c.conflict_type === 'omission') {
                conflictHtml += '<li><strong>Omission</strong>: ' + escapeHtml(c.dictation_value || c.summary || '') + '</li>';
            } else {
                conflictHtml += '<li><strong>' + escapeHtml(c.metric || '') + '</strong>' + escapeHtml(typeLabel) + ': meeting said &ldquo;' + escapeHtml(c.transcript_value || '') + '&rdquo; but notes say &ldquo;' + escapeHtml(c.dictation_value || '') + '&rdquo;</li>';
            }
        });
        conflictHtml += '</ul>';
    }
    elements.analyzeConflicts.innerHTML = conflictHtml;

    // Export buttons (Phase 2)
    if (!document.getElementById('analyze-export')) {
        const exportWrap = document.createElement('div');
        exportWrap.id = 'analyze-export';
        exportWrap.className = 'analyze-export';
        exportWrap.innerHTML = '<button type="button" class="btn btn-ghost" id="analyze-copy-md">Copy markdown</button> <button type="button" class="btn btn-ghost" id="analyze-download-md">Download .md</button> <button type="button" class="btn btn-ghost" id="analyze-copy-share">Copy shareable summary</button>';
        elements.analyzeResults.appendChild(exportWrap);
        document.getElementById('analyze-copy-md').addEventListener('click', copyAnalyzeMarkdown);
        document.getElementById('analyze-download-md').addEventListener('click', downloadAnalyzeMarkdown);
        document.getElementById('analyze-copy-share').addEventListener('click', copyShareableSummary);
    }

    elements.analyzeResults.classList.remove('hidden');
    if (state.workspaceId && elements.analyzeHistory) {
        fetchAnalyzeHistory();
    }
}

async function fetchAnalyzeHistory() {
    if (!state.workspaceId) return;
    try {
        const data = await apiRequest('analyze/history', 'GET', null, { workspace_id: state.workspaceId, limit: 10 });
        const analyses = data.analyses || [];
        if (!elements.analyzeHistory) return;
        elements.analyzeHistory.classList.remove('hidden');
        if (analyses.length === 0) {
            elements.analyzeHistory.innerHTML = '';
            return;
        }
        elements.analyzeHistory.innerHTML = '<h3>Recent analyses</h3><ul class="analyze-history-list">' +
            analyses.map(a => {
                const date = a.timestamp ? new Date(a.timestamp).toLocaleDateString() : '';
                const verdict = escapeHtml(a.grue_verdict || '—');
                const score = a.conviction_score != null ? Math.round(a.conviction_score * 100) + '%' : '—';
                return `<li><span class="date">${escapeHtml(date)}</span> <strong>${verdict}</strong> ${score} ${escapeHtml((a.hook || '').slice(0, 60))}…</li>`;
            }).join('') +
            '</ul>';
    } catch (_) {
        if (elements.analyzeHistory) elements.analyzeHistory.innerHTML = '';
    }
}

function buildAnalyzeMarkdown() {
    const data = state.lastAnalyzeResult;
    if (!data) return '';
    const appraisal = data.immediate_appraisal || {};
    let md = '# Robin.ai – Analyze\n\n';
    md += '## GRUE Verdict: ' + (appraisal.grue_verdict || 'Low') + '\n\n';
    if (appraisal.conviction_score != null) {
        md += 'Conviction score: ' + Math.round(appraisal.conviction_score * 100) + '%\n\n';
    }
    if (appraisal.immediate_appraisal_markdown) {
        md += appraisal.immediate_appraisal_markdown + '\n\n';
    }
    md += '## Evidence Map\n\n';
    (data.evidence_log || []).forEach(e => {
        md += '- **' + (e.signal || e.value) + '** ' + (e.verified ? '(verified)' : '(unverified)') + '\n';
        if (e.evidence) md += '  > ' + e.evidence + '\n';
    });
    md += '\n## GRUE Diligence Checklist\n\n';
    (data.blind_spots || []).forEach(b => { md += '- Blind spot: ' + b + '\n'; });
    (data.questions_for_next_meeting || []).forEach(q => { md += '- Question: ' + q + '\n'; });
    md += '\n## Conflict Report\n\n';
    (data.conflict_report || []).forEach(c => {
        if (c.conflict_type === 'omission') {
            md += '- **Omission**: ' + (c.dictation_value || c.summary || '') + '\n';
        } else {
            md += '- **' + (c.metric || '') + '**: meeting said "' + (c.transcript_value || '') + '" but notes say "' + (c.dictation_value || '') + '"\n';
        }
    });
    return md;
}

function copyShareableSummary() {
    const data = state.lastAnalyzeResult;
    if (!data) return;
    const appraisal = data.immediate_appraisal || {};
    const verdict = appraisal.grue_verdict || '—';
    const pct = appraisal.conviction_score != null ? Math.round(appraisal.conviction_score * 100) : '';
    const date = new Date().toLocaleDateString();
    const url = window.location.href.split('#')[0];
    let line = `Robin analysis: ${verdict}`;
    if (pct !== '') line += ` (${pct}% conviction)`;
    line += `. ${date}. ${url}`;
    navigator.clipboard.writeText(line).then(() => {
        if (elements.statusIndicator) {
            elements.statusIndicator.textContent = 'Shareable summary copied';
            setTimeout(() => { elements.statusIndicator.textContent = 'Ready'; }, 2000);
        }
    }).catch(() => showError('Copy failed.'));
}

function copyAnalyzeMarkdown() {
    const md = buildAnalyzeMarkdown();
    if (!md) return;
    navigator.clipboard.writeText(md).then(() => {
        if (elements.statusIndicator) {
            elements.statusIndicator.textContent = 'Copied to clipboard';
            setTimeout(() => { elements.statusIndicator.textContent = 'Ready'; }, 2000);
        }
    }).catch(() => showError('Copy failed.'));
}

function downloadAnalyzeMarkdown() {
    const md = buildAnalyzeMarkdown();
    if (!md) return;
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'robin-analyze-' + new Date().toISOString().slice(0, 10) + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
}

// API Key Form
elements.apiKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiKey = elements.apiKeyInput.value.trim();

    if (!apiKey.startsWith('sk-')) {
        showError('Invalid API key format. Use OpenAI (sk-...) or Anthropic (sk-ant-...) key.');
        return;
    }

    state.apiKey = apiKey;
    localStorage.setItem('pi_api_key', apiKey);
    const workspaceId = (elements.workspaceInput && elements.workspaceInput.value) ? elements.workspaceInput.value.trim() : '';
    state.workspaceId = workspaceId || null;
    if (workspaceId) localStorage.setItem('pi_workspace_id', workspaceId);
    else localStorage.removeItem('pi_workspace_id');

    // Check health
    showLoading(true, 'Verifying connection...');
    const healthy = await checkHealth();
    showLoading(false);

    if (healthy) {
        showSection('intake-section');
    } else {
        const msg = state.lastHealthError || 'Could not connect to the server.';
        showError(msg + ' Make sure you\'re opening this app from the same URL as the server (e.g. your Vercel deployment).');
    }
});

// Intake Form
elements.intakeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const currentWork = document.getElementById('current-work').value.trim();
    const raisingStatus = (document.getElementById('raising-status') && document.getElementById('raising-status').value) || '';
    const segment = (document.getElementById('segment') && document.getElementById('segment').value) || '';

    showLoading(true, 'Processing intake...');

    try {
        const result = await submitIntake(name, email, currentWork, raisingStatus, segment);

        state.conversationId = result.conversation_id;

        // Quick win: show fit line so founder knows what to expect
        const fitParts = [];
        if (raisingStatus) fitParts.push(raisingStatus === 'raising' ? 'Raising' : raisingStatus === 'exploring' ? 'Exploring' : 'Not raising');
        if (segment) fitParts.push(segment);
        const fitLine = fitParts.length ? fitParts.join(' · ') : 'General';
        const fitBanner = document.getElementById('chat-fit-banner');
        if (fitBanner) {
            fitBanner.textContent = `Fit: ${fitLine}. We'll ask about PMF and traction.`;
            fitBanner.classList.remove('hidden');
        }

        showSection('chat-section');
        addMessage(
            "What are you building, and what's the one PMF challenge you're stuck on?",
            'assistant'
        );

    } catch (error) {
        showError(error.message || `Intake failed`);
    } finally {
        showLoading(false);
    }
});

// Analyze form
if (elements.analyzeForm) {
    elements.analyzeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const transcript = (document.getElementById('analyze-transcript') && document.getElementById('analyze-transcript').value) || '';
        const dictation = (document.getElementById('analyze-dictation') && document.getElementById('analyze-dictation').value) || '';
        if (!transcript.trim() && !dictation.trim()) {
            showError('Enter a transcript and/or your notes.');
            return;
        }
        showLoading(true, 'Analyzing...');
        try {
            const result = await submitAnalyze(transcript.trim(), dictation.trim());
            renderAnalyzeResults(result);
        } catch (err) {
            const msg = (err && err.message) || String(err);
            showError('Analysis failed: ' + msg);
        } finally {
            showLoading(false);
        }
    });
}

// Navigate: API key screen -> Analyze
if (elements.goToAnalyze) {
    elements.goToAnalyze.addEventListener('click', () => showSection('analyze-section'));
}
if (elements.goToIntake) {
    elements.goToIntake.addEventListener('click', () => showSection('intake-section'));
}

if (elements.goToPipeline) {
    elements.goToPipeline.addEventListener('click', () => {
        showSection('pipeline-section');
        loadPipeline();
    });
}
if (elements.pipelineBack) {
    elements.pipelineBack.addEventListener('click', () => showSection('api-key-section'));
}

async function loadPipeline() {
    if (!elements.pipelineStats || !elements.pipelineTableWrap) return;
    elements.pipelineStats.innerHTML = 'Loading…';
    elements.pipelineTableWrap.innerHTML = '';
    const pipelineMemory = document.getElementById('pipeline-memory');
    if (pipelineMemory) pipelineMemory.innerHTML = '';
    try {
        const q = state.workspaceId ? { workspace_id: state.workspaceId } : {};
        const [data, memoryData] = await Promise.all([
            apiRequest('leads', 'GET', null, q),
            apiRequest('memory', 'GET', null, q).catch(() => ({ learned_profile: {} })),
        ]);
        const leads = data.leads || [];
        const summary = data.override_summary || {};
        const profile = (memoryData.learned_profile || {}).summary_sentences || [];
        if (pipelineMemory) {
            if (profile.length) {
                pipelineMemory.innerHTML = '<h3>Your style</h3><p class="memory-summary">' +
                    profile.map(s => escapeHtml(s)).join(' ') + '</p>';
                pipelineMemory.classList.remove('hidden');
            } else {
                pipelineMemory.innerHTML = '<p class="memory-empty muted">Override a few leads and we\'ll learn your preferences.</p>';
                pipelineMemory.classList.remove('hidden');
            }
        }
        elements.pipelineStats.innerHTML = `
            <p><strong>${leads.length}</strong> leads
            ${summary.overrides_last_30_days != null ? ` · <strong>${summary.overrides_last_30_days}</strong> overrides in last 30 days (${summary.approved || 0} approved, ${summary.rejected || 0} rejected)` : ''}</p>
            ${(summary.overrides_last_30_days || 0) > 0 ? '<p class="pipeline-insight">Your overrides help us learn—thanks for correcting.</p>' : ''}
        `;
        if (leads.length === 0) {
            elements.pipelineTableWrap.innerHTML = '<p class="muted">No leads in this workspace yet.</p>';
            return;
        }
        const rows = leads.map(l => {
            const ev = l.evaluation_result || {};
            const score = ev.score != null ? ev.score : '—';
            const rec = ev.recommendation || '—';
            const override = l.override ? ` <span class="override-badge override-${l.override}">${l.override}</span>` : '';
            return `<tr>
                <td>${escapeHtml(l.name || '')}</td>
                <td>${escapeHtml(l.email || '')}</td>
                <td>${escapeHtml((l.current_work || '').slice(0, 40))}…</td>
                <td>${score}</td>
                <td>${escapeHtml(rec)}${override}</td>
            </tr>`;
        }).join('');
        elements.pipelineTableWrap.innerHTML = `<table class="pipeline-table"><thead><tr><th>Name</th><th>Email</th><th>Work</th><th>Score</th><th>Recommendation</th></tr></thead><tbody>${rows}</tbody></table>`;
    } catch (e) {
        elements.pipelineStats.innerHTML = '';
        elements.pipelineTableWrap.innerHTML = '<p class="muted">Could not load pipeline: ' + escapeHtml(e.message) + '</p>';
    }
}

// Voice input (Web Speech API) – committed text + latest interim only, no repetition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
const voiceState = { baseText: '', finalSegments: [], lastInterim: '' };

function getVoiceDisplayText() {
    const parts = [voiceState.baseText, ...voiceState.finalSegments].filter(Boolean);
    let out = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (voiceState.lastInterim.trim()) {
        out = (out ? out + ' ' : '') + voiceState.lastInterim.trim();
    }
    return out;
}

function updateVoiceInput() {
    const text = getVoiceDisplayText();
    elements.chatInput.value = text + (isListening ? ' [listening]' : '');
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = (result[0] && result[0].transcript) ? result[0].transcript.trim() : '';
            if (!transcript) continue;

            if (result.isFinal) {
                // Avoid duplicate or overlapping final segments
                const last = voiceState.finalSegments[voiceState.finalSegments.length - 1];
                if (last === transcript) continue;
                if (last && transcript.indexOf(last) === 0) {
                    voiceState.finalSegments[voiceState.finalSegments.length - 1] = transcript;
                    continue;
                }
                if (last && last.indexOf(transcript) === 0) continue;
                voiceState.finalSegments.push(transcript);
                voiceState.lastInterim = '';
            } else {
                voiceState.lastInterim = transcript;
            }
        }
        updateVoiceInput();
    };

    recognition.onend = () => {
        isListening = false;
        voiceState.lastInterim = '';
        elements.chatInput.value = getVoiceDisplayText();
        elements.micBtn.classList.remove('listening');
        elements.micIcon.classList.remove('hidden');
        elements.micStatus.classList.add('hidden');
    };

    recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
            console.warn('Speech recognition error:', event.error);
        }
        isListening = false;
        elements.micBtn.classList.remove('listening');
        elements.micIcon.classList.remove('hidden');
        elements.micStatus.classList.add('hidden');
    };

    elements.micBtn.addEventListener('click', () => {
        if (state.isLoading || state.evaluationComplete) return;
        if (isListening) {
            recognition.stop();
            return;
        }
        const current = elements.chatInput.value.replace(/\s*\[listening\]\s*$/, '').trim();
        voiceState.baseText = current;
        voiceState.finalSegments = [];
        voiceState.lastInterim = '';
        isListening = true;
        elements.micBtn.classList.add('listening');
        elements.micIcon.classList.add('hidden');
        elements.micStatus.classList.remove('hidden');
        elements.micStatus.textContent = 'Listening...';
        recognition.start();
    });
} else {
    elements.micBtn.style.display = 'none';
}

// Chat Form
elements.chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (state.isLoading || state.evaluationComplete) return;

    const message = elements.chatInput.value.replace(/\s*\[listening\]\s*$/, '').trim();
    if (!message) return;

    if (recognition && isListening) recognition.stop();

    // Add user message
    addMessage(message, 'user', { timestamp: new Date().toLocaleTimeString() });
    elements.chatInput.value = '';

    // Show typing indicator
    addTypingIndicator();
    elements.sendBtn.disabled = true;

    try {
        const result = await sendMessage(message);

        // Remove typing indicator
        removeTypingIndicator();

        // Update state
        state.turnCount = result.turn_count;
        state.conversationState = result.state;

        if (result.signals) {
            state.signalCount = result.signals.traction_count + result.signals.credential_count;
        }

        updateTurnCounter();
        updateSignalCount();

        // Add AI detection warning if present
        let meta = { timestamp: new Date().toLocaleTimeString() };
        if (result.ai_detection_this_turn && result.ai_detection_this_turn.flags.length > 0) {
            meta.aiWarning = `AI signals detected: ${result.ai_detection_this_turn.flags.join(', ')}`;
        }

        // Add PI response
        if (result.message) {
            addMessage(result.message, 'assistant', meta);
        }

        // Check if evaluation is complete
        if (result.evaluation_complete && result.evaluation) {
            state.evaluationComplete = true;
            setTimeout(() => {
                showEvaluation(result.evaluation);
            }, 1000);
        }

    } catch (error) {
        removeTypingIndicator();
        addMessage(`Error: ${error.message}. Please try again.`, 'assistant');
    } finally {
        elements.sendBtn.disabled = false;
    }
});

// Key terms context panel
if (elements.contextToggle) {
    elements.contextToggle.addEventListener('click', () => {
        renderContextPanel();
        toggleContextPanel();
    });
}
if (elements.contextPanelClose) {
    elements.contextPanelClose.addEventListener('click', closeContextPanel);
}

// Start Over Button
elements.startOverBtn.addEventListener('click', () => {
    // Reset state
    state.conversationId = null;
    state.conversationState = null;
    state.turnCount = 0;
    state.signalCount = 0;
    state.evaluationComplete = false;

    // Clear chat
    elements.chatMessages.innerHTML = '';

    elements.intakeForm.reset();
    elements.chatInput.value = '';
    const fitBanner = document.getElementById('chat-fit-banner');
    if (fitBanner) fitBanner.classList.add('hidden');

    updateTurnCounter();
    updateSignalCount();
    showSection('intake-section');
});

// Clear API Key Link
elements.clearKeyLink.addEventListener('click', (e) => {
    e.preventDefault();

    if (confirm('Clear your API key? You will need to enter it again.')) {
        localStorage.removeItem('pi_api_key');
        state.apiKey = null;
        elements.apiKeyInput.value = '';
        showSection('api-key-section');
    }
});

// Handle Enter key in chat input (Shift+Enter for newline)
elements.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        elements.chatForm.dispatchEvent(new Event('submit'));
    }
});

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    const token = localStorage.getItem('robin_token');
    if (token) {
        try {
            const me = await fetch(API_BASE + '/me', { headers: { 'Authorization': 'Bearer ' + token } }).then(r => r.ok ? r.json() : null);
            if (me && me.workspace_id) {
                state.workspaceId = me.workspace_id;
                localStorage.setItem('pi_workspace_id', me.workspace_id);
            }
        } catch (_) {}
    }
    const savedWorkspace = localStorage.getItem('pi_workspace_id');
    state.workspaceId = state.workspaceId || savedWorkspace || null;
    if (elements.workspaceInput) elements.workspaceInput.value = savedWorkspace || '';

    const savedKey = localStorage.getItem('pi_api_key');

    if (savedKey) {
        state.apiKey = savedKey;
        elements.apiKeyInput.value = savedKey;

        // Verify connection
        showLoading(true, 'Connecting...');
        const healthy = await checkHealth();
        showLoading(false);

        if (healthy) {
            showSection('intake-section');
        } else {
            showSection('api-key-section');
        }
    } else {
        showSection('api-key-section');
    }

    // Initial health check
    checkHealth();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
