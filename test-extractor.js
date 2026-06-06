const { JSDOM } = require("jsdom");

function normalizeHost(host) {
    return host.replace(/^www\./, '').toLowerCase();
}

function extractInternalLinks(html, baseUrl) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    let baseObj = new URL(baseUrl);
    const links = Array.from(doc.querySelectorAll('a[href]'));
    const internal = new Set();

    links.forEach(a => {
        const rawHref = a.getAttribute('href');
        if (!rawHref) return;
        const href = rawHref.trim();

        if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;

        try {
            let urlObj = new URL(href, baseUrl);
            if (normalizeHost(urlObj.hostname) === normalizeHost(baseObj.hostname)) {
                urlObj.hash = '';
                let cleanUrl = urlObj.href.split('?')[0];
                
                if (!cleanUrl.match(/\.(pdf|jpg|jpeg|png|gif|webp|svg|xml|json|css|js|zip)$/i)) {
                    internal.add(cleanUrl);
                }
            }
        } catch(e) { }
    });

    return Array.from(internal);
}

const html = require("fs").readFileSync("/var/www/html/victor-alonso.es/index.php", "utf8");
const links = extractInternalLinks(html, "https://www.victor-alonso.es/");
console.log("Internal Links:", links);
