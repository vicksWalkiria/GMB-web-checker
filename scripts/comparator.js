class Comparator {
    constructor(gmbData, webData) {
        this.gmb = gmbData;
        this.web = webData;
        this.results = {
            score: 0,
            maxScore: 100,
            nap: [],
            schema: [],
            services: []
        };
    }

    compare() {
        let earnedPoints = 0;
        let totalWeight = 0;

        const addResult = (category, weight, isMatch, text, details = '') => {
            totalWeight += weight;
            if (isMatch) earnedPoints += weight;
            
            let status = isMatch ? 'success' : 'error';
            // if weight is low, maybe just warning
            if (!isMatch && weight <= 10) status = 'warning';

            this.results[category].push({ status, text, details });
        };

        // --- NAP Analysis ---
        const gmbPhoneNorm = Normalizer.normalizePhone(this.gmb.phone);
        if (gmbPhoneNorm) {
            const phoneMatch = this.web.phones.includes(gmbPhoneNorm);
            addResult('nap', 20, phoneMatch, 
                phoneMatch ? 'Teléfono GMB encontrado en la web' : 'Teléfono GMB no encontrado en textos de la web',
                `GMB: ${this.gmb.phone}`
            );
        } else {
            addResult('nap', 0, false, 'No se pudo extraer teléfono de la ficha GMB', '', 'warning');
        }

        const gmbNameNorm = Normalizer.normalizeText(this.gmb.name);
        const webTitleNorm = Normalizer.normalizeText(this.web.title);
        const webH1Norm = Normalizer.normalizeText(this.web.h1);
        
        if (gmbNameNorm) {
            const nameInTitle = webTitleNorm.includes(gmbNameNorm);
            const nameInH1 = webH1Norm.includes(gmbNameNorm);
            addResult('nap', 20, nameInTitle || nameInH1,
                (nameInTitle || nameInH1) ? 'Nombre del negocio detectado en Title o H1' : 'Nombre del negocio ausente en Title/H1',
                `Title: ${this.web.title}`
            );
        }

        const gmbAddressNorm = Normalizer.normalizeAddress(this.gmb.address);
        const webTextNorm = Normalizer.normalizeText(this.web.texts);
        
        if (gmbAddressNorm && gmbAddressNorm.length > 5) {
            // Very naive check, in reality we'd need fuzzy matching or check for city
            const tokens = gmbAddressNorm.split(' ').filter(t => t.length > 4);
            const foundTokens = tokens.filter(t => webTextNorm.includes(t));
            const addressMatch = (foundTokens.length / tokens.length) >= 0.5;
            
            addResult('nap', 15, addressMatch,
                addressMatch ? 'Señales de dirección encontradas en la web' : 'Dirección GMB no parece mencionarse en la web',
                `GMB: ${this.gmb.address}`
            );
        }

        // --- Schema Analysis ---
        const localBusinessSchemas = this.web.jsonLd.filter(s => 
            s['@type'] === 'LocalBusiness' || 
            s['@type'] === 'ProfessionalService' ||
            s['@type'] === 'Organization'
        );

        if (localBusinessSchemas.length > 0) {
            addResult('schema', 15, true, 'Se detectó Schema LocalBusiness/Organization', `${localBusinessSchemas.length} schemas encontrados`);
            
            // Check Schema phone
            let schemaPhoneFound = false;
            localBusinessSchemas.forEach(s => {
                if (s.telephone && Normalizer.normalizePhone(s.telephone) === gmbPhoneNorm) schemaPhoneFound = true;
            });
            addResult('schema', 10, schemaPhoneFound,
                schemaPhoneFound ? 'Teléfono en Schema coincide con GMB' : 'Teléfono en Schema difiere o no existe',
                ''
            );

        } else {
            addResult('schema', 25, false, 'No se detectó Schema LocalBusiness ni Organization', 'Falta markup estructurado crítico');
        }

        // --- Services / Category ---
        const gmbCatNorm = Normalizer.normalizeText(this.gmb.category);
        if (gmbCatNorm) {
            const catInTitle = webTitleNorm.includes(gmbCatNorm);
            const catInH1 = webH1Norm.includes(gmbCatNorm);
            const catInText = webTextNorm.includes(gmbCatNorm);
            
            addResult('services', 10, catInTitle || catInH1,
                (catInTitle || catInH1) ? 'Categoría GMB aparece en Title/H1' : 'Categoría GMB ausente en Title/H1',
                `Categoría: ${this.gmb.category}`
            );

            addResult('services', 10, catInText,
                catInText ? 'Categoría GMB se menciona en los textos visibles' : 'Categoría GMB no se menciona en los textos',
                ''
            );
        }

        // Calculate final score
        this.results.score = Math.round((earnedPoints / Math.max(totalWeight, 1)) * 100);
        
        return this.results;
    }
}
