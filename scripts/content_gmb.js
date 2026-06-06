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
        if (h1) data.name = h1.innerText.trim();

        // 2. Website
        // Maps often has a link with data-item-id="authority" or aria-label="Sitio web"
        const webLinks = Array.from(document.querySelectorAll('a'));
        const webLink = webLinks.find(a => 
            a.getAttribute('data-item-id') === 'authority' || 
            (a.getAttribute('aria-label') && a.getAttribute('aria-label').toLowerCase().includes('sitio web')) ||
            (a.innerText && a.innerText.toLowerCase().includes('sitio web'))
        );
        if (webLink) data.website = webLink.href;

        // 3. Phone
        // Using aria-labels and regex heuristics
        const phoneButton = document.querySelectorAll('button[data-item-id^="phone:"]');
        if (phoneButton.length > 0) {
            const phoneStr = phoneButton[0].getAttribute('data-item-id').replace('phone:tel:', '');
            data.phone = phoneStr;
        } else {
            // Heuristic search
            const phoneRegex = /(?:\+34|0034|34)?[ -]*(?:6|7|8|9)[0-9]{2}[ -]*[0-9]{3}[ -]*[0-9]{3}/; // Spanish pattern roughly
            const buttons = Array.from(document.querySelectorAll('button, div'));
            const phoneEl = buttons.find(el => el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('teléfono'));
            if (phoneEl) {
                const match = phoneEl.getAttribute('aria-label').match(/[0-9 ]{9,}/);
                if (match) data.phone = match[0].trim();
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
        // Usually a button next to the rating
        const catButtons = Array.from(document.querySelectorAll('button.fontBodyMedium'));
        if (catButtons.length > 0) {
            data.category = catButtons[0].innerText.trim();
        }

    } catch (e) {
        console.error("GMB-Web Extractor Error:", e);
    }

    return data;
}

// Return the result directly so executeScript can capture it
extractGMBData();
