document.addEventListener('DOMContentLoaded', () => {
    const btnAnalyze = document.getElementById('btn-analyze');
    const btnRetry = document.getElementById('btn-retry');
    const btnExport = document.getElementById('btn-export');
    
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

        updateLoading('Descargando web oficial (Home)...');

        // 3. Fetch website via background service worker
        const homeResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "FETCH_WEBSITE", url: webUrl }, resolve);
        });

        if (!homeResponse.success) {
            throw new Error('No se pudo descargar la web: ' + homeResponse.error);
        }

        // 4. Parse website data
        let webData = {};
        let homeHtmlString = null;
        
        if (typeof homeResponse.data === 'string') {
            // Manejo de caché si Chrome no recargó el Service Worker
            homeHtmlString = homeResponse.data;
            webData = { finalUrl: webUrl, redirected: false, status: 200, analyzedPages: [] };
        } else if (homeResponse.data) {
            webData = { ...homeResponse.data, analyzedPages: [] };
            homeHtmlString = homeResponse.data.html;
        }

        let internalLinks = [];

        if (!webData.isBlocked && homeHtmlString) {
            const extractor = new WebExtractor(homeHtmlString, webUrl);
            const extracted = extractor.extract();
            webData = { ...webData, ...extracted };
            
            const sourceU = webData.finalUrl || webUrl;
            webData.phones = webData.phones.map(p => ({ value: p, sourceUrl: sourceU }));
            webData.jsonLd = webData.jsonLd.map(s => ({ ...s, sourceUrl: sourceU }));
            webData.texts = [{ text: webData.texts, sourceUrl: sourceU }];
            webData.analyzedPages.push(sourceU);
            
            internalLinks = extractor.extractInternalLinks(sourceU);
        } else {
            // fallback empty data for blocked requests
            webData = { ...webData, title: '', metaDescription: '', canonical: '', h1: '', jsonLd: [], phones: [], texts: [], analyzedPages: [] };
        }

        // 4.5 Crawling Interno
        let candidateLinks = [];
        let targetLinks = [];

        if (internalLinks.length > 0) {
            candidateLinks = internalLinks
                .map(url => ({ url, score: scoreInternalLink(url) }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(item => item.url);
                
            targetLinks = candidateLinks.slice(0, 3);

            if (targetLinks.length > 0) {
                updateLoading(`Rastreando páginas internas (${targetLinks.length})...`);
                const fetchPromises = targetLinks.map(link => {
                    return new Promise((resolve) => {
                        chrome.runtime.sendMessage({ action: "FETCH_WEBSITE", url: link }, resolve);
                    }).then(res => ({ url: link, res }));
                });

                const resultsArray = await Promise.all(fetchPromises);
                
                for (let result of resultsArray) {
                    const { url, res } = result;
                    if (res.success && res.data && !res.data.isBlocked && res.data.html) {
                        const htmlStr = typeof res.data === 'string' ? res.data : res.data.html;
                        const finalU = (typeof res.data === 'string' ? url : res.data.finalUrl) || url;
                        
                        const extractor = new WebExtractor(htmlStr, finalU);
                        const extracted = extractor.extract();
                        
                        webData.analyzedPages.push(finalU);
                        webData.phones.push(...extracted.phones.map(p => ({ value: p, sourceUrl: finalU })));
                        webData.jsonLd.push(...extracted.jsonLd.map(s => ({ ...s, sourceUrl: finalU })));
                        webData.texts.push({ text: extracted.texts, sourceUrl: finalU });
                    }
                }
            }
        }
        
        webData.candidatePages = candidateLinks;
        console.log("Aggregated Web Data:", webData);

        // 5. Compare
        const comparator = new Comparator(gmbData, webData);
        const results = comparator.compare();
        console.log("Results:", results);

        // 6. Render & Bind Export
        renderResults(results);
        const btnExport = document.getElementById('btn-export');
        btnExport.onclick = () => exportToMarkdown(results, gmbData);
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
    const scoreLabel = document.getElementById('score-label');
    
    scoreText.textContent = results.score;
    scorePath.style.strokeDasharray = `${results.score}, 100`;
    scoreLabel.textContent = results.label;
    
    scoreCard.className = 'score-card'; // reset
    if (results.score >= 85) scoreCard.classList.add('score-high');
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
            if (item.status === 'critical') icon = '🔴';
            if (item.status === 'medium') icon = '🟡';
            if (item.status === 'low') icon = '🔵';

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

    renderList('results-url', results.url);
    renderList('results-nap', results.nap);
    renderList('results-schema', results.schema);
    renderList('results-services', results.services);

    // Render analyzed pages
    const pagesList = document.getElementById('analyzed-pages-list');
    if (results.analyzedPages && results.analyzedPages.length > 0) {
        let pagesHtml = '<strong>Páginas analizadas:</strong><ul style="margin-top: 4px; padding-left: 16px; margin-bottom: 0;">';
        
        const homeUrl = results.analyzedPages[0];
        try {
            let homePath = new URL(homeUrl).pathname || '/';
            pagesHtml += `<li><a href="${homeUrl}" target="_blank" style="color: var(--primary); text-decoration: none;">Home (${homePath})</a></li>`;
        } catch(e) {
            pagesHtml += `<li><a href="${homeUrl}" target="_blank" style="color: var(--primary); text-decoration: none;">Home</a></li>`;
        }
        
        if (results.analyzedPages.length > 1) {
            for (let i = 1; i < results.analyzedPages.length; i++) {
                const p = results.analyzedPages[i];
                try {
                    let pathname = new URL(p).pathname || p;
                    pagesHtml += `<li><a href="${p}" target="_blank" style="color: var(--primary); text-decoration: none;">${pathname}</a></li>`;
                } catch(e) {
                    pagesHtml += `<li><a href="${p}" target="_blank" style="color: var(--primary); text-decoration: none;">${p}</a></li>`;
                }
            }
        }
        pagesHtml += '</ul>';

        if (results.analyzedPages.length === 1) {
            pagesHtml += '<div style="margin-top:4px; font-style:italic;">Páginas internas analizadas: ninguna.</div>';
        }
        
        if (results.candidatePages && results.candidatePages.length > 0) {
            pagesHtml += '<strong style="display:block; margin-top:8px;">Páginas internas candidatas detectadas:</strong><ul style="margin-top: 4px; padding-left: 16px; margin-bottom: 0;">';
            results.candidatePages.forEach(p => {
                try {
                    let pathname = new URL(p).pathname || p;
                    pagesHtml += `<li><a href="${p}" target="_blank" style="color: var(--primary); text-decoration: none;">${pathname}</a></li>`;
                } catch(e) {
                    pagesHtml += `<li><a href="${p}" target="_blank" style="color: var(--primary); text-decoration: none;">${p}</a></li>`;
                }
            });
            pagesHtml += '</ul>';
        }

        pagesList.innerHTML = pagesHtml;
    } else {
        pagesList.innerHTML = '';
    }
}

function exportToMarkdown(results, gmbData) {
    const btnExport = document.getElementById('btn-export');
    
    let md = `# Auditoría SEO Local: ${gmbData.name || 'Ficha'}\n\n`;
    md += `**Score de Coherencia:** ${results.score}/100 (${results.label})\n\n`;
    
    const mapItems = (items) => {
        return items.map(item => {
            let icon = 'ℹ️';
            if (item.status === 'success') icon = '✅';
            if (item.status === 'critical') icon = '🔴';
            if (item.status === 'medium') icon = '🟡';
            if (item.status === 'low') icon = '🔵';
            
            let line = `- ${icon} ${item.text}`;
            if (item.details) line += ` (*${item.details}*)`;
            return line;
        }).join('\n');
    };

    md += `## URL y Canonical\n${mapItems(results.url)}\n\n`;
    md += `## NAP (Nombre, Dirección, Teléfono)\n${mapItems(results.nap)}\n\n`;
    md += `## Schema Markup\n${mapItems(results.schema)}\n\n`;
    md += `## Categoría y Servicios\n${mapItems(results.services)}\n\n`;

    if (results.analyzedPages && results.analyzedPages.length > 0) {
        md += `## Páginas Analizadas\n`;
        const homeUrl = results.analyzedPages[0];
        md += `- Home: ${homeUrl}\n`;
        
        if (results.analyzedPages.length > 1) {
            for (let i = 1; i < results.analyzedPages.length; i++) {
                md += `- ${results.analyzedPages[i]}\n`;
            }
        } else {
            md += `\nPáginas internas analizadas: ninguna.\n`;
        }
        md += '\n';
        
        if (results.candidatePages && results.candidatePages.length > 0) {
            md += `**Páginas internas candidatas detectadas:**\n`;
            results.candidatePages.forEach(p => {
                md += `- ${p}\n`;
            });
            md += '\n';
        }
    }

    md += `---\n*Nota: Este análisis mide la coherencia básica entre la ficha de Google, la web enlazada y el schema detectado en la Home y en un rastreo limitado de páginas internas clave. No sustituye una auditoría SEO local completa.*\n`;

    navigator.clipboard.writeText(md).then(() => {
        const originalText = btnExport.innerHTML;
        btnExport.innerHTML = '✅ ¡Copiado al portapapeles!';
        setTimeout(() => btnExport.innerHTML = originalText, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Error al copiar al portapapeles.');
    });
}

function scoreInternalLink(url) {
    let path = '';
    try {
        path = new URL(url).pathname.toLowerCase();
    } catch(e) {
        path = url.toLowerCase();
    }
    
    if (/(contacto|contact)/i.test(path)) return 100;
    if (/(servicios|servicio|services|service)/i.test(path)) return 90;
    if (/(sobre|nosotros|quienes-somos|about)/i.test(path)) return 80;
    if (/(aviso-legal|legal)/i.test(path)) return 60;
    if (/(privacidad|privacy)/i.test(path)) return 50;
    
    return 0;
}
