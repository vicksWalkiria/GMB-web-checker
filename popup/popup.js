document.addEventListener('DOMContentLoaded', () => {
    const btnAnalyze = document.getElementById('btn-analyze');
    const btnRetry = document.getElementById('btn-retry');
    const btnDashboard = document.getElementById('btn-dashboard');
    
    btnAnalyze.addEventListener('click', startAnalysis);
    btnRetry.addEventListener('click', () => switchState('initial-state'));
    
    // Accordion logic
    document.querySelectorAll('.accordion-header').forEach(button => {
        button.addEventListener('click', () => {
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            button.setAttribute('aria-expanded', !isExpanded);
        });
    });
});

function switchState(stateId) {
    document.querySelectorAll('.state-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.state-view').forEach(el => el.classList.add('hidden'));
    
    const activeEl = document.getElementById(stateId);
    activeEl.classList.remove('hidden');
    // small delay for display block to apply before opacity transition
    setTimeout(() => activeEl.classList.add('active'), 10);
}

function updateLoading(text) {
    document.getElementById('loading-status').innerText = text;
}

function showError(msg) {
    document.getElementById('error-message').innerText = msg;
    switchState('error-state');
}

async function startAnalysis() {
    try {
        switchState('loading-state');
        
        // 1. Get current active tab
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('google.com/maps') && !tab.url.includes('google.com/search')) {
             throw new Error('Abre una ficha de Google Maps o Google Search para analizar.');
        }

        updateLoading('Extrayendo datos de Google...');
        
        // 2. Inject script to extract GMB data
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/content_gmb.js']
        });

        const gmbData = injectionResults[0].result;
        console.log("GMB Data:", gmbData);

        if (!gmbData || !gmbData.name) {
            throw new Error('No se detectó información de ficha GMB en esta página. Asegúrate de tener la ficha abierta.');
        }

        let webUrl = gmbData.website;
        // For testing/mocking if no website is linked
        if (!webUrl) {
             throw new Error('La ficha no tiene sitio web enlazado para comparar.');
        }

        updateLoading('Descargando web oficial...');

        // 3. Fetch website via background service worker
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "FETCH_WEBSITE", url: webUrl }, resolve);
        });

        if (!response.success) {
            throw new Error('No se pudo descargar la web: ' + response.error);
        }

        updateLoading('Analizando coherencia SEO...');

        // 4. Parse website data
        const extractor = new WebExtractor(response.data, webUrl);
        const webData = extractor.extract();
        console.log("Web Data:", webData);

        // 5. Compare
        const comparator = new Comparator(gmbData, webData);
        const results = comparator.compare();
        console.log("Results:", results);

        // 6. Render
        renderResults(results);
        switchState('result-state');

    } catch (e) {
        console.error(e);
        showError(e.message || 'Error desconocido.');
    }
}

function renderResults(results) {
    // Render Score
    const scoreText = document.getElementById('score-text');
    const scorePath = document.getElementById('score-path');
    const scoreCard = document.querySelector('.score-card');
    
    scoreText.textContent = results.score;
    scorePath.style.strokeDasharray = `${results.score}, 100`;
    
    scoreCard.className = 'score-card'; // reset
    if (results.score >= 80) scoreCard.classList.add('score-high');
    else if (results.score >= 50) scoreCard.classList.add('score-med');
    else scoreCard.classList.add('score-low');

    // Render Lists
    const renderList = (id, items) => {
        const container = document.getElementById(id);
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="content-inner"><p class="result-text">No hay datos</p></div>';
            return;
        }

        const html = items.map(item => {
            let icon = 'ℹ️';
            if (item.status === 'success') icon = '✅';
            if (item.status === 'warning') icon = '⚠️';
            if (item.status === 'error') icon = '❌';

            return `
                <div class="result-item">
                    <div class="status-icon">${icon}</div>
                    <div class="result-text">
                        <strong>${item.text}</strong>
                        ${item.details ? `<span>${item.details}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="content-inner">${html}</div>`;
    };

    renderList('results-nap', results.nap);
    renderList('results-schema', results.schema);
    renderList('results-services', results.services);
}
