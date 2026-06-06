class WebExtractor {
    constructor(htmlString, url) {
        this.html = htmlString;
        this.url = url;
        const parser = new DOMParser();
        this.doc = parser.parseFromString(htmlString, 'text/html');
    }

    extract() {
        return {
            title: this.doc.title || '',
            metaDescription: this.getMeta('description'),
            canonical: this.getCanonical(),
            h1: this.getH1(),
            jsonLd: this.getJsonLd(),
            phones: this.extractPhones(),
            texts: this.getVisibleText()
        };
    }

    getMeta(name) {
        const meta = this.doc.querySelector(`meta[name="${name}"i]`);
        return meta ? meta.getAttribute('content') : '';
    }

    getCanonical() {
        const link = this.doc.querySelector('link[rel="canonical"i]');
        return link ? link.getAttribute('href') : '';
    }

    getH1() {
        const h1s = Array.from(this.doc.querySelectorAll('h1'));
        return h1s.map(h => h.innerText.trim()).join(' | ');
    }

    getJsonLd() {
        const scripts = Array.from(this.doc.querySelectorAll('script[type="application/ld+json"]'));
        const schemas = [];
        
        scripts.forEach(script => {
            try {
                const parsed = JSON.parse(script.innerText);
                // Handle both single objects and arrays of schemas
                if (Array.isArray(parsed)) {
                    schemas.push(...parsed);
                } else if (parsed['@graph']) {
                    schemas.push(...parsed['@graph']);
                } else {
                    schemas.push(parsed);
                }
            } catch (e) {
                console.warn('Error parsing JSON-LD', e);
            }
        });

        return schemas;
    }

    extractPhones() {
        // Regex for Spanish phones and general international formats
        const bodyText = this.doc.body.innerText;
        const regex = /(?:\+34|0034|34)?[\s-]*([6789][0-9]{2}[\s-]*[0-9]{3}[\s-]*[0-9]{3})/g;
        const matches = [...bodyText.matchAll(regex)];
        return [...new Set(matches.map(m => m[1].replace(/[\s-]/g, '')))];
    }

    getVisibleText() {
        // Just a basic heuristic, grabbing headers and p tags
        const elements = Array.from(this.doc.querySelectorAll('h1, h2, h3, p, li, a'));
        return elements.map(el => el.innerText.trim()).join(' ').substring(0, 10000); // Limit to avoid huge string
    }

    normalizeHost(host) {
        return host.replace(/^www\./, '').toLowerCase();
    }

    extractInternalLinks(baseUrl) {
        if (!baseUrl) return [];
        let baseObj;
        try {
            baseObj = new URL(baseUrl);
        } catch(e) { return []; }

        const links = Array.from(this.doc.querySelectorAll('a[href]'));
        const internal = new Set();

        links.forEach(a => {
            const rawHref = a.getAttribute('href');
            if (!rawHref) return;
            const href = rawHref.trim();

            if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;

            try {
                let urlObj = new URL(href, baseUrl); // Fix relative urls by using full baseUrl
                if (this.normalizeHost(urlObj.hostname) === this.normalizeHost(baseObj.hostname)) {
                    urlObj.hash = '';
                    let cleanUrl = urlObj.href.split('?')[0]; // Remove query params
                    
                    if (!cleanUrl.match(/\.(pdf|jpg|jpeg|png|gif|webp|svg|xml|json|css|js|zip)$/i)) {
                        internal.add(cleanUrl);
                    }
                }
            } catch(e) { }
        });

        return Array.from(internal);
    }
}
