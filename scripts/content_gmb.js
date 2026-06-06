function extractGMBData() {
    console.log("GMB-Web Extractor: Iniciando escaneo...");
    
    const data = {
        name: null,
        address: null,
        phone: null,
        category: null,
        website: null,
        url: window.location.href,
        isMaps: window.location.href.includes('google.com/maps')
    };

    try {
        // 1. Name
        const h1 = document.querySelector('h1');
        const searchTitle = document.querySelector('h2[data-attrid="title"], div[data-attrid="title"]');
        if (searchTitle) {
            data.name = searchTitle.innerText.trim();
        } else if (h1) {
            data.name = h1.innerText.trim();
        }

        // 2. Website
        const webLinks = Array.from(document.querySelectorAll('a'));
        const webLink = webLinks.find(a => 
            a.getAttribute('data-item-id') === 'authority' || 
            (a.getAttribute('aria-label') && a.getAttribute('aria-label').toLowerCase().includes('sitio web')) ||
            (a.innerText && a.innerText.toLowerCase() === 'sitio web') ||
            a.classList.contains('ab_button') && a.innerText.toLowerCase().includes('sitio web')
        );
        if (webLink) data.website = webLink.href;

        // 3. Phone
        const phoneButton = document.querySelectorAll('button[data-item-id^="phone:"]');
        if (phoneButton.length > 0) {
            data.phone = phoneButton[0].getAttribute('data-item-id').replace('phone:tel:', '');
        } else {
            // Heuristic search for Maps
            const buttons = Array.from(document.querySelectorAll('button, div'));
            const phoneEl = buttons.find(el => el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('teléfono'));
            if (phoneEl) {
                const match = phoneEl.getAttribute('aria-label').match(/[0-9 ]{9,}/);
                if (match) data.phone = match[0].trim();
            } else {
                // Heuristic search for Google Search Knowledge Panel
                const phoneSpan = Array.from(document.querySelectorAll('span, div')).find(el => el.innerText && el.innerText.match(/Teléfono:\s*([0-9\s]+)/i));
                if (phoneSpan) {
                    const match = phoneSpan.innerText.match(/Teléfono:\s*([0-9\s]+)/i);
                    if (match) data.phone = match[1].trim();
                }
            }
        }

        // 4. Address
        const addressButton = document.querySelector('button[data-item-id="address"]');
        if (addressButton) {
            data.address = addressButton.getAttribute('aria-label')?.replace('Dirección: ', '').trim();
        } else {
             const addrEl = Array.from(document.querySelectorAll('button')).find(el => el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('dirección'));
             if (addrEl) {
                 data.address = addrEl.getAttribute('aria-label').replace(/dirección: /i, '').trim();
             }
        }

        // 5. Category
        const catButtons = Array.from(document.querySelectorAll('button.fontBodyMedium'));
        if (catButtons.length > 0) {
            data.category = catButtons[0].innerText.trim();
        } else {
            // Google Search Knowledge Panel category
            const searchCat = document.querySelector('div[data-attrid="kc:/local:primary category"]');
            if (searchCat) {
                data.category = searchCat.innerText.trim();
            } else {
                 const catSpan = Array.from(document.querySelectorAll('span')).find(el => el.innerText && el.innerText.match(/Servicio de [a-zA-Z\s]+/i));
                 if(catSpan) data.category = catSpan.innerText.trim();
            }
        }

    } catch (e) {
        console.error("GMB-Web Extractor Error:", e);
    }

    return data;
}

// Return the result directly so executeScript can capture it
extractGMBData();
