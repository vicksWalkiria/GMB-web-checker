# GMB-Web Coherence Checker

Extensión de Chrome de código abierto orientada a auditorías SEO Local avanzadas. Su objetivo principal es extraer los datos de una ficha de Google Business Profile (desde Google Maps o el panel de Google Search) y compararlos automáticamente con el código fuente de la página web oficial enlazada y sus páginas internas clave.

Esta herramienta responde a una pregunta clave en SEO local: **“¿Lo que Google entiende de este negocio local coincide técnicamente con lo que declara su web?”**

![Score de Coherencia y Auditoría](https://www.victor-alonso.es/assets/img/gmb-web-checker.webp)

## 🏗️ Arquitectura y Funcionamiento

La extensión se ha construido bajo el estándar **Manifest V3**, priorizando el rendimiento, la privacidad y la superación de bloqueos CORS. El flujo de ejecución es el siguiente:

1. **Inyección y Scraping (DOM):** Mediante `chrome.scripting`, se inyecta un script ligero en la pestaña activa de Google. Extrae de forma limpia el NAP (Nombre, Dirección, Teléfono), la Categoría principal y la URL oficial de la ficha.
2. **Descarga Web sin CORS:** El `Service Worker` realiza una petición HTTP GET a la web enlazada desde el contexto de la extensión, superando las restricciones CORS habituales.
3. **Mini-Crawler Interno Inteligente:** La extensión no se limita a la Home. Detecta todos los enlaces internos y los **puntúa semánticamente**. Prioriza el rastreo de páginas de `contacto`, `legal`, y páginas de `servicios` que coincidan geográficamente con la ciudad de la ficha GMB.
4. **Extracción Semántica:** Un analizador virtual extrae metaetiquetas (Title, H1, Canonical), textos visibles y parsea recursivamente cualquier bloque de Schema.org (`application/ld+json`).
5. **Cross-Validation y Scoring:** Se cruzan los datos normalizando textos y teléfonos. Las comparaciones de nombres y categorías utilizan un motor de compatibilidad semántica para evitar falsos negativos.

## ⚖️ Sistema de Scoring y Auditoría

El análisis categoriza las discrepancias para generar un *Score de Coherencia* útil, ponderado y 100% trazable (te indica exactamente en qué URL interna se encontró el dato):

*   🔴 **Críticos:** Teléfono contradictorio en Schema, ausencia total de NAP en toda la web, fallos en la URL final.
*   🟡 **Medios:** Categoría principal no reforzada en textos, falta de Schema o Schema incompleto.
*   🔵 **Bajos / Info:** Schema detectado en una página interna en lugar de la Home (recomendación de refuerzo), Meta Description pobre, o URLs Canonical mejorables.

## 🚀 Estado del Desarrollo

El desarrollo de la herramienta ha superado las fases fundamentales y es plenamente funcional en entornos de producción:

### ✅ Fases Completadas (1, 2 y 3)
- [x] Extracción robusta de datos desde ficha pública (Maps/Search).
- [x] Análisis sin bloqueos CORS de la URL enlazada y redirecciones finales.
- [x] Extracción de Title, H1, description, textos visibles, teléfonos y Schema.
- [x] Detección exhaustiva de entidades: `LocalBusiness`, `Organization`, `Service`, `sameAs`.
- [x] Rastreo concurrente de páginas internas clave (Home + Top 3 candidatas locales).
- [x] Motor de priorización semántica (Boost a páginas locales vs genéricas).
- [x] Score visual y panel de resultados detallado.
- [x] Exportación a Markdown profesional con trazabilidad de URLs.

### ⏳ Fase 4 — Recomendaciones Automáticas (Futuro)
- [ ] Proponer código Schema `LocalBusiness` corregido directamente en la extensión.
- [ ] Generar checklist accionable de implementación.
- [ ] Sugerencias de optimización para Title y H1.

## 📥 Instalación (Modo Desarrollador)

Al no estar publicada en la Chrome Web Store, su instalación se realiza manualmente:

1. Descarga el repositorio en `.zip` (botón verde `Code` > `Download ZIP`) y descomprímelo.
2. Abre Google Chrome o cualquier navegador Chromium y ve a `chrome://extensions/`.
3. Activa el **Modo Desarrollador** en la esquina superior derecha.
4. Haz clic en **Cargar descomprimida** y selecciona la carpeta donde extrajiste la extensión.

---
*Desarrollada por Víctor Alonso - Consultor SEO Técnico*
