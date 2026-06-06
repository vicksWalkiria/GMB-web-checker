function normalizeHost(host) {
    return host.replace(/^www\./, '').toLowerCase();
}

const html = require("fs").readFileSync("/var/www/html/victor-alonso.es/index.php", "utf8");
const rawHrefs = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/g)].map(m => m[1]);

let baseUrl = "https://www.victor-alonso.es/";
let baseObj = new URL(baseUrl);
const internal = new Set();

rawHrefs.forEach(rawHref => {
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

const internalLinks = Array.from(internal);
console.log("Internal links extracted:", internalLinks);

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

let candidateLinks = internalLinks
    .map(url => ({ url, score: scoreInternalLink(url) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.url);

console.log("Candidate links:", candidateLinks);
