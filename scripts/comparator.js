class Comparator {
    constructor(gmbData, webData) {
        this.gmb = gmbData;
        this.web = webData; // includes html, finalUrl, redirected, status, error, isBlocked, and extracted data
        this.results = {
            score: 100,
            label: 'Excelente',
            nap: [],
            schema: [],
            url: [],
            services: []
        };
    }

    compare() {
        let penalties = 0;

        const addResult = (category, severity, isMatch, textSuccess, textFail, details = '') => {
            let status = 'success';
            let text = textSuccess;

            if (!isMatch) {
                status = severity;
                text = textFail;
                
                if (severity === 'critical') penalties += 30;
                else if (severity === 'medium') penalties += 10;
                else if (severity === 'low') penalties += 5;
            }

            this.results[category].push({ status, text, details });
        };

        const checkOverlap = (str1, str2) => {
            if (!str1 || !str2) return false;
            const t1 = str1.split(' ').filter(x => x.length > 2);
            const t2 = str2.split(' ').filter(x => x.length > 2);
            if (t1.length === 0) return false;
            let matches = 0;
            for(let w of t1) {
                if (t2.includes(w)) matches++;
            }
            return (matches / t1.length) >= 0.4;
        };

        // --- 1. BLOQUEOS Y URL / CANONICAL ---
        if (!this.gmb.website) {
             addResult('url', 'critical', false, '', 'La ficha no tiene web enlazada', '');
             // Fast fail if no web
             this.results.score = 0;
             this.results.label = 'Problemas graves de coherencia local';
             return this.results;
        }

        if (this.web.isBlocked) {
            addResult('url', 'critical', false, '', `La web no es accesible o está bloqueada (${this.web.error || 'Error HTTP'})`, `URL: ${this.gmb.website}`);
            this.results.score = 0;
            this.results.label = 'Problemas graves de coherencia local';
            return this.results;
        }

        if (this.web.redirected) {
             addResult('url', 'info', false, '', 'La URL final redirige desde la enlazada en la ficha', `Ficha: ${this.gmb.website} -> Final: ${this.web.finalUrl}`);
        } else {
             addResult('url', 'success', true, 'La URL de la ficha carga sin redirecciones', '', `URL: ${this.web.finalUrl}`);
        }

        if (this.web.canonical) {
             // Basic canonical match check
             const cNorm = this.web.canonical.replace(/\/$/, '');
             const fNorm = this.web.finalUrl.replace(/\/$/, '');
             const canonicalMatch = cNorm === fNorm || fNorm.includes(cNorm);
             addResult('url', 'medium', canonicalMatch, 
                 'El canonical coincide con la URL final', 
                 'El canonical no coincide con la URL final', 
                 `Canonical: ${this.web.canonical}`
             );
        } else {
             addResult('url', 'low', false, '', 'No se detecta etiqueta canonical en la web', '');
        }

        // --- 2. NAP ---
        const gmbPhoneNorm = Normalizer.normalizePhone(this.gmb.phone);
        const gmbNameNorm = Normalizer.normalizeText(this.gmb.name);
        const gmbAddressNorm = Normalizer.normalizeAddress(this.gmb.address);
        const webTextNorm = Normalizer.normalizeText(this.web.texts);

        // Name
        if (gmbNameNorm) {
            const webTitleNorm = Normalizer.normalizeText(this.web.title);
            const webH1Norm = Normalizer.normalizeText(this.web.h1);
            const nameInTitle = checkOverlap(gmbNameNorm, webTitleNorm);
            const nameInH1 = checkOverlap(gmbNameNorm, webH1Norm);
            addResult('nap', 'medium', nameInTitle || nameInH1,
                'Nombre del negocio (o parte) detectado en Title o H1', 
                'Nombre del negocio ausente en Title/H1',
                `Title: ${this.web.title}`
            );
        }

        // Phone
        let phoneInWeb = false;
        if (gmbPhoneNorm) {
            phoneInWeb = this.web.phones.includes(gmbPhoneNorm);
            addResult('nap', 'critical', phoneInWeb, 
                'Teléfono GMB encontrado en textos de la web', 
                'Teléfono GMB no encontrado en textos de la web',
                `GMB: ${this.gmb.phone}`
            );
        }

        // Address
        let addressInWeb = false;
        if (gmbAddressNorm && gmbAddressNorm.length > 5) {
            const tokens = gmbAddressNorm.split(' ').filter(t => t.length > 4);
            if(tokens.length > 0) {
                const foundTokens = tokens.filter(t => webTextNorm.includes(t));
                addressInWeb = (foundTokens.length / tokens.length) >= 0.5;
                addResult('nap', 'critical', addressInWeb,
                    'Señales de dirección de GMB encontradas en textos web', 
                    'Dirección GMB no parece mencionarse en la web',
                    `GMB: ${this.gmb.address}`
                );
            }
        }

        // --- 3. SCHEMA ---
        const schemas = this.web.jsonLd || [];
        const hasSchemaType = (type) => schemas.some(s => {
            const types = Array.isArray(s['@type']) ? s['@type'] : [s['@type']];
            return types.includes(type);
        });

        const localBusinessSchemas = schemas.filter(s => {
            const types = Array.isArray(s['@type']) ? s['@type'] : [s['@type']];
            return types.some(t => t === 'LocalBusiness' || t === 'ProfessionalService' || t === 'Organization');
        });

        const hasLocalBusiness = hasSchemaType('LocalBusiness') || hasSchemaType('ProfessionalService');
        const hasOrganization = hasSchemaType('Organization');
        const hasService = hasSchemaType('Service');

        if (hasOrganization && !hasLocalBusiness) {
             addResult('schema', 'medium', false, '', 'Hay schema Organization pero no LocalBusiness', '');
        }

        if (localBusinessSchemas.length > 0) {
            addResult('schema', 'success', true, 'Se detectó Schema de negocio (LocalBusiness/Organization)', `${localBusinessSchemas.length} entidades encontradas`);
            
            // Analyze the primary local business schema
            const primarySchema = localBusinessSchemas[0];
            
            // Phone in schema
            let schemaPhoneFound = false;
            let contradictoryPhone = false;
            localBusinessSchemas.forEach(s => {
                if (s.telephone) {
                    const sPhone = Normalizer.normalizePhone(s.telephone);
                    if (sPhone === gmbPhoneNorm) schemaPhoneFound = true;
                    else contradictoryPhone = true;
                }
            });

            if (gmbPhoneNorm) {
                if (schemaPhoneFound) {
                     addResult('schema', 'success', true, 'Teléfono en Schema coincide con GMB', '');
                } else if (contradictoryPhone) {
                     addResult('schema', 'critical', false, '', 'El Schema declara un teléfono contradictorio a GMB', '');
                } else if (phoneInWeb) {
                     addResult('schema', 'medium', false, '', 'Teléfono visible en la web, pero ausente en el Schema', '');
                }
            }

            // Address in schema (naive check)
            if (gmbAddressNorm) {
                let schemaAddressFound = false;
                localBusinessSchemas.forEach(s => {
                     if (s.address) schemaAddressFound = true; // just checking existence to avoid complex object parsing for now
                });
                if(!schemaAddressFound && addressInWeb) {
                     addResult('schema', 'medium', false, '', 'Dirección visible en la web, pero ausente en el Schema', '');
                }
            }

            // Missing low severity props
            if (!primarySchema.image && !primarySchema.logo) addResult('schema', 'low', false, '', 'Falta image/logo en schema LocalBusiness', '');
            if (!primarySchema.priceRange) addResult('schema', 'low', false, '', 'Falta priceRange en schema LocalBusiness', '');
            if (!primarySchema.openingHours && !primarySchema.openingHoursSpecification) addResult('schema', 'low', false, '', 'Faltan horarios (openingHours) en schema LocalBusiness', '');
            if (!primarySchema.areaServed) addResult('schema', 'low', false, '', 'Falta areaServed en schema LocalBusiness', '');

            // sameAs check
            let hasSameAs = false;
            localBusinessSchemas.forEach(s => {
                if (s.sameAs && (Array.isArray(s.sameAs) ? s.sameAs.length > 0 : typeof s.sameAs === 'string')) {
                    hasSameAs = true;
                }
            });
            if (hasSameAs) {
                addResult('schema', 'success', true, 'Se detectaron perfiles sameAs en el schema', '');
            } else {
                addResult('schema', 'low', false, '', 'No se detectan redes sociales o perfiles externos en sameAs', '');
            }

        } else {
            addResult('schema', 'critical', false, '', 'No se detectó Schema LocalBusiness ni Organization', 'Falta markup estructurado crítico');
        }

        if (!hasService) {
             addResult('schema', 'medium', false, '', 'Falta schema Service (Recomendado para definir los servicios)', '');
        }

        // --- 4. CATEGORÍA / SERVICIOS ---
        const gmbCatNorm = Normalizer.normalizeText(this.gmb.category);
        if (gmbCatNorm) {
            const webTitleNorm = Normalizer.normalizeText(this.web.title);
            const webH1Norm = Normalizer.normalizeText(this.web.h1);
            
            const catInTitle = checkOverlap(gmbCatNorm, webTitleNorm);
            const catInH1 = checkOverlap(gmbCatNorm, webH1Norm);
            const catInText = checkOverlap(gmbCatNorm, webTextNorm);
            
            addResult('services', 'medium', catInTitle || catInH1,
                'Categoría GMB reforzada en Title o H1', 
                'Categoría principal no reforzada en Title ni H1',
                `Categoría GMB: ${this.gmb.category}`
            );

            if (catInText) {
                addResult('services', 'success', true, 'Categoría GMB mencionada en textos visibles', '');
            } else {
                addResult('services', 'low', false, '', 'Categoría GMB tampoco se menciona en textos visibles', '');
            }
        }

        // Meta Description
        const metaDesc = this.web.metaDescription || '';
        if (metaDesc.length < 50) {
            addResult('services', 'low', false, '', 'Meta description pobre o ausente', '');
        } else if (gmbAddressNorm) {
            // Rough check for local intent in meta desc
            const cities = ['madrid', 'barcelona', 'valencia', 'sevilla', 'zaragoza', 'malaga', 'murcia', 'palma', 'bilbao', 'alicante', 'cordoba', 'valladolid', 'vigo', 'gijon', 'hospitalet', 'vitoria', 'coruña', 'granada', 'elche', 'oviedo', 'badalona', 'terrassa', 'cartagena', 'jerez', 'sabadell', 'mostoles', 'pamplona', 'almeria', 'alcala', 'fuenlabrada', 'leganes', 'donostia', 'getafe', 'burgos', 'albacete', 'santander', 'castellon'];
            const metaNorm = Normalizer.normalizeText(metaDesc);
            const hasLocal = cities.some(c => metaNorm.includes(c)) || (this.gmb.address && cities.some(c => Normalizer.normalizeText(this.gmb.address).includes(c) && metaNorm.includes(c)));
            
            if (!hasLocal) {
                addResult('services', 'low', false, '', 'La meta description no parece reforzar una ubicación local explícita', `Desc: ${metaDesc}`);
            }
        }

        // --- CALCULAR SCORE FINAL ---
        let finalScore = 100 - penalties;
        if (finalScore < 0) finalScore = 0;
        this.results.score = finalScore;

        if (finalScore >= 85) this.results.label = 'Excelente';
        else if (finalScore >= 70) this.results.label = 'Bueno / Mejorable';
        else if (finalScore >= 50) this.results.label = 'Riesgo medio';
        else this.results.label = 'Problemas graves de coherencia local';
        
        return this.results;
    }
}
