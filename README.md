# GMB-Web Coherence Checker

Extensión de Chrome orientada a auditorías SEO Local. Su objetivo principal es extraer los datos de una ficha de Google My Business (desde Google Maps o el Knowledge Panel de Search) y compararlos automáticamente con el código fuente de la página web oficial enlazada.

Esta herramienta responde a una pregunta clave en SEO local: **“¿Lo que Google entiende de este negocio coincide con lo que declara su web?”**

## 🏗️ Arquitectura y Funcionamiento

La extensión se ha construido bajo el estándar **Manifest V3**, priorizando el rendimiento, la privacidad y la ausencia de bloqueos CORS. El flujo de ejecución es el siguiente:

1. **Inyección y Scraping (DOM):** Mediante `chrome.scripting`, se inyecta un script ligero en la pestaña activa de Google. Este script utiliza heurísticas, selectores CSS y Regex para extraer el NAP (Nombre, Dirección, Teléfono), la Categoría principal y la URL oficial directamente del DOM de la ficha.
2. **Descarga Web sin CORS:** El Service Worker realiza una petición HTTP GET a la web enlazada desde el contexto de la extensión. Gracias a los permisos de host (`<all_urls>`), puede descargar el HTML de dominios externos evitando las restricciones CORS habituales que tendría un script ejecutado dentro de una página web.
3. **Control de Bloqueos y Errores:** Si la web no devuelve HTML válido, responde con error HTTP, redirige varias veces o bloquea la petición (ej. Cloudflare), la extensión lo registra como una incidencia técnica independiente para no confundir un fallo de acceso con una ausencia real de datos SEO.
4. **Extracción Semántica:** Un analizador virtual (`DOMParser`) extrae las metaetiquetas (Title, H1, Canonical) y parsea recursivamente cualquier bloque de Schema.org (`application/ld+json`).
5. **Normalización y Fuzzy Matching:** Antes de cruzar los datos, se normalizan textos y teléfonos. Las comparaciones de nombres y categorías utilizan "Fuzzy Overlap" (superposición de tokens) para evitar falsos negativos por guiones o coletillas locales.

## ⚖️ Sistema de Scoring por Severidad

El análisis categoriza las discrepancias para generar un *Score de Coherencia* útil y ponderado:

*   🔴 **Críticos:** Teléfono o dirección distintos entre ficha y web, ausencia total de NAP en la web, Schema `LocalBusiness` con datos contradictorios.
*   🟡 **Medios:** Categoría principal no reforzada en Title/H1, falta de Schema `Service`, NAP visible pero ausente en el Schema.
*   🔵 **Bajos:** Falta de enlaces `sameAs` a redes sociales o directorios, Meta Description pobre, o URLs Canonical mejorables.

## 🚀 Roadmap de Desarrollo

El desarrollo de la herramienta está estructurado en 4 fases incrementales:

### Fase 1 — MVP (Completada)
- [x] Extraer datos desde ficha pública (Maps/Search).
- [x] Analizar la URL enlazada (Home).
- [x] Extraer Title, H1, description, teléfonos y Schema.
- [x] Comparar NAP mediante coincidencia difusa.
- [x] Score visual en Popup.

### Fase 2 — SEO Local Pro (Siguiente)
- [ ] Analizar canonical y redirección final (ej. `http://` a `https://www.`).
- [ ] Detección exhaustiva de entidades: `LocalBusiness`, `Organization`, `Service`, `sameAs`.
- [ ] Clasificación estricta de errores por severidad.
- [ ] Exportar informe al portapapeles o PDF para clientes.

### Fase 3 — Crawling Ligero
- [ ] Rastreo de páginas clave: `/contacto`, `/servicios`, `/sobre-nosotros`.
- [ ] Búsqueda de NAP distribuido en varias URLs.
- [ ] Detección de arquitectura local y silos.

### Fase 4 — Recomendaciones Automáticas
- [ ] Proponer código Schema `LocalBusiness` corregido.
- [ ] Sugerencias de optimización para Title y H1.
- [ ] Generar checklist accionable de implementación.

---
*Herramienta de uso interno para auditorías SEO locales rápidas y eficientes.*
