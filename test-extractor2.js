const html = require("fs").readFileSync("/var/www/html/victor-alonso.es/index.php", "utf8");
const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/g)].map(m => m[1]);
console.log("Raw hrefs found:", links);
