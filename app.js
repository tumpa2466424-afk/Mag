import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, increment, addDoc, collection, deleteDoc, getDocs, query, orderBy, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

        // --- КОНФИГУРАЦИЯ FIREBASE ---
        const firebaseConfig = {
            apiKey: "AIzaSyDoqPrYFegCZRyTlrqbZe7VZoChdW_lS4g",
            authDomain: "locus-coffee.firebaseapp.com",
            projectId: "locus-coffee",
            storageBucket: "locus-coffee.firebasestorage.app",
            messagingSenderId: "539438290999",
            appId: "1:539438290999:web:eb6d5a2090d811bcf2c7b2",
            measurementId: "G-WT6BE6YS1F"
        };

        const ROBOKASSA_LOGIN = "LocusCoffee"; 
        const ROBOKASSA_PASS1 = "VB3Js1HjXRqp5ahHe4p7"; 
        const ROBOKASSA_PASS2 = "j4zmL54MKN0SZ7tRiufa"; 

        let app, auth, db;
        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
        } catch (e) { console.error("Ошибка инициализации Firebase:", e); }

        // Обновленная ссылка на Yandex Cloud Function вместо Google Sheets
        const YANDEX_FUNCTION_URL = "https://functions.yandexcloud.net/d4ekgff0csfc77v2nu5q";

        const LOCUS_API_URL = "https://functions.yandexcloud.net/d4ehpa8o948vden3i9ba";
        
        const CATEGORY_COLORS = { 'Эспрессо': '#B66A58', 'Фильтр': '#7A8F7C', 'Ароматизация': '#C09F80' };

        const CATEGORY_DESCRIPTIONS = {
            'ЭСПРЕССО': 'В этой категории собраны сорта и смеси, которые подойдут для приготовления в эспрессо, турке, гейзере и другими способами. Идеально под молоко.',
            'ФИЛЬТР': 'В этой категории собраны сорта и смеси, которые подойдут для приготовления в любых фильтровых способах: воронки, аэропресс, капельные.',
            'АРОМАТИЗАЦИЯ': 'Десертные сорта с мягкой ароматизацией. Применяются кондитерские ароматизаторы. Идеальный выбор для тех, кто хочет разнообразить кофейную рутину новыми яркими ароматами.'
        };
        
        const SCA_CSV_MAP = {
            'blackberry': [62, 3, 23], 'raspberry': [229, 41, 104], 'blueberry': [100, 106, 160], 'strawberry': [239, 45, 60],
            'chocolate': [105, 42, 25], 'dark chocolate': [71, 6, 4], 'caramel': [210, 119, 42], 'nutty': [167, 117, 77],
            'floral': [224, 113, 156], 'citrus': [247, 163, 41], 'apple': [50, 160, 57],
             'ягод': [225, 40, 59], 'клубн': [239, 45, 60], 'малин': [229, 41, 104], 'черни': [100, 106, 160], 'смород': [62, 3, 23],
             'шоколад': [105, 42, 25], 'орех': [167, 117, 77], 'карамел': [210, 119, 42], 'цвет': [224, 113, 156]
        };

        function hexToRgbArr(hex) {
            const bigint = parseInt(hex.replace('#', ''), 16);
            return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
        }

        function rgbArrToHex(rgb) {
            return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
        }

        function mixFlavorColors(text, defaultHex) {
            if(!text) return defaultHex;
            const lower = text.toLowerCase();
            let foundRgbs = [];
            for (const [key, rgb] of Object.entries(SCA_CSV_MAP)) {
                if (lower.includes(key)) foundRgbs.push(rgb);
            }
            if (foundRgbs.length === 0) return defaultHex;
            let r = 0, g = 0, b = 0;
            foundRgbs.forEach(col => { r += col[0]; g += col[1]; b += col[2]; });
            r = Math.round(r / foundRgbs.length);
            g = Math.round(g / foundRgbs.length);
            b = Math.round(b / foundRgbs.length);
            return rgbArrToHex([r, g, b]);
        }

        let ALL_PRODUCTS_CACHE = [];
        let SHOP_DATA = [
            { id: 'espresso', label: 'ЭСПРЕССО', color: CATEGORY_COLORS['Эспрессо'], desc: CATEGORY_DESCRIPTIONS['ЭСПРЕССО'], children: [] },
            { id: 'filter', label: 'ФИЛЬТР', color: CATEGORY_COLORS['Фильтр'], desc: CATEGORY_DESCRIPTIONS['ФИЛЬТР'], children: [] },
            { id: 'aroma', label: 'АРОМАТИЗАЦИЯ', color: CATEGORY_COLORS['Ароматизация'], desc: CATEGORY_DESCRIPTIONS['АРОМАТИЗАЦИЯ'], children: [] }
        ];

        let rotation = 0, isDragging = false, lastAngle = 0, velocity = 0, lastTime = Date.now();
        let zone = null, spinnerElem = null;
        let mapInstance = null, mapMarker = null;
        let currentActiveProduct = null;
        let currentWeight = 250;
        let currentGrind = "Зерно";

        function getAngle(clientX, clientY) {
            if (!zone) return 0;
            const rect = zone.getBoundingClientRect();
            const centerX = rect.left; 
            const centerY = rect.top + rect.height / 2;
            return Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;
        }

        const moveH = (clientX, clientY) => {
            if (!isDragging) return;
            const curA = getAngle(clientX, clientY);
            const delta = curA - lastAngle;
            rotation += delta;
            const now = Date.now();
            const dt = now - lastTime;
            if (dt > 0) velocity = delta / (dt / 16);
            lastAngle = curA; lastTime = now;
        };

        function getScale(valStr) {
            const val = Math.round(parseFloat(valStr)) || 0;
            let html = '<div class="intensity-scale">';
            for(let g=0; g<3; g++) {
                html += '<div class="scale-group">';
                for(let c=1; c<=5; c++) {
                    const id = (g * 5) + c;
                    const isSelected = id === val;
                    const activeClass = isSelected ? 'active' : '';
                    let textColor = 'var(--locus-dark)';
                    if(id >= 8) textColor = 'var(--locus-bg)';
                    let cellContent = isSelected ? `<span style="color: ${textColor}">${id}</span>` : '';
                    if (id === 1 && !isSelected) cellContent = `<span style="color: var(--locus-dark); opacity: 0.5;">1</span>`;
                    if (id === 15 && !isSelected) cellContent = `<span style="color: var(--locus-bg); opacity: 0.5;">15</span>`;
                    html += `<div class="scale-cell c-${id} ${activeClass}">${cellContent}</div>`;
                }
                html += '</div>';
            }
            html += '</div>';
            return html;
        }

        const pInfo = document.getElementById('product-info'), dMsg = document.getElementById('default-msg');

        window.resetInfo = function() {
            const svg = document.querySelector('#wheel-spinner svg');
            if (svg) svg.querySelectorAll('path').forEach(p => p.classList.remove('selected'));
            pInfo.classList.remove('active');
            setTimeout(() => { pInfo.style.display = 'none'; dMsg.style.display = 'block'; setTimeout(() => dMsg.classList.add('active'), 50); }, 250);
            currentActiveProduct = null;
        };

        function updatePriceDisplay() {
            if(!currentActiveProduct) return;
            
            // 1. ИЩЕМ ПОЛНЫЕ ДАННЫЕ В КЭШЕ
            const sampleName = currentActiveProduct.sample_no || currentActiveProduct.sample;
            let rawGreen = 0;
            
            if (typeof ALL_PRODUCTS_CACHE !== 'undefined') {
                const fullProduct = ALL_PRODUCTS_CACHE.find(p => p.sample === sampleName || p.sample_no === sampleName);
                if (fullProduct) {
                    rawGreen = parseFloat(fullProduct.rawGreenPrice || fullProduct.raw_green_price) || 0;
                }
            }
            
            // 2. СЧИТАЕМ РОЗНИЧНУЮ ЦЕНУ
            let basePrice = 0;
            if (typeof UserSystem !== 'undefined' && UserSystem.calculateRetailPrices) {
                const prices = UserSystem.calculateRetailPrices(rawGreen);
                basePrice = currentWeight === 1000 ? prices.p1000 : prices.p250;
            }
            
            // 3. УЧИТЫВАЕМ СКИДКУ ПОКУПАТЕЛЯ
            let userDiscount = 0;
            if(typeof UserSystem !== 'undefined' && UserSystem.currentUser && UserSystem.currentUser.totalSpent) {
                 userDiscount = Math.floor((UserSystem.currentUser.totalSpent || 0) / 3000);
                 if(userDiscount > 10) userDiscount = 10;
            }
            
            const finalPrice = Math.floor(basePrice * (1 - userDiscount/100));
            // Подписка: базовая цена минус 50 рублей (или любая твоя скидка)
            const subPrice = basePrice > 50 ? basePrice - 50 : basePrice;

            // 4. БЕЗОПАСНЫЙ ВЫВОД В ИНТЕРФЕЙС
            const cartPriceEl = document.getElementById('p-price-cart');
            if(cartPriceEl) {
                if(userDiscount > 0 && basePrice > 0) {
                    cartPriceEl.innerHTML = `<span style="text-decoration:line-through; opacity:0.6; font-size:10px;">${basePrice}</span> ${finalPrice} ₽`;
                } else {
                    cartPriceEl.textContent = basePrice > 0 ? basePrice + ' ₽' : '0 ₽';
                }
            }
            
            const subPriceEl = document.getElementById('p-price-sub');
            if(subPriceEl) {
                subPriceEl.textContent = subPrice > 0 ? subPrice + ' ₽' : '0 ₽'; 
            }
            
            const cartBtn = document.getElementById('btn-cart');
            if(cartBtn) {
                cartBtn.href = `#order:${sampleName}_${currentWeight}g=${finalPrice}`;
            }
        }

        function updateInfo(seg) {
            dMsg.classList.remove('active'); pInfo.classList.remove('active');
            
            const detailBlock = document.getElementById('detailed-stats-block');
            const toggleBtn = document.getElementById('btn-toggle-details');
            if(detailBlock) detailBlock.style.display = 'none';
            if(toggleBtn) {
                toggleBtn.classList.remove('open');
                toggleBtn.querySelector('span').textContent = 'Подробное описание';
            }

            const extBlock = document.getElementById('extrinsic-stats-block');
            const toggleExtBtn = document.getElementById('btn-toggle-extrinsic');
            if(extBlock) extBlock.style.display = 'none';
            if(toggleExtBtn) {
                toggleExtBtn.classList.remove('open');
                toggleExtBtn.querySelector('span').textContent = 'Внешнее описание';
            }

            const aiBlock = document.getElementById('ai-story-block');
            const toggleAiBtn = document.getElementById('btn-toggle-ai');
            if(aiBlock) aiBlock.style.display = 'none';
            if(toggleAiBtn) toggleAiBtn.classList.remove('open');

            setTimeout(() => {
                dMsg.style.display = 'none';
                if(seg.depth === 1) {
                    const r = seg.raw;
                    currentActiveProduct = r;
                    currentWeight = 250; 
                    
                    currentGrind = "Зерно";
                    document.querySelectorAll('.grind-btn').forEach(b => {
                        b.classList.remove('active');
                        if(b.dataset.grind === "Зерно") b.classList.add('active');
                    });

                    document.querySelectorAll('.weight-option').forEach(el => el.classList.remove('selected'));
                    document.querySelector('.weight-option[data-w="250"]').classList.add('selected');

                    document.getElementById('p-title').textContent = r.sample;
                    document.getElementById('p-cat-desc').textContent = '';
                    
                    const roastVal = parseInt(r.roast) || 0;
                    let roastLabel = "Средняя обжарка";
                    if (roastVal < 5) roastLabel = "Светлая обжарка";
                    else if (roastVal > 10) roastLabel = "Темная обжарка";
                    document.getElementById('p-simple-desc').innerHTML = `${r.flavorDesc || ''}.<br>${roastLabel}.`;

                    const isAroma = (r.category && r.category.toLowerCase().includes('ароматизация'));
                    
                    if (isAroma) {
                        document.getElementById('p-mini-stats').innerHTML = ''; 
                        document.getElementById('p-mini-stats').style.display = 'none';
                        if(toggleBtn) toggleBtn.style.display = 'none';
                        if(toggleExtBtn) toggleExtBtn.style.display = 'none';
                        document.getElementById('grind-selector-block').style.display = 'none';
                    } else {
                        document.getElementById('p-mini-stats').style.display = 'grid';
                        const miniStatsHTML = `
                            <div class="mini-stats-grid">
                                <div class="mini-stat-item"><div class="mini-stat-label">Букет</div>${getScale(r.flavorInt)}</div>
                                <div class="mini-stat-item"><div class="mini-stat-label">Кислотность</div>${getScale(r.acidInt)}</div>
                                <div class="mini-stat-item"><div class="mini-stat-label">Сладость</div>${getScale(r.sweetInt)}</div>
                                <div class="mini-stat-item"><div class="mini-stat-label">Тело</div>${getScale(r.bodyInt)}</div>
                            </div>
                        `;
                        document.getElementById('p-mini-stats').innerHTML = miniStatsHTML;
                        if(toggleBtn) toggleBtn.style.display = 'flex';
                        if(toggleExtBtn) toggleExtBtn.style.display = 'flex';
                        document.getElementById('grind-selector-block').style.display = 'block';
                    }

                    document.getElementById('p-buy-area').style.display = 'flex';
                    updatePriceDisplay();
                    
                    const grid = document.getElementById('cupping-data');
                    if (grid) grid.innerHTML = `
                        <div class="cupping-item full-width"><span class="cupping-label">Дата каппинга</span><span class="cupping-value">${r.cuppingDate || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Степень обжарки</span>${getScale(r.roast)}</div>
                        
                        <div class="cupping-item"><span class="cupping-label">Интенсивность запаха</span>${getScale(r.smellInt)}</div>
                        <div class="cupping-item"><span class="cupping-label">Интенсивность аромата</span>${getScale(r.aromaInt)}</div>
                        <div class="cupping-item full-width"><span class="cupping-label">Описание запаха и аромата</span><span class="cupping-value">${r.aromaDesc || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о запахе и аромате</span><span class="cupping-notes">${r.aromaNotes || '-'}</span></div>
                        
                        <div class="cupping-item"><span class="cupping-label">Интенсивность букета</span>${getScale(r.flavorInt)}</div>
                        <div class="cupping-item"><span class="cupping-label">Интенсивность послевкусия</span>${getScale(r.atInt)}</div>
                        <div class="cupping-item full-width"><span class="cupping-label">Описание букета</span><span class="cupping-value">${r.flavorDesc || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Основные вкусы</span><span class="cupping-value flavor-text">${r.mainFlavors || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о букете и послевкусии</span><span class="cupping-notes">${r.flavorNotes || '-'}</span></div>
                        
                        <div class="cupping-item full-width"><span class="cupping-label">Интенсивность кислотности</span>${getScale(r.acidInt)}</div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о кислотности</span><span class="cupping-notes">${r.acidNotes || '-'}</span></div>
                        
                        <div class="cupping-item full-width"><span class="cupping-label">Интенсивность сладости</span>${getScale(r.sweetInt)}</div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о сладости</span><span class="cupping-notes">${r.sweetNotes || '-'}</span></div>
                        
                        <div class="cupping-item full-width"><span class="cupping-label">Интенсивность тактильности</span>${getScale(r.bodyInt)}</div>
                        <div class="cupping-item full-width"><span class="cupping-label">Описание тактильности</span><span class="cupping-value">${r.bodyDesc || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о тактильности</span><span class="cupping-notes">${r.bodyNotes || '-'}</span></div>
                    `;

                    // НОВЫЙ БЛОК: ВНЕШНЕЕ ОПИСАНИЕ (Extrinsic Data на Русском)
                    const extGrid = document.getElementById('extrinsic-data');
                    if (extGrid) {
                        let eHtml = '';
                        const addE = (lbl, val) => {
                            if(val && val !== '+' && String(val).trim() !== '') {
                                eHtml += `<div class="cupping-item full-width"><span class="cupping-label">${lbl}</span><span class="cupping-value">${val}</span></div>`;
                            }
                        };
                        const addEBool = (lbl, val) => {
                            if(val && val !== '-' && String(val).trim() !== '') {
                                const displayVal = (val === '+' || val === 'true' || val === '1') ? 'Да' : val;
                                eHtml += `<div class="cupping-item full-width"><span class="cupping-label">${lbl}</span><span class="cupping-value">${displayVal}</span></div>`;
                            }
                        };

                       // --- СЕКЦИЯ 1: FARMING ---
                        addE('Страна', r.country);
                        addE('Регион', r.region);
                        addE('Ферма / Кооператив', r.farm);
                        addE('Производитель', r.producer);
                        addE('Вид / Разновидность', r.variety);
                        addE('Год урожая', r.harvest);
                        addE('Другое (Фермерство)', r.otherFarming);

                        // --- СЕКЦИЯ 2: PROCESSING ---
                        addE('Обработчик', r.processor);
                        addE('Станция мытой обработки', r.wetMill);
                        addE('Станция сухой обработки', r.dryMill);
                        addE('Другое (Обработка)', r.otherProcessor);
                        
                        addE('Тип обработки', r.processType);
                        addEBool('Мытая', r.washed);
                        addEBool('Натуральная', r.natural);
                        addE('Другое (Тип обработки)', r.otherProcessType);
                        
                        addEBool('Декаф', r.decaf);
                        addE('Описание обработки', r.processDesc);

                        // --- СЕКЦИЯ 3: TRADING ---
                        addE('Оценка / Грейд', r.grade);
                        addE('Номер ICO', r.ico);
                        addE('Импортер', r.importer);
                        addE('Экспортер', r.exporter);
                        addE('Цена Farm Gate', r.farmGatePrice);
                        addE('Размер лота', r.lotSize);
                        addE('Другое (Торговля)', r.otherTrading);

                        // --- СЕКЦИЯ 4: CERTIFICATIONS ---
                        addEBool('Сертификат 4C', r.cert4C);
                        addEBool('Fair trade', r.certFairTrade);
                        addEBool('Organic', r.certOrganic);
                        addEBool('Rainforest Alliance', r.certRainforest);
                        addEBool('Food Safety', r.certFoodSafety);
                        addE('Другие сертификаты', r.otherCertifications);

                        // --- СЕКЦИЯ 5: OTHER ---
                        addE('Награды', r.awards);

                        if(eHtml === '') {
                            eHtml = '<div class="cupping-item full-width"><span class="cupping-value" style="opacity:0.6; font-size:12px;">Данные внешнего описания отсутствуют</span></div>';
                        }
                        extGrid.innerHTML = eHtml;
                    }
                    // --- ОБНОВЛЕНИЕ БЛОКА AI ИСТОРИИ ---
                    const aiContent = document.getElementById('ai-story-content');
                    const btnRegenAi = document.getElementById('btn-regen-ai');

                    if (r.aiStory && r.aiStory.text) {
                        let aiHtml = '';
                        if (r.aiStory.image) aiHtml += `<img src="${r.aiStory.image}" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 6px; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); object-fit: cover;">`;
                        aiHtml += `<div style="text-align: justify; text-indent: 15px;">${r.aiStory.text.replace(/\n/g, '<br><br>')}</div>`;
                        if (aiContent) aiContent.innerHTML = aiHtml;
                    } else {
                        if (aiContent) aiContent.innerHTML = '<div style="opacity:0.6; text-align:center; padding:20px;">История для этого лота еще не добавлена.</div>';
                    }

                    if (btnRegenAi) {
                        if (UserSystem.currentUser && UserSystem.currentUser.email === 'info@locus.coffee') {
                            btnRegenAi.style.display = 'block';
                        } else {
                            btnRegenAi.style.display = 'none';
                        }
                    }

                } else {
                    currentActiveProduct = null;
                    const elTitle = document.getElementById('p-title');
                    if (elTitle) elTitle.textContent = seg.label;
                    const elCatDesc = document.getElementById('p-cat-desc');
                    if (elCatDesc) elCatDesc.textContent = seg.desc || "";
                    document.getElementById('p-simple-desc').textContent = "";
                    document.getElementById('p-mini-stats').innerHTML = ""; 
                    const grid = document.getElementById('cupping-data');
                    if (grid) grid.innerHTML = '';
                    const extGrid = document.getElementById('extrinsic-data');
                    if (extGrid) extGrid.innerHTML = '';
                    const elBuyArea = document.getElementById('p-buy-area');
                    if (elBuyArea) elBuyArea.style.display = 'none';
                    if(toggleBtn) toggleBtn.style.display = 'none';
                    if(toggleExtBtn) toggleExtBtn.style.display = 'none';
                }
                pInfo.style.display = 'block';
                setTimeout(() => pInfo.classList.add('active'), 50);
            }, 250);
        }

        document.getElementById('btn-toggle-details').addEventListener('click', function() {
            const block = document.getElementById('detailed-stats-block');
            this.classList.toggle('open');
            if (block.style.display === 'block') {
                block.style.display = 'none';
                this.querySelector('span').textContent = 'Подробное описание';
            } else {
                block.style.display = 'block';
                this.querySelector('span').textContent = 'Скрыть подробности';
            }
        });

        const toggleExtBtn = document.getElementById('btn-toggle-extrinsic');
        if (toggleExtBtn) {
            toggleExtBtn.addEventListener('click', function() {
                const block = document.getElementById('extrinsic-stats-block');
                this.classList.toggle('open');
                if (block.style.display === 'block') {
                    block.style.display = 'none';
                    this.querySelector('span').textContent = 'Внешнее описание';
                } else {
                    block.style.display = 'block';
                    this.querySelector('span').textContent = 'Скрыть внешнее описание';
                }
            });
        }

        // --- НАЧАЛО: КНОПКИ AI ИСТОРИИ ---
        const toggleAiBtn = document.getElementById('btn-toggle-ai');
        if (toggleAiBtn) {
            toggleAiBtn.addEventListener('click', function() {
                const block = document.getElementById('ai-story-block');
                this.classList.toggle('open');
                block.style.display = block.style.display === 'block' ? 'none' : 'block';
            });
        }

        const btnRegenAi = document.getElementById('btn-regen-ai');
        if (btnRegenAi) {
            btnRegenAi.addEventListener('click', async function(e) {
                e.stopPropagation(); 
                if(!currentActiveProduct) return;
                
                const content = document.getElementById('ai-story-content');
                content.innerHTML = '<div style="text-align:center; padding: 30px 10px; opacity: 0.8;"><div class="loader" style="position:static; transform:none; display:inline-block; margin-bottom:10px;"></div><br>Нейросеть Qwen пишет новую историю...<br><span style="font-size:10px;">(Это может занять 15-30 секунд)</span></div>';
                
                try {
                    const reqData = {
                        action: 'generateLotStory',
                        sample: currentActiveProduct.sample,
                        country: currentActiveProduct.country || '',
                        region: currentActiveProduct.region || '',
                        farm: currentActiveProduct.farm || '',
                        producer: currentActiveProduct.producer || '',
                        variety: currentActiveProduct.variety || '',
                        processDesc: currentActiveProduct.processDesc || currentActiveProduct.processType || ''
                    };
                    
                    const token = localStorage.getItem('locus_token');
                    if(!token) throw new Error('Для генерации нужно войти как администратор');

                    const res = await fetch(LOCUS_API_URL + '?action=generateLotStory', {
                        method: 'POST', headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify(reqData)
                    });
                    
                    const data = await res.json();
                    if (!data.success) throw new Error(data.error);
                    
                    currentActiveProduct.aiStory = { text: data.text, image: data.image };
                    const prodInCache = ALL_PRODUCTS_CACHE.find(p => p.sample === currentActiveProduct.sample);
                    if(prodInCache) prodInCache.aiStory = { text: data.text, image: data.image };

                    let html = '';
                    if (data.image) html += `<img src="${data.image}" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 6px; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); object-fit: cover;">`;
                    html += `<div style="text-align: justify; text-indent: 15px;">${data.text.replace(/\n/g, '<br><br>')}</div>`;
                    content.innerHTML = html;
                    
                } catch (err) { content.innerHTML = `<div style="color: #B66A58; text-align: center; padding: 20px;">Ошибка генерации: ${err.message}</div>`; }
            });
        }
        // --- КОНЕЦ: КНОПКИ AI ИСТОРИИ ---

        document.querySelectorAll('.weight-option').forEach(opt => {
            opt.addEventListener('click', function() {
                document.querySelectorAll('.weight-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                currentWeight = parseInt(this.getAttribute('data-w'));
                updatePriceDisplay();
            });
        });

        document.querySelectorAll('.grind-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.grind-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentGrind = this.getAttribute('data-grind');
            });
        });

        function renderWheel() {
            const spin = document.getElementById('wheel-spinner');
            if (!spin) return;
            spin.innerHTML = '';
            const size = 800, cx = 400, cy = 400;
            const radii = [{ in: 75, out: 220 }, { in: 220, out: 400 }];
            const svgNS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
            spin.appendChild(svg);

            const polarToCartesian = (cX, cY, r, a) => {
                const rad = (a - 90) * Math.PI / 180.0;
                return { x: cX + (r * Math.cos(rad)), y: cY + (r * Math.sin(rad)) };
            };

            const describeArc = (x, y, iR, oR, sA, eA) => {
                const s = polarToCartesian(x, y, oR, eA), e = polarToCartesian(x, y, oR, sA);
                const si = polarToCartesian(x, y, iR, eA), ei = polarToCartesian(x, y, iR, sA);
                const large = eA - sA <= 180 ? "0" : "1";
                return [ "M", s.x, s.y, "A", oR, oR, 0, large, 0, e.x, e.y, "L", ei.x, ei.y, "A", iR, iR, 0, large, 1, si.x, si.y, "Z" ].join(" ");
            };

            let segments = [];
            let curAngle = 0;
            const total = SHOP_DATA.reduce((acc, cat) => acc + cat.children.length, 0);

            SHOP_DATA.forEach(cat => {
                if(cat.children.length === 0) return;
                const catA = (cat.children.length / total) * 360;
                segments.push({ ...cat, start: curAngle, end: curAngle + catA, depth: 0 });
                let childCur = curAngle;
                cat.children.forEach(child => {
                    const childA = catA / cat.children.length;
                    segments.push({ ...child, start: childCur, end: childCur + childA, depth: 1 });
                    childCur += childA;
                });
                curAngle += catA;
            });

            segments.forEach(seg => {
                const { in: iR, out: oR } = radii[seg.depth];
                const g = document.createElementNS(svgNS, "g");
                const path = document.createElementNS(svgNS, "path");
                path.setAttribute("d", describeArc(cx, cy, iR, oR, seg.start, seg.end));
                path.setAttribute("fill", seg.color);
                path.setAttribute("stroke", "var(--locus-bg)"); 
                path.setAttribute("stroke-width", "1.5");
                
                const mid = (seg.start + seg.end) / 2;
                const textPos = polarToCartesian(cx, cy, iR + (oR - iR)/2, mid);
                const text = document.createElementNS(svgNS, "text");
                text.setAttribute("x", textPos.x); text.setAttribute("y", textPos.y);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("transform", `rotate(${mid - 90}, ${textPos.x}, ${textPos.y})`);
                
                seg.label.split('\n').forEach((l, i) => {
                    const tspan = document.createElementNS(svgNS, "tspan");
                    tspan.textContent = l; tspan.setAttribute("x", textPos.x);
                    if(i > 0) tspan.setAttribute("dy", "1.2em");
                    text.appendChild(tspan);
                });

                g.appendChild(path); g.appendChild(text);
                g.addEventListener('click', () => {
                    if (Math.abs(velocity) > 0.5) return;
                    svg.querySelectorAll('path').forEach(p => p.classList.remove('selected'));
                    path.classList.add('selected');
                    updateInfo(seg);
                });
                svg.appendChild(g);
            });

            const center = document.createElementNS(svgNS, "circle");
            center.setAttribute("cx", cx); center.setAttribute("cy", cy); center.setAttribute("r", 78);
            center.setAttribute("fill", "var(--locus-bg)");
            center.setAttribute("cursor", "pointer");
            center.addEventListener('click', window.resetInfo);
            svg.appendChild(center);
            
            const brand = document.createElementNS(svgNS, "text");
            brand.setAttribute("x", cx); brand.setAttribute("y", cy);
            brand.setAttribute("class", "brand-logo-center");
            brand.textContent = "LOCUS";
            svg.appendChild(brand);

            spin.style.opacity = "1";
            const loader = document.getElementById('loading-overlay');
            if (loader) loader.style.display = "none";
        }

        function animate() {
            if (!isDragging) { if (Math.abs(velocity) > 0.05) { rotation += velocity; velocity *= 0.95; } else velocity = 0; }
            if (spinnerElem) {
                const scale = window.innerWidth >= 768 ? 1 : 0.8;
                spinnerElem.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`;
            }
            requestAnimationFrame(animate);
        }
        animate();

        function initWheelInteraction() {
            zone = document.getElementById('wheel-zone');
            spinnerElem = document.getElementById('wheel-spinner');
            if (zone) {
                zone.addEventListener('mousedown', e => { isDragging = true; velocity = 0; lastAngle = getAngle(e.clientX, e.clientY); lastTime = Date.now(); });
                window.addEventListener('mousemove', e => moveH(e.clientX, e.clientY));
                window.addEventListener('mouseup', () => isDragging = false);
                zone.addEventListener('touchstart', e => { isDragging = true; velocity = 0; lastAngle = getAngle(e.touches[0].clientX, e.touches[0].clientY); lastTime = Date.now(); }, {passive: false});
                window.addEventListener('touchmove', e => moveH(e.touches[0].clientX, e.touches[0].clientY), {passive: false});
                window.addEventListener('touchend', () => isDragging = false);
            }
        }
        
        // --- MESSAGING SYSTEM (Internal Mail) ---
        // --- НАЧАЛО: СИСТЕМА СООБЩЕНИЙ YDB ---
        const MessageSystem = {
            init: function() {
                const btnSend = document.getElementById('btn-send-feedback');
                if(btnSend) {
                    btnSend.onclick = () => {
                        const txtEl = document.getElementById('feedback-text');
                        const txt = txtEl ? txtEl.value.trim() : '';
                        if(!txt) return alert('Введите сообщение');
                        this.sendMessageToAdmin(txt);
                        txtEl.value = '';
                    };
                }
            },
            
            sendMessageToAdmin: async function(text, subject = 'Сообщение с сайта') {
                if(!UserSystem.uid) return alert('Нужно войти');
                const token = localStorage.getItem('locus_token');
                try {
                    await fetch(LOCUS_API_URL + '?action=sendMessage', {
                        method: 'POST', headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'sendMessage', direction: 'to_admin', subject: subject, text: text, userEmail: UserSystem.currentUser.email })
                    });
                    alert('Сообщение отправлено!');
                    const mailLink = `mailto:info@locus.coffee?subject=${encodeURIComponent(subject)} от ${UserSystem.currentUser.email}&body=${encodeURIComponent(text)}`;
                    window.open(mailLink, '_blank');
                    this.loadMessagesForUser();
                } catch(e) { console.error(e); alert('Ошибка отправки'); }
            },
            
            submitUserReply: async function(msgId, subject) {
                const txt = document.getElementById(`user-reply-text-${msgId}`).value;
                if(!txt) return;
                const replySubject = subject.startsWith('Re:') ? subject : 'Re: ' + subject;
                await this.sendMessageToAdmin(txt, replySubject);
            },
            
            replyToUser: async function(userId, subject, text) {
                const token = localStorage.getItem('locus_token');
                try {
                    await fetch(LOCUS_API_URL + '?action=sendMessage', {
                        method: 'POST', headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'sendMessage', direction: 'to_user', targetUserId: userId, subject: 'Re: ' + subject, text: text })
                    });
                    alert('Ответ отправлен');
                    this.loadMessagesForAdmin();
                } catch(e) { console.error(e); }
            },
            
            deleteMessage: async function(msgId, side) {
                if(!confirm('Удалить переписку из вашего списка?')) return;
                const token = localStorage.getItem('locus_token');
                try {
                    await fetch(LOCUS_API_URL + '?action=deleteMessage', {
                        method: 'POST', headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'deleteMessage', msgId: msgId, side: side })
                    });
                    if (side === 'admin') this.loadMessagesForAdmin();
                    else this.loadMessagesForUser();
                } catch(e) { console.error(e); }
            },
            
            loadMessagesForAdmin: async function() {
                const container = document.getElementById('admin-messages-list');
                if(!container) return;
                container.innerHTML = 'Загрузка...';
                const token = localStorage.getItem('locus_token');
                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getAdminMessages', { headers: { 'X-Auth-Token': token } });
                    const data = await res.json();
                    container.innerHTML = '';
                    if (!data.success) throw new Error(data.error);
                    
                    let msgs = data.messages;
                    if(msgs.length === 0) { container.innerHTML = 'Нет сообщений'; return; }

                    msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                    msgs.forEach(m => {
                        const isToAdmin = m.direction === 'to_admin';
                        const el = document.createElement('div');
                        el.className = 'msg-item';
                        const replyFormId = `reply-form-${m.id}`;
                        
                        el.innerHTML = `
                            <div class="msg-header">
                                <span>${new Date(m.timestamp).toLocaleString()}</span>
                                <span style="font-weight:bold; color:${isToAdmin ? '#B66A58' : 'gray'}">${isToAdmin ? 'От: ' + (m.userEmail || m.userId) : 'Вы ответили'}</span>
                            </div>
                            <div class="msg-subject">${m.subject || 'Без темы'}</div>
                            <div class="msg-body">${m.text}</div>
                            <div style="display:flex; justify-content:space-between;">
                                ${isToAdmin ? `<button class="lc-btn" style="width:auto; padding:5px 15px; font-size:10px;" onclick="document.getElementById('${replyFormId}').classList.toggle('active')">Ответить</button>` : '<div></div>'}
                                <button onclick="MessageSystem.deleteMessage('${m.id}', 'admin')" style="color:#B66A58; border:none; background:none; cursor:pointer;">&times; Удалить</button>
                            </div>
                            <div id="${replyFormId}" class="msg-reply-area">
                                <textarea id="reply-text-${m.id}" class="lc-input" placeholder="Текст ответа..." style="height:60px;"></textarea>
                                <button class="lc-btn" onclick="MessageSystem.submitReply('${m.id}', '${m.userId}', '${m.subject}')">Отправить</button>
                            </div>
                        `;
                        container.appendChild(el);
                    });
                } catch(e) { console.error(e); container.innerHTML = 'Ошибка загрузки'; }
            },
            
            submitReply: async function(msgId, userId, subject) {
                const txt = document.getElementById(`reply-text-${msgId}`).value;
                if(!txt) return;
                await this.replyToUser(userId, subject, txt);
            },
            
            loadMessagesForUser: async function() {
                const container = document.getElementById('user-messages-list');
                if(!container || !UserSystem.uid) return;
                container.innerHTML = 'Загрузка...';
                const token = localStorage.getItem('locus_token');
                
                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getUserMessages', { headers: { 'X-Auth-Token': token } });
                    const data = await res.json();
                    container.innerHTML = '';
                    if (!data.success) throw new Error(data.error);
                    
                    let msgs = data.messages;
                    if(msgs.length === 0) { container.innerHTML = '<div style="opacity:0.5; font-size:11px">Нет сообщений</div>'; return; }

                    msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                    msgs.forEach(m => {
                        const isToUser = m.direction === 'to_user';
                        const el = document.createElement('div');
                        el.className = 'msg-item';
                        el.style.borderLeft = isToUser ? '4px solid var(--locus-dark)' : '1px solid var(--locus-border)';
                        
                        const replyFormId = `user-reply-form-${m.id}`;

                        el.innerHTML = `
                            <div class="msg-header">
                                <span>${new Date(m.timestamp).toLocaleString()}</span>
                                <span>${isToUser ? 'Входящее' : 'Исходящее'}</span>
                            </div>
                            <div class="msg-subject">${m.subject}</div>
                            <div class="msg-body">${m.text}</div>
                            <div style="display:flex; justify-content:space-between; margin-top:5px;">
                                ${isToUser ? `<button class="lc-btn" style="width:auto; padding:4px 12px; font-size:9px;" onclick="document.getElementById('${replyFormId}').classList.toggle('active')">Ответить</button>` : '<div></div>'}
                                <button onclick="MessageSystem.deleteMessage('${m.id}', 'user')" style="font-size:10px; color:#B66A58; border:none; background:none; cursor:pointer;">Удалить</button>
                            </div>
                            <div id="${replyFormId}" class="msg-reply-area">
                                <textarea id="user-reply-text-${m.id}" class="lc-input" placeholder="Текст ответа..." style="height:60px;"></textarea>
                                <button class="lc-btn" onclick="MessageSystem.submitUserReply('${m.id}', '${m.subject}')">Отправить</button>
                            </div>
                        `;
                        container.appendChild(el);
                    });
                } catch(e) { console.error(e); container.innerHTML = '<div style="color:red; font-size:10px;">Ошибка загрузки</div>'; }
            }
        };
        window.MessageSystem = MessageSystem;
        // --- КОНЕЦ: СИСТЕМА СООБЩЕНИЙ YDB ---

        // --- PROMOTION SYSTEM (ACTIONS V2) ---
        const PromotionSystem = {
            activeAction: null,
            queue: [],
            
            init: function() {
                const typeSel = document.getElementById('action-type');
                if(typeSel) typeSel.addEventListener('change', function() {
                    const codeWrap = document.getElementById('action-code-wrapper');
                    codeWrap.style.display = this.value === 'discount' ? 'block' : 'none';
                });
                
                const btnAction = document.getElementById('btn-promo-action');
                const btnClose = document.getElementById('btn-promo-close');
                if(btnAction) btnAction.onclick = () => this.handleUserAction(true);
                if(btnClose) btnClose.onclick = () => this.handleUserAction(false);
            },
            
            // --- НАЧАЛО: АКЦИИ YDB ---
            loadActionsList: async function() {
                const container = document.getElementById('admin-actions-list');
                if(!container) return;
                container.innerHTML = 'Загрузка...';
                const token = localStorage.getItem('locus_token');
                if(!token) return container.innerHTML = 'Нет доступа';

                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getActions', { headers: { 'X-Auth-Token': token } });
                    const data = await res.json();
                    container.innerHTML = '';
                    if(!data.success) throw new Error(data.error);
                    if(data.actions.length === 0) { container.innerHTML = '<div style="opacity:0.5; font-size:12px;">Нет акций</div>'; return; }
                    
                    let actions = data.actions;
                    // Сортировка по дате создания (новые сверху)
                    actions.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

                    actions.forEach(a => {
                        const el = document.createElement('div');
                        el.className = 'promo-list-item';
                        
                        let details = `Тип: ${a.type === 'discount' ? 'Скидка' : 'Инфо'}`;
                        if (a.type === 'discount') details += `<br>Код: <b>${a.promoCode}</b> (${a.discountVal}${a.discountType === 'percent' ? '%' : '₽'})`;
                        if (a.limit) details += `<br>Лимит показов: ${a.limit}`;
                        if (a.dateEnd) details += `<br>До: ${a.dateEnd}`;

                        el.innerHTML = `
                            <div style="flex:1; margin-right:15px;">
                                <div style="font-weight:bold; font-size:12px;">${a.title}</div>
                                <div style="font-size:10px; opacity:0.7; margin-top:4px; line-height:1.4;">${details}</div>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <label style="font-size:10px; display:flex; align-items:center; gap:4px;">
                                    <input type="checkbox" ${a.active ? 'checked' : ''} onchange="PromotionSystem.toggleAction('${a.id}', this.checked, '${a.promoCode || ''}')"> Актив
                                </label>
                                <button onclick="PromotionSystem.deleteAction('${a.id}', '${a.promoCode || ''}')" style="color:#B66A58; border:none; background:none; cursor:pointer; font-size:16px;">&times;</button>
                            </div>
                        `;
                        container.appendChild(el);
                    });
                } catch(e) { console.error(e); container.innerHTML = 'Ошибка загрузки'; }
            },

            saveAction: async function() {
                const title = document.getElementById('action-title').value.trim();
                const msg = document.getElementById('action-msg').value.trim();
                const type = document.getElementById('action-type').value;
                const limit = parseInt(document.getElementById('action-limit').value) || 1;
                
                if (!title || !msg) return alert('Заполните Заголовок и Сообщение');

                let promoCode = '';
                let discountVal = 0;
                let discountType = 'percent';

                if (type === 'discount') {
                    promoCode = document.getElementById('action-promo-code').value.toUpperCase().trim();
                    discountVal = parseFloat(document.getElementById('action-discount-val').value) || 0;
                    discountType = document.getElementById('action-discount-type').value;
                    if (!promoCode || !discountVal) return alert('Для скидки укажите Промокод и Размер скидки');
                }

                const data = {
                    action: 'saveAction',
                    title: title, msg: msg, type: type,
                    promoCode: promoCode, discountVal: discountVal, discountType: discountType,
                    limit: limit,
                    dateEnd: document.getElementById('action-date-end').value,
                    active: document.getElementById('action-is-active').checked,
                    createdAt: new Date().toISOString()
                };
                
                const token = localStorage.getItem('locus_token');
                try {
                    await fetch(LOCUS_API_URL + '?action=saveAction', {
                        method: 'POST', headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    alert('Акция сохранена!');
                    this.loadActionsList();
                    // Очистка полей
                    document.getElementById('action-title').value = '';
                    document.getElementById('action-msg').value = '';
                    if(type === 'discount') {
                        document.getElementById('action-promo-code').value = '';
                        document.getElementById('action-discount-val').value = '';
                    }
                } catch(e) { alert('Ошибка: ' + e.message); }
            },
            
            toggleAction: async function(id, status, promoCode) {
                const token = localStorage.getItem('locus_token');
                try { 
                    await fetch(LOCUS_API_URL + '?action=toggleAction', {
                        method: 'POST', headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'toggleAction', id: id, active: status, promoCode: promoCode })
                    });
                } catch(e) { console.error(e); }
            },
            
            deleteAction: async function(id, promoCode) {
                if(!confirm('Удалить акцию?')) return;
                const token = localStorage.getItem('locus_token');
                try { 
                    await fetch(LOCUS_API_URL + '?action=deleteAction', {
                        method: 'POST', headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'deleteAction', id: id, promoCode: promoCode })
                    });
                    this.loadActionsList(); 
                } catch(e) { console.error(e); }
            },

            checkAndShow: async function() {
                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getActiveActions');
                    const data = await res.json();
                    
                    if(!data.success || data.actions.length === 0) return;
                    
                    this.queue = [];
                    const now = new Date();
                    
                    // Безопасно достаем userId из токена для ведения счетчика просмотров
                    let userKeyPart = 'guest';
                    const token = localStorage.getItem('locus_token');
                    if(token) {
                        try { userKeyPart = JSON.parse(atob(token.split('.')[1])).userId; } catch(e) {}
                    }

                    data.actions.forEach(promo => {
                        if(promo.dateEnd) {
                            const end = new Date(promo.dateEnd);
                            if(now > end) return; 
                        }
                        
                        const seenKey = `locus_promo_seen_${promo.id}_${userKeyPart}`;
                        const acceptedKey = `locus_promo_accepted_${promo.id}_${userKeyPart}`;
                        
                        if (localStorage.getItem(acceptedKey) === 'true') return;
                        const seenCount = parseInt(localStorage.getItem(seenKey)) || 0;
                        
                        if(seenCount < promo.limit) {
                            this.queue.push(promo);
                        }
                    });

                    this.queue.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
                    this.showNext();

                } catch(e) { console.error(e); }
            },
            // --- КОНЕЦ: АКЦИИ YDB ---
            // --- НАЧАЛО: ЛОГИКА ПОКАЗОВ И СЧЕТЧИКОВ ---
            showNext: function() {
                if(this.queue.length === 0) return;
                
                const nextPromo = this.queue.shift(); 
                this.activeAction = nextPromo;
                this.showPopup(nextPromo);

                // Безопасное извлечение ID пользователя без Firebase
                let userKeyPart = 'guest';
                const token = localStorage.getItem('locus_token');
                if(token) {
                    try { userKeyPart = JSON.parse(atob(token.split('.')[1])).userId; } catch(e) {}
                }

                // Увеличиваем счетчик просмотров
                const seenKey = `locus_promo_seen_${nextPromo.id}_${userKeyPart}`;
                const seenCount = parseInt(localStorage.getItem(seenKey)) || 0;
                localStorage.setItem(seenKey, seenCount + 1);
            },

            showPopup: function(promo) {
                const overlay = document.getElementById('promo-popup');
                const title = document.getElementById('promo-popup-title');
                const msg = document.getElementById('promo-popup-msg');
                const btn = document.getElementById('btn-promo-action');
                const close = document.getElementById('btn-promo-close');

                title.textContent = promo.title;
                msg.textContent = promo.msg;
                
                if(promo.type === 'discount') {
                    btn.textContent = "Получить скидку";
                    close.textContent = "Отказаться";
                } else {
                    btn.textContent = "Понятно"; 
                    close.textContent = "Закрыть";
                }
                
                overlay.classList.add('active');
            },

            handleUserAction: function(isPrimary) {
                const overlay = document.getElementById('promo-popup');
                overlay.classList.remove('active');
                
                let userKeyPart = 'guest';
                const token = localStorage.getItem('locus_token');
                if(token) {
                    try { userKeyPart = JSON.parse(atob(token.split('.')[1])).userId; } catch(e) {}
                }
                
                if(isPrimary && this.activeAction) {
                    // Если нажали главную кнопку - ставим вечную метку "принято"
                    localStorage.setItem(`locus_promo_accepted_${this.activeAction.id}_${userKeyPart}`, 'true');

                    if (this.activeAction.type === 'discount') {
                        const code = this.activeAction.promoCode;
                        if(code) {
                            const cartInput = document.getElementById('cart-promo-input');
                            if(cartInput) cartInput.value = code;
                            
                            // Безопасный вызов UserSystem
                            if(window.UserSystem && window.UserSystem.uid) {
                                window.UserSystem.toggleModal(true, 'cart');
                                window.UserSystem.applyPromo(); 
                            } else if (window.UserSystem) {
                                alert(`Код ${code} скопирован! Авторизуйтесь, чтобы применить его.`);
                                window.UserSystem.toggleModal(true, 'login');
                            }
                        }
                    }
                }
                
                // Проверяем, есть ли еще акции в очереди
                setTimeout(() => {
                    this.showNext();
                }, 500);
            }
            // --- КОНЕЦ: ЛОГИКА ПОКАЗОВ И СЧЕТЧИКОВ ---
        };
        window.PromotionSystem = PromotionSystem;
        window.MessageSystem = MessageSystem;

            // --- CATALOG SYSTEM (Управление каппингами) ---
        const CatalogSystem = {
            ALL_PRODUCTS: [],

            switchTab: function(tabName) {
                document.querySelectorAll('.cat-tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.cat-tab-content').forEach(content => content.classList.remove('active'));
                if (tabName === 'active') {
                    document.querySelectorAll('.cat-tab-btn')[0].classList.add('active');
                    document.getElementById('cat-tab-active').classList.add('active');
                } else {
                    document.querySelectorAll('.cat-tab-btn')[1].classList.add('active');
                    document.getElementById('cat-tab-inactive').classList.add('active');
                }
            },

            loadData: async function() {
                const containerA = document.getElementById('catalog-list-active');
                if(!containerA) return;
                containerA.innerHTML = '<div class="loader" style="position:relative; top:0; color:var(--locus-dark);">Загрузка базы данных...</div>';
                document.getElementById('catalog-list-inactive').innerHTML = '';

                try {
                    const response = await fetch(YANDEX_FUNCTION_URL + "?type=catalog");
                    const result = await response.json();
                    if (!result.success) throw new Error(result.error || "Ошибка сервера");

                    this.ALL_PRODUCTS = [];
                    result.data.forEach((r) => {
                        if (r.sample_no) {
                            this.ALL_PRODUCTS.push({
                                id: r.id, cuppingDate: r.cupping_date, sample: r.sample_no, roast: r.roast_level, 
                                smellInt: r.fragrance, aromaInt: r.aroma, aromaDesc: r.aroma_descriptors, aromaNotes: r.aroma_notes, 
                                flavorInt: r.flavor, atInt: r.aftertaste, flavorDesc: r.flavor_descriptors, mainFlavors: r.main_tastes, 
                                flavorNotes: r.flavor_notes, acidInt: r.acidity, acidNotes: r.acidity_notes, sweetInt: r.sweetness, 
                                sweetNotes: r.sweetness_notes, bodyInt: r.mouthfeel, bodyDesc: r.mouthfeel_descriptors, bodyNotes: r.mouthfeel_notes, 
                                inCatalog: r.in_catalogue
                            });
                        }
                    });
                    
                    if (this.ALL_PRODUCTS.length === 0) {
                        containerA.innerHTML = `<div class="empty-msg">База данных пуста</div>`;
                        return;
                    }
                    this.renderCatalog();
                } catch (e) {
                    containerA.innerHTML = `<div style="color:#B66A58; text-align:center; padding:20px;">Ошибка загрузки:<br>${e.message}</div>`;
                }
            },

            renderCatalog: function() {
                const containerActive = document.getElementById('catalog-list-active');
                const containerInactive = document.getElementById('catalog-list-inactive');
                containerActive.innerHTML = ''; containerInactive.innerHTML = '';

                let activeCount = 0; let inactiveCount = 0;

                this.ALL_PRODUCTS.forEach((r) => {
                    const isChecked = r.inCatalog === "1" ? "checked" : "";
                    const roastVal = parseFloat(r.roast) || 0;
                    const typeText = roastVal >= 10 ? 'ЭСПРЕССО' : 'ФИЛЬТР';
                    const typeColor = roastVal >= 10 ? '#B66A58' : '#7A8F7C';
                    const typeSticker = `<span style="font-size:9px; background:${typeColor}; color:#fff; border-radius:3px; padding:2px 4px; margin-right:5px; vertical-align:middle; display:inline-block;">${typeText}</span>`;
                    const isBlend = r.sample.toLowerCase().includes('blend') || r.sample.toLowerCase().includes('смесь');
                    const blendLabel = isBlend ? `<span style="font-size:9px; border:1px solid #ccc; border-radius:3px; padding:0 2px; margin-right:5px; vertical-align:middle; display:inline-block; color:var(--locus-dark);">BLEND</span>` : '';
                    
                    const item = document.createElement('div');
                    item.className = 'catalog-item';
                    item.id = `cat-item-row-${r.id}`;

                    item.innerHTML = `
                        <div class="catalog-item-header" onclick="CatalogSystem.toggleDetails('${r.id}')">
                            <div class="item-title" style="display:flex; align-items:center; flex-wrap:wrap;">
                                ${typeSticker}${blendLabel} <span>${r.sample}</span>
                            </div>
                            <div class="item-controls" onclick="event.stopPropagation()">
                                <div class="cat-checkbox-wrapper">
                                    <span id="cat-status-${r.id}" class="save-status"></span>
                                    <input type="checkbox" id="cat-check-${r.id}" ${isChecked} onchange="CatalogSystem.updateCatalogRow('${r.id}', this)">
                                    В каталоге
                                </div>
                                <button class="cat-btn-icon" title="Редактировать лот" onclick="CatalogSystem.openEditMode('${r.id}', event)">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button class="cat-btn-icon" title="Дублировать лот" onclick="CatalogSystem.duplicateRow('${r.id}', event)">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                </button>
                                <button class="cat-btn-icon delete" id="cat-btn-delete-${r.id}" title="Удалить лот" onclick="CatalogSystem.deleteRow('${r.id}', '${r.sample}')">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        <div class="catalog-item-content" id="cat-content-${r.id}">${this.getViewHtml(r)}</div>
                    `;
                    
                    if (r.inCatalog === "1") { containerActive.appendChild(item); activeCount++; } 
                    else { containerInactive.appendChild(item); inactiveCount++; }
                });

                if (activeCount === 0) containerActive.innerHTML = '<div class="empty-msg">Нет лотов в каталоге</div>';
                if (inactiveCount === 0) containerInactive.innerHTML = '<div class="empty-msg">Нет сохраненных каппингов</div>';
            },

            getViewHtml: function(r) {
                return `
                    <div class="cupping-grid">
                        <div class="cupping-item full-width"><span class="cupping-label">Дата каппинга</span><span class="cupping-value">${r.cuppingDate || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Степень обжарки</span>${getScale(r.roast)}</div>
                        <div class="cupping-item full-width"><span class="cupping-label">Интенсивность запаха</span>${getScale(r.smellInt)}</div>
                        <div class="cupping-item full-width"><span class="cupping-label">Интенсивность аромата</span>${getScale(r.aromaInt)}</div>
                        <div class="cupping-item full-width"><span class="cupping-label">Описание запаха и аромата</span><span class="cupping-value">${r.aromaDesc || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о запахе и аромате</span><span class="cupping-notes">${r.aromaNotes || '-'}</span></div>
                        
                        <div class="cupping-item"><span class="cupping-label">Интенсивность букета</span>${getScale(r.flavorInt)}</div>
                        <div class="cupping-item"><span class="cupping-label">Интенсивность послевкусия</span>${getScale(r.atInt)}</div>
                        <div class="cupping-item full-width"><span class="cupping-label">Описание букета</span><span class="cupping-value">${r.flavorDesc || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Основные вкусы</span><span class="cupping-value flavor-text">${r.mainFlavors || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о букете и послевкусии</span><span class="cupping-notes">${r.flavorNotes || '-'}</span></div>
                        
                        <div class="cupping-item"><span class="cupping-label">Интенсивность кислотности</span>${getScale(r.acidInt)}<span class="cupping-label" style="margin-top:10px;">Заметки о кислотности</span><span class="cupping-notes">${r.acidNotes || '-'}</span></div>
                        <div class="cupping-item"><span class="cupping-label">Интенсивность сладости</span>${getScale(r.sweetInt)}<span class="cupping-label" style="margin-top:10px;">Заметки о сладости</span><span class="cupping-notes">${r.sweetNotes || '-'}</span></div>
                        
                        <div class="cupping-item"><span class="cupping-label">Интенсивность тактильности</span>${getScale(r.bodyInt)}</div>
                        <div class="cupping-item"><span class="cupping-label">Описание тактильности</span><span class="cupping-value">${r.bodyDesc || '-'}</span></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о тактильности</span><span class="cupping-notes">${r.bodyNotes || '-'}</span></div>
                    </div>
                `;
            },

            getEditHtml: function(r) {
                return `
                    <div class="cupping-grid">
                        <div class="cupping-item full-width"><span class="cupping-label">Название / Номер лота</span>
                            <input type="text" id="cat-edit-sample-${r.id}" class="edit-input" value="${r.sample || ''}"></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Дата каппинга</span>
                            <input type="date" id="cat-edit-date-${r.id}" class="edit-input" value="${r.cuppingDate || ''}"></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Степень обжарки (1-15)</span>
                            <input type="number" min="1" max="15" id="cat-edit-roast-${r.id}" class="edit-input" value="${r.roast || ''}"></div>
                        <div class="cupping-item"><span class="cupping-label">Интенсивность запаха (1-15)</span>
                            <input type="number" min="1" max="15" id="cat-edit-smellInt-${r.id}" class="edit-input" value="${r.smellInt || ''}"></div>
                        <div class="cupping-item"><span class="cupping-label">Интенсивность аромата (1-15)</span>
                            <input type="number" min="1" max="15" id="cat-edit-aromaInt-${r.id}" class="edit-input" value="${r.aromaInt || ''}"></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Описание запаха и аромата</span>
                            <textarea id="cat-edit-aromaDesc-${r.id}" class="edit-textarea">${r.aromaDesc || ''}</textarea></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о запахе и аромате</span>
                            <textarea id="cat-edit-aromaNotes-${r.id}" class="edit-textarea">${r.aromaNotes || ''}</textarea></div>
                        
                        <div class="cupping-item"><span class="cupping-label">Интенсивность букета (1-15)</span>
                            <input type="number" min="1" max="15" id="cat-edit-flavorInt-${r.id}" class="edit-input" value="${r.flavorInt || ''}"></div>
                        <div class="cupping-item"><span class="cupping-label">Интенсивность послевкусия (1-15)</span>
                            <input type="number" min="1" max="15" id="cat-edit-atInt-${r.id}" class="edit-input" value="${r.atInt || ''}"></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Описание букета</span>
                            <textarea id="cat-edit-flavorDesc-${r.id}" class="edit-textarea">${r.flavorDesc || ''}</textarea></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Основные вкусы</span>
                            <input type="text" id="cat-edit-mainFlavors-${r.id}" class="edit-input" value="${r.mainFlavors || ''}"></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о букете и послевкусии</span>
                            <textarea id="cat-edit-flavorNotes-${r.id}" class="edit-textarea">${r.flavorNotes || ''}</textarea></div>
                        
                        <div class="cupping-item"><span class="cupping-label">Интенсивность кислотности (1-15)</span>
                            <input type="number" min="1" max="15" id="cat-edit-acidInt-${r.id}" class="edit-input" value="${r.acidInt || ''}"></div>
                        <div class="cupping-item"><span class="cupping-label">Заметки о кислотности</span>
                            <textarea id="cat-edit-acidNotes-${r.id}" class="edit-textarea">${r.acidNotes || ''}</textarea></div>
                            
                        <div class="cupping-item"><span class="cupping-label">Интенсивность сладости (1-15)</span>
                            <input type="number" min="1" max="15" id="cat-edit-sweetInt-${r.id}" class="edit-input" value="${r.sweetInt || ''}"></div>
                        <div class="cupping-item"><span class="cupping-label">Заметки о сладости</span>
                            <textarea id="cat-edit-sweetNotes-${r.id}" class="edit-textarea">${r.sweetNotes || ''}</textarea></div>
                        
                        <div class="cupping-item full-width"><span class="cupping-label">Интенсивность тактильности (1-15)</span>
                            <input type="number" min="1" max="15" id="cat-edit-bodyInt-${r.id}" class="edit-input" value="${r.bodyInt || ''}"></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Описание тактильности</span>
                            <textarea id="cat-edit-bodyDesc-${r.id}" class="edit-textarea">${r.bodyDesc || ''}</textarea></div>
                        <div class="cupping-item full-width"><span class="cupping-label">Заметки о тактильности</span>
                            <textarea id="cat-edit-bodyNotes-${r.id}" class="edit-textarea">${r.bodyNotes || ''}</textarea></div>
                    </div>
                    <div class="edit-actions">
                        <button class="lc-btn btn-del-cat" onclick="CatalogSystem.cancelEdit('${r.id}')">Отмена</button>
                        <button class="lc-btn btn-save-cat" id="cat-btn-save-${r.id}" onclick="CatalogSystem.saveEdit('${r.id}')">Сохранить</button>
                    </div>
                `;
            },

            toggleDetails: function(id) {
                const item = document.getElementById(`cat-item-row-${id}`);
                if(item) {
                    item.classList.toggle('open');
                    if(!item.classList.contains('open')) this.cancelEdit(id);
                }
            },

            openEditMode: function(id, event) {
                event.stopPropagation();
                const item = document.getElementById(`cat-item-row-${id}`);
                const contentDiv = document.getElementById(`cat-content-${id}`);
                const product = this.ALL_PRODUCTS.find(p => p.id === id);
                if (!item.classList.contains('open')) item.classList.add('open');
                contentDiv.innerHTML = this.getEditHtml(product);
            },

            cancelEdit: function(id) {
                const contentDiv = document.getElementById(`cat-content-${id}`);
                const product = this.ALL_PRODUCTS.find(p => p.id === id);
                contentDiv.innerHTML = this.getViewHtml(product);
            },

            saveEdit: async function(id) {
                const btn = document.getElementById(`cat-btn-save-${id}`);
                btn.disabled = true; btn.textContent = "Сохранение...";
                const updatedData = {
                    id: id,
                    sample: document.getElementById(`cat-edit-sample-${id}`).value,
                    cuppingDate: document.getElementById(`cat-edit-date-${id}`).value,
                    roast: document.getElementById(`cat-edit-roast-${id}`).value,
                    smellInt: document.getElementById(`cat-edit-smellInt-${id}`).value,
                    aromaInt: document.getElementById(`cat-edit-aromaInt-${id}`).value,
                    aromaDesc: document.getElementById(`cat-edit-aromaDesc-${id}`).value,
                    aromaNotes: document.getElementById(`cat-edit-aromaNotes-${id}`).value,
                    flavorInt: document.getElementById(`cat-edit-flavorInt-${id}`).value,
                    atInt: document.getElementById(`cat-edit-atInt-${id}`).value,
                    flavorDesc: document.getElementById(`cat-edit-flavorDesc-${id}`).value,
                    mainFlavors: document.getElementById(`cat-edit-mainFlavors-${id}`).value,
                    flavorNotes: document.getElementById(`cat-edit-flavorNotes-${id}`).value,
                    acidInt: document.getElementById(`cat-edit-acidInt-${id}`).value,
                    acidNotes: document.getElementById(`cat-edit-acidNotes-${id}`).value,
                    sweetInt: document.getElementById(`cat-edit-sweetInt-${id}`).value,
                    sweetNotes: document.getElementById(`cat-edit-sweetNotes-${id}`).value,
                    bodyInt: document.getElementById(`cat-edit-bodyInt-${id}`).value,
                    bodyDesc: document.getElementById(`cat-edit-bodyDesc-${id}`).value,
                    bodyNotes: document.getElementById(`cat-edit-bodyNotes-${id}`).value,
                };
                try {
                    const response = await fetch(YANDEX_FUNCTION_URL + "?type=catalog_edit", {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData)
                    });
                    const result = await response.json();
                    if (!result.success) throw new Error("Сервер вернул ошибку");
                    
                    const pIndex = this.ALL_PRODUCTS.findIndex(p => p.id === id);
                    this.ALL_PRODUCTS[pIndex] = { ...this.ALL_PRODUCTS[pIndex], ...updatedData };
                    document.querySelector(`#cat-item-row-${id} .item-title span`).textContent = updatedData.sample;
                    this.cancelEdit(id);
                } catch (error) {
                    alert("Ошибка сети при сохранении изменений.");
                    btn.disabled = false; btn.textContent = "Сохранить";
                }
            },

            updateCatalogRow: async function(id, checkboxEl) {
                const statusEl = document.getElementById(`cat-status-${id}`);
                const isChecked = checkboxEl.checked;
                checkboxEl.disabled = true;
                statusEl.textContent = "Сохранение..."; statusEl.className = "save-status saving";
                try {
                    const response = await fetch(YANDEX_FUNCTION_URL + "?type=catalog_update", {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: id, inCatalog: isChecked ? "1" : "" })
                    });
                    const result = await response.json();
                    if (!result.success) throw new Error("Ошибка сервера");

                    checkboxEl.disabled = false;
                    statusEl.textContent = "Сохранено ✓"; statusEl.className = "save-status success";
                    setTimeout(() => { statusEl.style.opacity = '0'; setTimeout(() => { statusEl.textContent = ""; statusEl.style.opacity = ''; }, 300); }, 2000);

                    const pIndex = this.ALL_PRODUCTS.findIndex(p => p.id === id);
                    if (pIndex !== -1) this.ALL_PRODUCTS[pIndex].inCatalog = isChecked ? "1" : "";

                    const itemRow = document.getElementById(`cat-item-row-${id}`);
                    const targetCont = isChecked ? document.getElementById('catalog-list-active') : document.getElementById('catalog-list-inactive');
                    const sourceCont = isChecked ? document.getElementById('catalog-list-inactive') : document.getElementById('catalog-list-active');
                    
                    const targetEmpty = targetCont.querySelector('.empty-msg');
                    if (targetEmpty) targetEmpty.remove();
                    targetCont.appendChild(itemRow);
                    
                    if (sourceCont.children.length === 0) {
                        sourceCont.innerHTML = `<div class="empty-msg">${isChecked ? 'Нет сохраненных каппингов' : 'Нет лотов в каталоге'}</div>`;
                    }
                } catch (error) {
                    checkboxEl.disabled = false; checkboxEl.checked = !isChecked;
                    statusEl.textContent = "Ошибка!"; statusEl.className = "save-status error";
                    setTimeout(() => { statusEl.style.opacity = '0'; }, 3000);
                }
            },

            deleteRow: async function(id, sampleName) {
                if (!confirm(`Вы точно хотите безвозвратно удалить лот "${sampleName}" из базы данных?`)) return;
                const btn = document.getElementById(`cat-btn-delete-${id}`);
                const rowEl = document.getElementById(`cat-item-row-${id}`);
                btn.disabled = true;
                try {
                    const response = await fetch(YANDEX_FUNCTION_URL + "?type=catalog_delete", {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id })
                    });
                    const result = await response.json();
                    if (!result.success) throw new Error("Ошибка сервера");
                    rowEl.style.opacity = '0';
                    setTimeout(() => { 
                        const parent = rowEl.parentNode; rowEl.remove(); 
                        if (parent && parent.children.length === 0) {
                            const isCatalog = parent.id === 'catalog-list-active';
                            parent.innerHTML = `<div class="empty-msg">${isCatalog ? 'Нет лотов в каталоге' : 'Нет сохраненных каппингов'}</div>`;
                        }
                    }, 300);
                } catch (error) {
                    alert("Ошибка сети при удалении.");
                    btn.disabled = false;
                }
            },

            duplicateRow: async function(id, event) {
                event.stopPropagation();
                if (!confirm(`Создать копию этого лота?`)) return;
                try {
                    document.body.style.cursor = 'wait';
                    const response = await fetch(YANDEX_FUNCTION_URL + "?type=catalog_duplicate", {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id })
                    });
                    const result = await response.json();
                    if (!result.success) throw new Error("Ошибка сервера");
                    await this.loadData();
                } catch (error) {
                    alert("Ошибка сети при копировании лота.");
                } finally { document.body.style.cursor = 'default'; }
            }
        };
        window.CatalogSystem = CatalogSystem;

        // --- USER SYSTEM ---
        const UserSystem = {
            currentUser: null, uid: null, localCart: [], activePromo: null,
            cdekPrice: 0, cdekInfo: null,
            
            // WHOLESALE & PRICING
            pricingSettings: null,
            usdRate: 0,

            init: function() {
                const savedCart = localStorage.getItem('locus_cart');
                if(savedCart) this.localCart = JSON.parse(savedCart);
                this.updateCartBadge();
                
                this.fetchUSDRate();
                this.fetchPricingSettings();
                PromotionSystem.init();
                MessageSystem.init();

                const token = localStorage.getItem('locus_token');
                if (token) {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1])); 
                        this.uid = payload.userId;
                        this.currentUser = { id: this.uid, email: payload.email, totalSpent: 0, cart: [], history: [], subscription: [] }; 
                        this.updateUIState();
                        
                        // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Принудительно скачиваем реальную историю и корзину из YDB при загрузке
                        this.fetchUserData();
                        
                        if(payload.email === 'info@locus.coffee') {
                            const btnAdmin = document.getElementById('btn-open-admin');
                            if(btnAdmin) { 
                                btnAdmin.style.display = 'flex';
                                btnAdmin.onclick = () => this.toggleModal(true, 'admin');
                            }
                        }
                    } catch(e) {
                        console.error('Ошибка чтения токена', e);
                        localStorage.removeItem('locus_token');
                    }
                } else {
                    this.uid = null;
                    this.currentUser = null; 
                    this.updateUIState();
                    const btnAdmin = document.getElementById('btn-open-admin');
                    if(btnAdmin) btnAdmin.style.display = 'none';
                }
                PromotionSystem.checkAndShow();
                
                const safeListen = (id, fn) => { const el = document.getElementById(id); if(el) el.addEventListener('click', fn); };
                safeListen('btn-open-lc', () => this.toggleModal(true, 'dashboard'));
                safeListen('btn-open-cart', () => {
                    this.toggleModal(true, 'cart');
                    this.verifyActivePromo(); // Проверка при открытии корзины
                    this.initCDEK();
                });
                safeListen('btn-open-wholesale', () => {
                    this.renderWholesaleTable();
                    this.toggleModal(true, 'wholesale');
                });
                safeListen('btn-close-lc', () => this.toggleModal(false));
                safeListen('link-to-reg', () => this.switchView('register'));
                safeListen('link-to-login', () => this.switchView('login'));
                safeListen('btn-action-reg', () => this.register());
                safeListen('btn-action-login', () => this.login());
                safeListen('btn-logout', () => this.logout());
                safeListen('btn-checkout', () => this.placeOrder());
                safeListen('btn-apply-promo', () => this.applyPromo());

                const btnCart = document.getElementById('btn-cart');
                if(btnCart) btnCart.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopImmediatePropagation();
                    if(this.currentUser && this.uid) {
                        const titleEl = document.getElementById('p-title');
                        const title = titleEl ? titleEl.textContent.trim() : 'Unknown';
                        this.addToCart(title, currentWeight, currentGrind);
                    } else {
                        alert('Войдите в ЛК чтобы покупать.');
                        this.toggleModal(true, 'login');
                    }
                });
                
                const btnSub = document.getElementById('btn-subscription');
                if(btnSub) btnSub.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopImmediatePropagation();
                    if(this.currentUser && this.uid) {
                        const titleEl = document.getElementById('p-title');
                        const title = titleEl ? titleEl.textContent.trim() : 'Unknown';
                        // Исправлено: передаем текущий помол
                        this.addToSubscription(title, currentWeight, currentGrind);
                    } else {
                        alert('Войдите в ЛК для подписки.');
                        this.toggleModal(true, 'login');
                    }
                });
            },

            // --- PRICING LOGIC ---
            fetchUSDRate: async function() {
                try {
                    const resp = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
                    const data = await resp.json();
                    if(data && data.Valute && data.Valute.USD) {
                        this.usdRate = data.Valute.USD.Value;
                    }
                } catch(e) { console.error('USD Fetch Error', e); this.usdRate = 90; } // Fallback
            },

            // --- НАЧАЛО: ПАРСИНГ CSV И СОХРАНЕНИЕ ---
            fetchPricingSettings: async function() {
                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getPricingSettings');
                    const data = await res.json();
                    if(data.success && data.settings && Object.keys(data.settings).length > 0) {
                        this.pricingSettings = data.settings;
                        
                        const resOpex = document.getElementById('res-opex');
                        if(resOpex) {
                            resOpex.textContent = (this.pricingSettings.opexTotal || 0).toLocaleString('ru-RU');
                            document.getElementById('res-var').textContent = (this.pricingSettings.varTotal || 0).toLocaleString('ru-RU');
                            document.getElementById('res-vol').textContent = this.pricingSettings.volume || 100;
                            document.getElementById('res-opex-kg').textContent = (this.pricingSettings.opexPerKg || 0).toLocaleString('ru-RU');
                            document.getElementById('res-var-kg').textContent = (this.pricingSettings.varPerKg || 0).toLocaleString('ru-RU');
                            document.getElementById('cost-calc-results').style.display = 'block';
                        }
                    } else {
                        this.pricingSettings = { opexPerKg: 0, varPerKg: 0, volume: 100 };
                    }
                } catch(e) { console.error('Ошибка загрузки настроек', e); }
            },

            handleCSVUpload: function() {
                const fileInput = document.getElementById('cost-csv-upload');
                const file = fileInput.files[0];
                if (!file) return alert('Пожалуйста, выберите файл CSV');

                const btn = fileInput.nextElementSibling;
                const oldText = btn.textContent;
                btn.textContent = 'Обработка...';

                const reader = new FileReader();
                reader.onload = async (e) => {
                    const text = e.target.result;
                    const lines = text.split('\n');
                    
                    let opex = 0;
                    let varCosts = 0;
                    let volume = 100; 

                    lines.forEach((line, index) => {
                        if (index === 0 || !line.trim()) return; 
                        
                        const parts = line.split(';');
                        if (parts.length < 6) return; 
                        
                        const category = parts[1].toUpperCase().trim();
                        const name = parts[2].toLowerCase().trim();
                        const val = parseFloat(parts[5].replace(/[^0-9.-]+/g,"")) || 0;

                        if (category.includes('ПОСТОЯН') || category.includes('OPEX') || name.includes('аренда') || name.includes('оклад')) {
                            opex += val;
                        } 
                        else if (category.includes('ПЕРЕМЕН')) {
                            const isGreenCoffee = name.includes('зелёный') || name.includes('зеленый') || 
                                                  name.includes('перу') || name.includes('бразилия') || 
                                                  name.includes('эфиопия') || name.includes('колумбия');
                            
                            if (!isGreenCoffee) {
                                varCosts += val;
                            }
                        } 
                        else if (name.includes('объем') || name.includes('объём') || category.includes('ОБЪЕМ')) {
                            if (val > 0) volume = val;
                        }
                    });

                    const opexKg = Math.round(opex / volume);
                    const varKg = Math.round(varCosts / volume);

                    document.getElementById('res-opex').textContent = opex.toLocaleString('ru-RU');
                    document.getElementById('res-var').textContent = varCosts.toLocaleString('ru-RU');
                    document.getElementById('res-vol').textContent = volume;
                    document.getElementById('res-opex-kg').textContent = opexKg.toLocaleString('ru-RU');
                    document.getElementById('res-var-kg').textContent = varKg.toLocaleString('ru-RU');
                    document.getElementById('cost-calc-results').style.display = 'block';

                    const settingsToSave = {
                        opexTotal: opex,
                        varTotal: varCosts,
                        volume: volume,
                        opexPerKg: opexKg,
                        varPerKg: varKg
                    };

                    const token = localStorage.getItem('locus_token');
                    try {
                        const res = await fetch(LOCUS_API_URL + '?action=savePricingSettings', {
                            method: 'POST',
                            headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'savePricingSettings', settings: settingsToSave })
                        });
                        const data = await res.json();
                        
                        if(data.success) {
                            this.pricingSettings = settingsToSave;
                            alert('Отчет обработан! Себестоимость обновлена и сохранена в базу.');
                        } else {
                            throw new Error(data.error);
                        }
                    } catch(error) {
                        alert('Данные посчитаны локально, но произошла ошибка при сохранении: ' + error.message);
                    }
                    btn.textContent = oldText;
                    fileInput.value = ''; 
                };
                
                reader.readAsText(file, 'UTF-8'); 
            },
            // --- КОНЕЦ: ПАРСИНГ CSV И СОХРАНЕНИЕ ---

            savePricingSettings: async function() {
                const token = localStorage.getItem('locus_token');
                if(!token) return alert('Нет доступа');

                const btn = document.getElementById('btn-save-pricing');
                if(btn) btn.textContent = 'Сохранение...';

                // Собираем данные из инпутов админки
                const settings = {
                    manual_usd: parseFloat(document.getElementById('adm-usd-rate').value) || 0,
                    loss_roast: parseFloat(document.getElementById('adm-loss-roast').value) || 18,
                    loss_misc: parseFloat(document.getElementById('adm-loss-misc').value) || 2,
                    delivery_green: parseFloat(document.getElementById('adm-delivery-green').value) || 0,
                    pack_250: parseFloat(document.getElementById('adm-pack-250').value) || 0,
                    pack_1000: parseFloat(document.getElementById('adm-pack-1000').value) || 0,
                    margin: parseFloat(document.getElementById('adm-margin').value) || 0
                };

                try {
                    const res = await fetch(LOCUS_API_URL + '?action=savePricingSettings', {
                        method: 'POST',
                        headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'savePricingSettings', settings: settings })
                    });
                    const data = await res.json();
                    if(!data.success) throw new Error(data.error);

                    this.pricingSettings = settings;
                    alert('Настройки ценообразования успешно сохранены!');
                    if(btn) btn.textContent = 'Сохранить настройки';
                } catch(e) {
                    alert('Ошибка: ' + e.message);
                    if(btn) btn.textContent = 'Сохранить настройки';
                }
            },

            // --- НАЧАЛО: НОВЫЙ РАСЧЕТ ОПТОВЫХ ЦЕН (НА БАЗЕ CSV) ---
            calculateWholesalePrice: function(rawPriceUSD) {
                if (!this.pricingSettings) return { p250: 0, p1000: 0 };
                const s = this.pricingSettings;
                
                // Если курс не загрузился с cbr.ru, берем 90 для страховки
                const usd = this.usdRate || 90;

                // 1. Стоимость зеленого зерна + усредненная доставка до обжарочной (например, 50 руб/кг)
                const greenRub = (rawPriceUSD * usd) + 50;
                
                // 2. Ужарка и технические потери (в среднем кофе теряет 20% веса -> коэффициент 1.25)
                const roastedRawCost = greenRub * 1.25;

                // 3. ПОЛНАЯ СЕБЕСТОИМОСТЬ 1 КГ (COGS + OPEX)
                // Берем переменные и постоянные расходы, которые наш парсер посчитал из твоего CSV
                const varPerKg = s.varPerKg || 0;
                const opexPerKg = s.opexPerKg || 0;
                const fullCost1kg = roastedRawCost + varPerKg + opexPerKg;

                // 4. МАРЖА ОПТА (Contribution Margin)
                // Допустим, мы хотим зарабатывать сверху 30% (умножаем на 1.3)
                const marginMult = 1.3; 

                // 5. Итоговые цены
                // Округляем до десятков рублей для красоты (например, 1452 -> 1460)
                const price1000 = Math.ceil((fullCost1kg * marginMult) / 10) * 10;
                
                // Цена за 250г: делим 1 кг на 4 и накидываем стоимость маленькой пачки (например, +50 руб)
                const price250 = Math.ceil((price1000 / 4) + 50);

                return { p250: price250, p1000: price1000 };
            },
            // --- КОНЕЦ: НОВЫЙ РАСЧЕТ ОПТОВЫХ ЦЕН ---
            // --- НАЧАЛО: РАСЧЕТ РОЗНИЧНЫХ ЦЕН ---
            calculateRetailPrices: function(rawPriceUSD) {
                if (!this.pricingSettings || !rawPriceUSD) return { p250: 0, p1000: 0 };
                const s = this.pricingSettings;
                const usd = this.usdRate || 90;

                // 1. Сырье и ужарка
                const greenRub = (rawPriceUSD * usd) + 50; 
                const roastedRawCost = greenRub * 1.25; 

                // 2. Полная себестоимость 1 кг (включая OPEX и переменные из CSV)
                const fullCost1kg = roastedRawCost + (s.varPerKg || 0) + (s.opexPerKg || 0);

                // 3. РОЗНИЧНАЯ НАЦЕНКА (80% сверху)
                // Можешь менять коэффициент 1.8 на нужный тебе
                const retailMargin = 1.8; 

                // Математика (округляем до десятков)
                const price1000 = Math.ceil((fullCost1kg * retailMargin) / 10) * 10;
                
                // Для 250г плюсуем стоимость розничной пачки (напр., 60 руб)
                const cost250 = (fullCost1kg / 4) + 60;
                const price250 = Math.ceil((cost250 * retailMargin) / 10) * 10;

                return { p250: price250, p1000: price1000 };
            },
            // --- КОНЕЦ: РАСЧЕТ РОЗНИЧНЫХ ЦЕН ---

            renderWholesaleTable: function() {
                const container = document.getElementById('wholesale-table-container');
                const dateEl = document.getElementById('ws-date');
                const usdEl = document.getElementById('ws-usd');
                
                if(dateEl) dateEl.textContent = new Date().toLocaleDateString();
                if(usdEl) usdEl.textContent = this.usdRate.toFixed(4);
                
                let itemsList = [];

                ALL_PRODUCTS_CACHE.forEach(p => {
                    // 1. СТРОГИЙ ФИЛЬТР: Пропускаем сорта, которых нет в каталоге
                    if (p.inCatalog !== "1" && p.inCatalog !== 1 && p.inCatalog !== true) return;

                    const rawGreen = parseFloat(p.rawGreenPrice || p.raw_green_price) || 0;
                    if (!rawGreen) return;

                    const prices = this.calculateWholesalePrice(rawGreen);
                    itemsList.push({ ...p, ws250: prices.p250, ws1000: prices.p1000 });
                });

                // 2. СОРТИРОВКА: Эспрессо (roast >= 10) сначала, затем Фильтр. Внутри группы — по алфавиту.
                itemsList.sort((a, b) => {
                    const roastA = parseFloat(a.roast) || 0;
                    const roastB = parseFloat(b.roast) || 0;
                    const isEspressoA = roastA >= 10 ? 1 : 0;
                    const isEspressoB = roastB >= 10 ? 1 : 0;
                    
                    if (isEspressoA !== isEspressoB) {
                        return isEspressoB - isEspressoA; // 1 (Эспрессо) встанет выше 0 (Фильтр)
                    }
                    return a.sample.localeCompare(b.sample); // Алфавитная сортировка при совпадении категории
                });

                let html = '';

                if (itemsList.length > 0) {
                    html += `<div style="overflow-x:auto; padding-bottom:10px;">
                        <table class="admin-table" style="width:100%; min-width:650px;">
                        <thead><tr>
                            <th style="width: 28%;">Название</th>
                            <th style="width: 36%;">Описание</th>
                            <th style="width: 18%; text-align:center;">250 г (шт)</th>
                            <th style="width: 18%; text-align:center;">1 кг (шт)</th>
                        </tr></thead>
                        <tbody>`;
                    
                    itemsList.forEach(i => {
                        const roastVal = parseFloat(i.roast) || 0;
                        const typeText = roastVal >= 10 ? 'ЭСПРЕССО' : 'ФИЛЬТР';
                        const typeColor = roastVal >= 10 ? '#B66A58' : '#7A8F7C';
                        
                        const typeSticker = `<span style="font-size:9px; background:${typeColor}; color:#fff; border-radius:3px; padding:2px 4px; margin-right:5px; vertical-align:middle; display:inline-block; margin-bottom:4px;">${typeText}</span>`;
                        const isBlend = i.sample.toLowerCase().includes('blend') || i.sample.toLowerCase().includes('смесь');
                        const blendLabel = isBlend ? `<span style="font-size:9px; border:1px solid #ccc; border-radius:3px; padding:0 2px; margin-right:5px; vertical-align:middle; display:inline-block; margin-bottom:4px;">BLEND</span>` : '';
                        
                        html += `<tr>
                            <td style="font-weight:600; vertical-align:middle; line-height:1.4;">${typeSticker}${blendLabel}<br>${i.sample}</td>
                            <td style="font-size:10px; opacity:0.8; vertical-align:middle; line-height:1.4;">${i.flavorDesc}</td>
                            <td style="vertical-align:middle;">
                                <div style="display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap;">
                                    <span style="white-space:nowrap;">${i.ws250} ₽</span>
                                    <input type="number" min="0" class="ws-qty-input lc-input" data-item="${i.sample}" data-weight="250" data-price="${i.ws250}" placeholder="0" style="width:45px; padding:4px; text-align:center; height:auto; margin:0;" onchange="UserSystem.updateWholesaleTotal()" onkeyup="UserSystem.updateWholesaleTotal()">
                                </div>
                            </td>
                            <td style="vertical-align:middle;">
                                <div style="display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap;">
                                    <span style="white-space:nowrap;">${i.ws1000} ₽</span>
                                    <input type="number" min="0" class="ws-qty-input lc-input" data-item="${i.sample}" data-weight="1000" data-price="${i.ws1000}" placeholder="0" style="width:45px; padding:4px; text-align:center; height:auto; margin:0;" onchange="UserSystem.updateWholesaleTotal()" onkeyup="UserSystem.updateWholesaleTotal()">
                                </div>
                            </td>
                        </tr>`;
                    });
                    html += `</tbody></table></div>`;

                    html += `<div style="font-size: 10px; color: gray; margin-top: 10px;">Не является публичной офертой.</div>`;
                    html += `<button class="lc-btn" onclick="UserSystem.generatePDF()" style="margin-top: 15px; margin-bottom: 20px; background:#8B7E66; width:auto; padding:10px 25px; display:inline-block;">Скачать прайс</button>`;
                }

                container.innerHTML = html || 'Нет данных для расчета.';

                const orderForm = document.getElementById('wholesale-order-form');
                if (orderForm) {
                    if (itemsList.length > 0) {
                        orderForm.style.display = 'block';
                        if (this.currentUser) {
                            const emailInput = document.getElementById('ws-order-email');
                            if (emailInput && !emailInput.value) emailInput.value = this.currentUser.email;
                        }
                    } else {
                        orderForm.style.display = 'none';
                    }
                }
            },

            updateWholesaleTotal: function() {
                let totalWeightGrams = 0;
                let totalCost = 0;
                
                document.querySelectorAll('.ws-qty-input').forEach(input => {
                    const qty = parseInt(input.value) || 0;
                    if (qty > 0) {
                        const w = parseInt(input.getAttribute('data-weight'));
                        const p = parseInt(input.getAttribute('data-price'));
                        totalWeightGrams += w * qty;
                        totalCost += p * qty;
                    }
                });
                
                const isUrgent = document.getElementById('ws-urgent-order') && document.getElementById('ws-urgent-order').checked;
                if (isUrgent) {
                    totalCost = Math.ceil(totalCost * 1.2);
                }
                
                const weightKg = totalWeightGrams / 1000;
                const weightEl = document.getElementById('ws-total-weight');
                const costEl = document.getElementById('ws-total-cost');
                
                // Пробелы теперь стоят прямо в HTML верстке, здесь передаем только чистые цифры
                if (weightEl) weightEl.textContent = weightKg.toFixed(1);
                if (costEl) costEl.textContent = totalCost.toLocaleString('ru-RU');
                
                const btn = document.getElementById('ws-btn-order');
                const warn = document.getElementById('ws-warning');
                
                if (btn && warn) {
                    if (weightKg >= 5) {
                        btn.disabled = false;
                        warn.style.display = 'none';
                    } else {
                        btn.disabled = true;
                        warn.style.display = 'block';
                    }
                }
            },

            submitWholesaleOrder: async function() {
                // УБРАНА ПРОВЕРКА АВТОРИЗАЦИИ. Теперь любой гость может сделать оптовый заказ.
                
                let items = [];
                let totalCost = 0;
                
                document.querySelectorAll('.ws-qty-input').forEach(input => {
                    const qty = parseInt(input.value) || 0;
                    if (qty > 0) {
                        const w = parseInt(input.getAttribute('data-weight'));
                        const p = parseInt(input.getAttribute('data-price'));
                        const name = input.getAttribute('data-item');
                        items.push({ item: name, weight: w, grind: 'Зерно', price: p, qty: qty });
                        totalCost += p * qty;
                    }
                });
                
                const isUrgent = document.getElementById('ws-urgent-order') && document.getElementById('ws-urgent-order').checked;
                if (isUrgent) {
                    totalCost = Math.ceil(totalCost * 1.2);
                }
                
                const email = document.getElementById('ws-order-email').value.trim();
                const phone = document.getElementById('ws-order-phone').value.trim();
                const reqs = document.getElementById('ws-order-reqs') ? document.getElementById('ws-order-reqs').value.trim() : '';
                
                if (!email || !phone) return alert('Пожалуйста, укажите почту и телефон для связи!');

                const btn = document.getElementById('ws-btn-order');
                const originalText = btn.textContent;
                btn.textContent = 'Оформление...';
                btn.disabled = true;

                const orderData = {
                    id: 'ws_' + Date.now(),
                    total: totalCost,
                    customer: { email: email, phone: phone, isUrgent: isUrgent, requisites: reqs },
                    items: items
                };

                // Берем токен если есть, если нет — отправляем пустую строку
                const token = localStorage.getItem('locus_token') || ''; 

                try {
                    const res = await fetch(LOCUS_API_URL + '?action=placeWholesaleOrder', {
                        method: 'POST',
                        headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'placeWholesaleOrder', order: orderData })
                    });
                    const data = await res.json();
                    if(!data.success) throw new Error(data.error);
                    
                    alert('Оптовый заказ успешно оформлен! Он передан администратору.');
                    
                    // Очистка формы после успешного заказа
                    document.querySelectorAll('.ws-qty-input').forEach(input => input.value = ''); 
                    if(document.getElementById('ws-urgent-order')) document.getElementById('ws-urgent-order').checked = false;
                    if(document.getElementById('ws-order-reqs')) document.getElementById('ws-order-reqs').value = '';
                    this.updateWholesaleTotal();
                } catch (e) {
                    alert('Ошибка при оформлении заказа: ' + e.message);
                    btn.disabled = false;
                } finally {
                    if (btn) btn.textContent = originalText;
                }
            },
            
            generatePDF: function() {
                if(!window.pdfMake) return alert('Библиотека PDF еще не загружена');
                
                const tableBody = [
                    [
                        {text:'Название', bold:true}, 
                        {text:'Описание', bold:true}, 
                        {text:'250\u00A0г', bold:true, alignment: 'center'}, 
                        {text:'1\u00A0кг', bold:true, alignment: 'center'}
                    ]
                ];

                let pdfItems = [];

                ALL_PRODUCTS_CACHE.forEach(p => {
                    // 1. СТРОГИЙ ФИЛЬТР: Пропускаем сорта не в каталоге
                    if (p.inCatalog !== "1" && p.inCatalog !== 1 && p.inCatalog !== true) return;
                    
                    const rawGreen = parseFloat(p.rawGreenPrice || p.raw_green_price) || 0;
                    if (rawGreen) pdfItems.push(p);
                });

                // 2. СОРТИРОВКА: Аналогично таблице на сайте
                pdfItems.sort((a, b) => {
                    const roastA = parseFloat(a.roast) || 0;
                    const roastB = parseFloat(b.roast) || 0;
                    const isEspressoA = roastA >= 10 ? 1 : 0;
                    const isEspressoB = roastB >= 10 ? 1 : 0;
                    
                    if (isEspressoA !== isEspressoB) return isEspressoB - isEspressoA;
                    return a.sample.localeCompare(b.sample);
                });

                // 3. ФОРМИРОВАНИЕ СТРОК ПРАЙСА
                pdfItems.forEach(p => {
                    const rawGreen = parseFloat(p.rawGreenPrice || p.raw_green_price) || 0;
                    const prices = this.calculateWholesalePrice(rawGreen);
                    
                    const roastVal = parseFloat(p.roast) || 0;
                    const typeText = roastVal >= 10 ? 'ЭСПРЕССО' : 'ФИЛЬТР';
                    const isBlend = p.sample.toLowerCase().includes('blend') || p.sample.toLowerCase().includes('смесь');
                    const prefixText = (isBlend ? '[BLEND] ' : '') + `[${typeText}] `;
                    
                    tableBody.push([
                        prefixText + p.sample, 
                        p.flavorDesc || '-', 
                        { text: prices.p250 + '\u00A0₽', alignment: 'center', noWrap: true }, 
                        { text: prices.p1000 + '\u00A0₽', alignment: 'center', noWrap: true }
                    ]);
                });

                const docDefinition = {
                    content: [
                        { text: 'Locus Coffee Roasters', style: 'header', alignment: 'center' },
                        { text: `Оптовый прайс-лист от ${new Date().toLocaleDateString()}`, style: 'subheader', alignment: 'center' },
                        { text: '+7 906 660 4060 | info@locus.coffee', style: 'subheader', alignment: 'center', margin: [0,0,0,20] },
                        {
                            table: {
                                widths: ['25%', '*', 'auto', 'auto'], 
                                body: tableBody
                            }
                        },
                        { text: 'Не является публичной офертой.', style: 'footerText', alignment: 'left', margin: [0, 20, 0, 0] }
                    ],
                    styles: {
                        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
                        subheader: { fontSize: 12, margin: [0, 0, 0, 5] },
                        contacts: { fontSize: 10, italics: true },
                        footerText: { fontSize: 10, color: 'gray', italics: true }
                    }
                };

                pdfMake.createPdf(docDefinition).download('locus_wholesale.pdf');
            },

            // --- CDEK INTEGRATION ---
            calculatePackage: function() {
                let packages = [];
                this.localCart.forEach(item => {
                    for(let i=0; i<item.qty; i++) {
                        if(item.weight === 1000) {
                            packages.push({ weight: 1020, length: 12, width: 10, height: 30 });
                        } else {
                            packages.push({ weight: 265, length: 12, width: 8, height: 18 });
                        }
                    }
                });
                if(packages.length === 0) packages.push({ weight: 265, length: 12, width: 8, height: 18 });
                return packages;
            },

            // --- НАЧАЛО: ЛЕГКИЙ ИНТЕРФЕЙС СДЭК БЕЗ КАРТЫ ---
            initCDEK: function() {
                const cityInput = document.getElementById('cdek-city-input');
                const pvzSelect = document.getElementById('cdek-pvz-select');
                
                if(cityInput && !this.cdekInitialized) {
                    let debounceTimer;
                    cityInput.addEventListener('input', (e) => {
                        clearTimeout(debounceTimer);
                        const query = e.target.value.trim();
                        if(query.length < 3) {
                            document.getElementById('cdek-city-results').style.display = 'none';
                            document.getElementById('cdek-pvz-wrapper').style.display = 'none';
                            return;
                        }
                        debounceTimer = setTimeout(() => this.searchCdekCity(query), 600);
                    });

                    // Скрываем список городов при клике вне него
                    document.addEventListener('click', (e) => {
                        if(e.target !== cityInput) document.getElementById('cdek-city-results').style.display = 'none';
                    });
                }

                if(pvzSelect && !this.cdekInitialized) {
                    pvzSelect.addEventListener('change', (e) => {
                        const selectedOption = e.target.options[e.target.selectedIndex];
                        if(selectedOption.value) {
                            const pvzCode = selectedOption.value;
                            const address = selectedOption.text;
                            const cityCode = selectedOption.getAttribute('data-city-code');
                            this.selectCdekPvz(pvzCode, address, cityCode);
                        }
                    });
                }
                this.cdekInitialized = true;
            },

            searchCdekCity: async function(query) {
                const resultsDiv = document.getElementById('cdek-city-results');
                resultsDiv.innerHTML = '<div style="padding: 12px; font-size: 12px; opacity: 0.6;">Поиск города...</div>';
                resultsDiv.style.display = 'block';

                try {
                    const res = await fetch(`https://functions.yandexcloud.net/d4e5dal47a38n862fndt?action=city&city=${encodeURIComponent(query)}`);
                    const data = await res.json();

                    if(data && data.length > 0) {
                        resultsDiv.innerHTML = '';
                        data.forEach(city => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            div.style.cssText = 'padding: 12px; font-size: 12px; cursor: pointer; border-bottom: 1px solid rgba(105,58,5,0.1); transition: 0.2s;';
                            div.onmouseover = () => div.style.background = '#F4F1EA';
                            div.onmouseout = () => div.style.background = 'transparent';
                            
                            // Формируем красивое название с регионом
                            const regionText = city.region ? `, ${city.region}` : '';
                            div.textContent = `${city.city}${regionText}`;
                            
                            div.onclick = () => {
                                document.getElementById('cdek-city-input').value = city.city;
                                resultsDiv.style.display = 'none';
                                
                                // ИСПРАВЛЕНИЕ: Берем правильное поле city.code
                                this.loadCdekPvzs(city.code);
                            };
                            resultsDiv.appendChild(div);
                        });
                    } else {
                        resultsDiv.innerHTML = '<div style="padding: 12px; font-size: 12px;">Ничего не найдено</div>';
                    }
                } catch(e) {
                    resultsDiv.innerHTML = '<div style="padding: 12px; font-size: 12px; color: red;">Ошибка поиска</div>';
                }
            },

            loadCdekPvzs: async function(cityCode) {
                const pvzWrapper = document.getElementById('cdek-pvz-wrapper');
                const pvzSelect = document.getElementById('cdek-pvz-select');
                pvzWrapper.style.display = 'block';
                pvzSelect.innerHTML = '<option value="">Загрузка списка ПВЗ...</option>';
                pvzSelect.disabled = true;

                try {
                    const res = await fetch(`https://functions.yandexcloud.net/d4e5dal47a38n862fndt?action=offices&city_code=${cityCode}`);
                    const data = await res.json();

                    pvzSelect.innerHTML = '<option value="">Выберите удобный пункт выдачи...</option>';
                    if(data && data.length > 0) {
                        data.forEach(pvz => {
                            const opt = document.createElement('option');
                            opt.value = pvz.code;
                            opt.text = pvz.location.address;
                            opt.setAttribute('data-city-code', cityCode);
                            pvzSelect.appendChild(opt);
                        });
                        pvzSelect.disabled = false;
                    } else {
                        pvzSelect.innerHTML = '<option value="">Нет ПВЗ в этом городе</option>';
                    }
                } catch(e) {
                    pvzSelect.innerHTML = '<option value="">Ошибка загрузки ПВЗ</option>';
                }
            },

            selectCdekPvz: async function(pvzCode, address, cityCode) {
                const cityInput = document.getElementById('cdek-city-input').value;
                const statusEl = document.getElementById('cdek-status');
                const manualInput = document.getElementById('manual-address');
                if (manualInput) manualInput.value = ''; // Очищаем ручной ввод, если выбрали ПВЗ
                
                if(statusEl) {
                    statusEl.innerHTML = `<b>ПВЗ:</b> ${cityInput}, ${address} <br><span style="font-size: 10px; opacity: 0.7;">Рассчитываем стоимость доставки...</span>`;
                    statusEl.style.color = 'var(--locus-dark)';
                }

                try {
                    const packages = this.calculatePackage();
                    // Запрос тарифа (код 136 - Посылка склад-склад)
                    const tariffReq = {
                        type: 1, 
                        currency: 1,
                        tariff_code: 136, 
                        from_location: { code: 269 }, // 269 - это точный код Орла в базе СДЭК
                        to_location: { code: parseInt(cityCode) },
                        packages: packages
                    };

                    const res = await fetch(`https://functions.yandexcloud.net/d4e5dal47a38n862fndt?action=calculate`, {
                        method: 'POST',
                        body: JSON.stringify(tariffReq)
                    });
                    const data = await res.json();

                    let price = 350; // Страховочная цена
                    if(data && data.delivery_sum) {
                        price = Math.ceil(data.delivery_sum);
                    } else if (data && data.requests && data.requests.length > 0 && data.requests[0].errors) {
                        console.error('Ошибка СДЭК тарифа:', data.requests[0].errors);
                    }

                    this.cdekInfo = {
                        type: 'PVZ', tariff: 136, city: cityInput,
                        address: address, pvzCode: pvzCode, rawPrice: price
                    };

                    if(statusEl) {
                        statusEl.innerHTML = `<b>Доставка в ПВЗ:</b><br>${cityInput}, ${address}`;
                        statusEl.style.color = '#187a30';
                    }

                    this.calculateDeliveryCost(price);

                } catch(e) {
                    console.error("Error calculating tariff", e);
                    this.calculateDeliveryCost(350); // Fallback
                }
            },
            // --- КОНЕЦ: ЛЕГКИЙ ИНТЕРФЕЙС СДЭК БЕЗ КАРТЫ ---

            handleCdekChoice: function(type, tariff, address) {
                const price = parseInt(address.price) || 0;
                this.cdekInfo = {
                    type: type, tariff: tariff, city: address.city,
                    address: address.address, pvzCode: address.id || null, rawPrice: price
                };
                const statusEl = document.getElementById('cdek-status');
                if(statusEl) {
                    statusEl.innerHTML = `<b>${type === 'PVZ' ? 'ПВЗ' : 'Курьер'}:</b> ${address.city}, ${address.address}`;
                    statusEl.style.color = '#187a30';
                }
                this.calculateDeliveryCost(price);
            },

            calculateDeliveryCost: function(basePrice) {
                let subtotal = 0;
                this.localCart.forEach(i => subtotal += (i.price * i.qty));
                let loyaltyDiscountVal = 0;
                if(this.currentUser) {
                    const discountPercent = Math.min(Math.floor(this.currentUser.totalSpent / 3000), 10);
                    loyaltyDiscountVal = Math.floor(subtotal * (discountPercent / 100));
                }
                const totalAfterLoyalty = subtotal - loyaltyDiscountVal;

                if (totalAfterLoyalty >= 3000) this.cdekPrice = 0;
                else this.cdekPrice = basePrice;
                this.updateCartTotals();
            },
            // --- КОНЕЦ: СДЭК И РУЧНОЙ ВВОД ---

            fetchUserData: async function() {
                if(!this.uid) return;
                const token = localStorage.getItem('locus_token');
                if(!token) return;
                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getUserData', {
                        headers: { 'X-Auth-Token': token } 
                    });
                    const data = await res.json();
                    if(data.user) {
                        // 1. Бронебойный парсер: превращаем строки от YDB в нормальные массивы
                        const parseSafe = (arr) => {
                            if (typeof arr === 'string') { try { return JSON.parse(arr); } catch(e) { return []; } }
                            if (Array.isArray(arr)) return arr;
                            return [];
                        };

                        this.currentUser = data.user;
                        this.currentUser.cart = parseSafe(this.currentUser.cart);
                        this.currentUser.history = parseSafe(this.currentUser.history);
                        this.currentUser.subscription = parseSafe(this.currentUser.subscription);

                        // 2. Умная синхронизация корзины (решает проблему исчезновения)
                        if (this.currentUser.cart.length > 0) {
                            this.localCart = this.currentUser.cart;
                            this.saveCart(false); 
                        } else if (this.localCart.length > 0) {
                            // Если на сервере пусто, а локально есть товары - пушим их на сервер!
                            this.saveCart(true);
                        }
                        
                        this.updateCartBadge();
                        let spent = parseFloat(this.currentUser.totalSpent);
                        if(isNaN(spent) || spent > 1000000000) spent = 0;
                        this.currentUser.totalSpent = spent;
                        
                        // Мгновенная перерисовка, если ЛК открыт
                        if(document.getElementById('lc-modal').classList.contains('active')) {
                            this.renderDashboard();
                        }
                    }
                } catch(e) { console.error('Ошибка профиля', e); }
            },
            
            backgroundSync: async function() {
                if(!this.uid) return;
                const token = localStorage.getItem('locus_token');
                if(!token) return;
                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getUserData', {
                        headers: { 'X-Auth-Token': token } 
                    });
                    const data = await res.json();
                    if(data.user) {
                        const parseSafe = (arr) => {
                            if (typeof arr === 'string') { try { return JSON.parse(arr); } catch(e) { return []; } }
                            if (Array.isArray(arr)) return arr;
                            return [];
                        };

                        const serverData = data.user;
                        serverData.cart = parseSafe(serverData.cart);
                        serverData.history = parseSafe(serverData.history);
                        serverData.subscription = parseSafe(serverData.subscription);

                        if(JSON.stringify(serverData.history) !== JSON.stringify(this.currentUser.history) || 
                           JSON.stringify(serverData.subscription) !== JSON.stringify(this.currentUser.subscription) ||
                           JSON.stringify(serverData.cart) !== JSON.stringify(this.localCart)) {
                            
                            this.currentUser = serverData;
                            
                            if (serverData.cart.length > 0) { 
                                this.localCart = serverData.cart; 
                                this.saveCart(false); 
                                this.updateCartBadge(); 
                            }
                            
                            if(document.getElementById('lc-modal').classList.contains('active')) {
                                this.renderDashboard();
                                if(document.getElementById('view-cart').classList.contains('show-view')) { this.renderCart(); }
                            }
                        }
                    }
                } catch(e) {}
            },
            // --- КОНЕЦ: ЗАМЕНА СДЭК И СИНХРОНИЗАЦИИ ---

            // --- НАЧАЛО: ИСПРАВЛЕННОЕ ОТКРЫТИЕ ОКОН ---
            toggleModal: function(show, initialView = 'dashboard') {
                const m = document.getElementById('lc-modal');
                if(!m) return;
                if(show) {
                    document.body.style.overflow = 'hidden';
                    m.classList.add('active');
                    if(initialView === 'wholesale') m.classList.add('wide'); else m.classList.remove('wide');
                    
                    if(initialView === 'cart') { 
                        this.renderCart(); 
                        this.switchView('cart'); 
                    } 
                    else if (initialView === 'admin') { 
                        m.classList.add('wide');
                        this.switchView('admin'); 
                        
                        this.loadUsers(); 
                        this.loadPromos(); 
                        
                        PromotionSystem.loadActionsList();
                        MessageSystem.loadMessagesForAdmin();
                    }
                    else if(initialView === 'wholesale') { this.switchView('wholesale'); }
                    else if(this.uid) { this.renderDashboard(); this.switchView('dashboard'); } 
                    else { this.switchView('login'); }
                } else { 
                    document.body.style.overflow = '';
                    m.classList.remove('active'); 
                }
            },
            // --- КОНЕЦ: ИСПРАВЛЕННОЕ ОТКРЫТИЕ ОКОН ---

            switchView: function(viewName) {
                ['view-login', 'view-register', 'view-dashboard', 'view-cart', 'view-admin', 'view-wholesale'].forEach(id => {
                    const el = document.getElementById(id); if(el) el.classList.remove('show-view');
                });
                const view = document.getElementById(`view-${viewName}`); if(view) view.classList.add('show-view');
            },
            
            toggleSection: function(secName) {
                const content = document.getElementById(`cont-${secName}`);
                const arrow = document.getElementById(`arrow-${secName}`);
                if (content.classList.contains('hidden')) {
                    content.classList.remove('hidden');
                    arrow.classList.remove('rotated');
                } else {
                    content.classList.add('hidden');
                    arrow.classList.add('rotated');
                }
            },
            
            switchAdminTab: function(tabName) {
                ['catalog','users', 'promos', 'subs', 'costs', 'actions', 'messages', 'ws-orders', 'orders'].forEach(t => {
                    const sec = document.getElementById(`admin-sec-${t}`);
                    if(sec) sec.classList.remove('active');
                });
                const activeSec = document.getElementById(`admin-sec-${tabName}`);
                if(activeSec) activeSec.classList.add('active');
                
                const tabs = document.querySelectorAll('.admin-tab');
                tabs.forEach(t => t.classList.remove('active'));
                const clickedBtn = Array.from(tabs).find(b => b.getAttribute('onclick').includes(`'${tabName}'`));
                if(clickedBtn) clickedBtn.classList.add('active');

                if (tabName === 'promos') this.loadPromos();
                if (tabName === 'subs') this.loadActiveSubs();
                if (tabName === 'users') this.loadUsers();
                if (tabName === 'actions') PromotionSystem.loadActionsList();
                if (tabName === 'messages') MessageSystem.loadMessagesForAdmin();
                if (tabName === 'ws-orders') this.loadWholesaleOrders();
                if (tabName === 'catalog') CatalogSystem.loadData();
                if (tabName === 'orders') this.loadRetailOrders();
            },

            // --- НАЧАЛО: АДМИНКА - ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ ИЗ YDB ---
            loadUsers: async function() {
                const container = document.getElementById('admin-sec-users');
                container.innerHTML = '<div class="loader" style="position:relative; top:0; color:var(--locus-dark);">Загрузка базы YDB...</div>';

                const token = localStorage.getItem('locus_token');
                if(!token) return container.innerHTML = 'Нет доступа';

                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getAdminUsers', {
                        headers: { 'X-Auth-Token': token }
                    });
                    const data = await res.json();
                    
                    if (!data.success) throw new Error(data.error || 'Ошибка загрузки');

                    let totalRevenue = 0;
                    let totalOrders = 0;
                    let usersList = [];

                    data.users.forEach(u => {
                        const history = u.history || [];
                        const spent = u.totalSpent || 0;
                        totalRevenue += spent;
                        totalOrders += history.length;

                        let freq = "Нет покупок";
                        if(history.length === 1) freq = "Новичок (1)";
                        else if(history.length > 10) freq = "VIP (>10)";
                        else if(history.length > 3) freq = "Постоянный";
                        else if(history.length > 1) freq = "Активный";

                        let fav = "-";
                        if(history.length > 0) {
                            const counts = {};
                            history.forEach(h => { 
                                // Проверяем: это новый формат (Заказ) или старый (отдельная пачка)
                                if (h.isOrder && Array.isArray(h.items)) {
                                    h.items.forEach(i => {
                                        if (i.item) {
                                            const name = i.item.split(' (')[0];
                                            counts[name] = (counts[name] || 0) + (i.qty || 1); 
                                        }
                                    });
                                } else if (h.item) { // Старый формат
                                    const name = h.item.split(' (')[0];
                                    counts[name] = (counts[name] || 0) + (h.qty || 1); 
                                }
                            });
                            
                            if (Object.keys(counts).length > 0) {
                                fav = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
                            }
                        }

                        let discount = Math.floor(spent / 3000);
                        if(discount > 10) discount = 10;

                        usersList.push({
                            id: u.id,
                            email: u.email,
                            spent: spent,
                            discount: discount,
                            freq: freq,
                            fav: fav
                        });
                    });

                    usersList.sort((a, b) => b.spent - a.spent);

                    let html = `
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:20px; text-align:center;">
                            <div style="background:#fff; padding:10px; border:1px solid #E5E1D8; border-radius:8px;">
                                <div style="font-size:10px; color:gray; text-transform:uppercase;">Оборот</div>
                                <div style="font-size:16px; font-weight:bold;">${totalRevenue.toLocaleString()} ₽</div>
                            </div>
                            <div style="background:#fff; padding:10px; border:1px solid #E5E1D8; border-radius:8px;">
                                <div style="font-size:10px; color:gray; text-transform:uppercase;">Товаров куплено</div>
                                <div style="font-size:16px; font-weight:bold;">${totalOrders}</div>
                            </div>
                            <div style="background:#fff; padding:10px; border:1px solid #E5E1D8; border-radius:8px;">
                                <div style="font-size:10px; color:gray; text-transform:uppercase;">Ср. цена товара</div>
                                <div style="font-size:16px; font-weight:bold;">${totalOrders ? Math.round(totalRevenue/totalOrders) : 0} ₽</div>
                            </div>
                        </div>
                    `;

                    html += `
                        <div style="overflow-x:auto;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Клиент</th>
                                    <th>Скидка</th>
                                    <th>Любимый сорт</th>
                                    <th>Статус</th>
                                    <th>LTV (Сумма)</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    usersList.forEach(u => {
                        html += `
                            <tr>
                                <td>
                                    <div style="font-weight:600;">${u.email}</div>
                                    <div style="font-size:9px; opacity:0.6;">ID: ...${u.id.slice(-5)}</div>
                                </td>
                                <td>${u.discount}%</td>
                                <td style="font-size:10px;">${u.fav}</td>
                                <td style="font-size:10px;">${u.freq}</td>
                                <td style="font-weight:bold;">${u.spent} ₽</td>
                            </tr>
                        `;
                    });

                    html += `</tbody></table></div>`;
                    container.innerHTML = html;

                } catch(e) {
                    console.error(e);
                    container.innerHTML = `<div style="color:#B66A58">Ошибка: ${e.message}</div>`;
                }
            },
            // --- КОНЕЦ: АДМИНКА - ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ ИЗ YDB ---
            // --- НАЧАЛО: ПРОМОКОДЫ YDB ---
            loadPromos: async function() {
                const list = document.getElementById('admin-promo-list');
                list.innerHTML = 'Загрузка...';
                const token = localStorage.getItem('locus_token');
                if(!token) return list.innerHTML = 'Нет доступа';

                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getPromos', {
                        headers: { 'X-Auth-Token': token }
                    });
                    const data = await res.json();
                    list.innerHTML = '';
                    if (!data.success) throw new Error(data.error);
                    
                    if(data.promos.length === 0) list.innerHTML = '<div style="opacity:0.5; font-size:12px;">Нет промокодов</div>';

                    data.promos.forEach(p => {
                        const div = document.createElement('div');
                        div.className = 'promo-list-item';
                        div.innerHTML = `
                            <div>
                                <strong>${p.id}</strong> 
                                <span style="font-size:10px; color:gray;">(${p.val} ${p.type === 'percent' ? '%' : 'RUB'})</span>
                            </div>
                            <div style="display:flex; gap:10px; align-items:center;">
                                <input type="checkbox" ${p.active ? 'checked' : ''} onchange="UserSystem.togglePromo('${p.id}', this.checked)">
                                <button onclick="UserSystem.deletePromo('${p.id}')" style="border:none; background:transparent; color:#B66A58; cursor:pointer;">&times;</button>
                            </div>
                        `;
                        list.appendChild(div);
                    });
                } catch(e) { console.error(e); list.innerHTML = 'Ошибка загрузки'; }
            },

            addPromo: async function() {
                const code = document.getElementById('new-promo-code').value.toUpperCase().trim();
                const val = parseFloat(document.getElementById('new-promo-val').value);
                const type = document.getElementById('new-promo-type').value;
                if(!code || !val) return alert('Заполните код и значение');
                
                const token = localStorage.getItem('locus_token');
                try {
                    await fetch(LOCUS_API_URL + '?action=addPromo', {
                        method: 'POST',
                        headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'addPromo', id: code, val: val, type: type, active: true })
                    });
                    document.getElementById('new-promo-code').value = '';
                    this.loadPromos();
                } catch(e) { alert('Ошибка добавления: ' + e.message); }
            },

            togglePromo: async function(id, status) {
                const token = localStorage.getItem('locus_token');
                try { 
                    await fetch(LOCUS_API_URL + '?action=togglePromo', {
                        method: 'POST',
                        headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'togglePromo', id: id, active: status })
                    });
                } catch(e) { console.error(e); }
            },

            deletePromo: async function(id) {
                if(!confirm('Удалить промокод?')) return;
                const token = localStorage.getItem('locus_token');
                try { 
                    await fetch(LOCUS_API_URL + '?action=deletePromo', {
                        method: 'POST',
                        headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'deletePromo', id: id })
                    });
                    this.loadPromos(); 
                } catch(e) { console.error(e); }
            },

            applyPromo: async function() {
                const input = document.getElementById('cart-promo-input');
                const code = input.value.toUpperCase().trim();
                if(!code) return;

                try {
                    const res = await fetch(LOCUS_API_URL + '?action=checkPromo&id=' + code);
                    const data = await res.json();
                    
                    if(data.success && data.promo && data.promo.active) {
                        this.activePromo = { ...data.promo, code: code };
                        alert(`Промокод ${code} применен!`);
                        this.updateCartTotals();
                    } else {
                        alert('Промокод не найден или неактивен');
                        this.activePromo = null;
                        this.updateCartTotals();
                    }
                } catch(e) { console.error(e); }
            },
            
            verifyActivePromo: async function() {
                if (this.activePromo) {
                    try {
                        const res = await fetch(LOCUS_API_URL + '?action=checkPromo&id=' + this.activePromo.code);
                        const data = await res.json();
                        if (!data.success || !data.promo || !data.promo.active) {
                            this.activePromo = null;
                            alert("Внимание! Примененный ранее промокод перестал действовать или был удален.");
                            this.updateCartTotals();
                        }
                    } catch(e) { console.error(e); }
                }
            },
            // --- КОНЕЦ: ПРОМОКОДЫ YDB ---

            // --- НАЧАЛО: АДМИНКА - ОТОБРАЖЕНИЕ ПОДПИСОК YDB ---
            loadActiveSubs: async function() {
                const container = document.getElementById('admin-sec-subs');
                if(!container) return;
                container.innerHTML = '<div class="loader" style="position:relative; top:0; color:var(--locus-dark);">Сбор активных подписок...</div>';

                const token = localStorage.getItem('locus_token');
                if(!token) return container.innerHTML = 'Нет доступа';

                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getAdminSubs', { 
                        headers: { 'X-Auth-Token': token } 
                    });
                    const data = await res.json();
                    
                    if (!data.success) throw new Error(data.error || 'Ошибка загрузки');

                    if(data.subs.length === 0) {
                        container.innerHTML = '<div style="padding:20px; opacity:0.5; text-align:center;">Активных подписок пока нет</div>';
                        return;
                    }

                    // Сортируем: сначала самые новые
                    data.subs.sort((a, b) => {
                        const [d1,m1,y1] = a.dateAdded.split('.');
                        const [d2,m2,y2] = b.dateAdded.split('.');
                        return new Date(`${y2}-${m2}-${d2}`) - new Date(`${y1}-${m1}-${d1}`);
                    });

                    let html = `
                        <div style="margin-bottom: 15px; font-size: 14px; color: var(--locus-dark);">
                            Всего активных лотов в подписках: <b>${data.subs.length}</b>
                        </div>
                        <div style="overflow-x:auto;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Клиент</th>
                                    <th>Лот</th>
                                    <th>Детали</th>
                                    <th>Цена</th>
                                    <th>Добавлен</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    data.subs.forEach(s => {
                        html += `
                            <tr>
                                <td><div style="font-weight:600; font-size:12px;">${s.email}</div></td>
                                <td style="font-weight:bold; color:var(--locus-dark);">${s.item}</td>
                                <td style="font-size:11px; opacity:0.8;">${s.weight} г<br>${s.grind}</td>
                                <td style="font-weight:bold;">${s.price} ₽</td>
                                <td style="font-size:10px; color:gray;">${s.dateAdded}</td>
                            </tr>
                        `;
                    });

                    html += `</tbody></table></div>`;
                    container.innerHTML = html;

                } catch(e) {
                    console.error(e);
                    container.innerHTML = `<div style="color:#B66A58">Ошибка: ${e.message}</div>`;
                }
            },
            // --- КОНЕЦ: АДМИНКА - ОТОБРАЖЕНИЕ ПОДПИСОК YDB ---

            // --- НАЧАЛО: АДМИНКА - ОПТОВЫЕ ЗАКАЗЫ ---
            loadWholesaleOrders: async function() {
                const container = document.getElementById('admin-ws-orders-list');
                if(!container) return;
                container.innerHTML = '<div class="loader" style="position:relative; top:0; color:var(--locus-dark);">Загрузка заказов...</div>';
                
                const token = localStorage.getItem('locus_token');
                try {
                    const res = await fetch(LOCUS_API_URL + '?action=getAdminWholesaleOrders', { headers: { 'X-Auth-Token': token } });
                    const data = await res.json();
                    if(!data.success) throw new Error(data.error);
                    
                    if(data.orders.length === 0) {
                        container.innerHTML = '<div style="opacity:0.5; text-align:center; padding:20px;">Новых оптовых заказов пока нет</div>';
                        return;
                    }
                    
                    // Умная сортировка дат (независимо от того, секунды от базы это или миллисекунды)
                    const getMs = (val) => {
                        const ts = Number(val);
                        if (!isNaN(ts)) return ts < 3000000000 ? ts * 1000 : ts;
                        return new Date(val).getTime() || 0;
                    };
                    data.orders.sort((a,b) => getMs(b.createdAt) - getMs(a.createdAt));
                    
                    // Ограничиваем ширину колонки "Дата" (70px), чтобы дать больше места Описанию и Реквизитам
                    let html = '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th style="width: 70px;">Дата</th><th>Клиент</th><th>Состав заказа</th><th>Сумма</th><th style="width: 70px;">Статус</th><th style="width: 50px; text-align:center;">Удалить</th></tr></thead><tbody>';
                    
                    data.orders.forEach(o => {
                        // 1. Исправление бага 1970 года
                        let d = new Date(o.createdAt);
                        const ts = Number(o.createdAt);
                        // Если это секунды (значение меньше 3 миллиардов), переводим в миллисекунды
                        if (!isNaN(ts) && ts > 0 && ts < 3000000000) {
                            d = new Date(ts * 1000); 
                        } else if (!isNaN(ts) && ts >= 3000000000) {
                            d = new Date(ts);
                        }
                        if (isNaN(d.getTime())) d = new Date(); // Запасной вариант

                        // 2. Жесткая привязка к Московскому времени (GMT+3)
                        const datePart = d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' });
                        const timePart = d.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
                        
                        // 3. Перенос времени под дату
                        const dateStrHTML = `${datePart}<br><span style="font-size:10px; opacity:0.6;">${timePart}</span>`;

                        const itemsHtml = o.items.map(i => `<span style="font-weight:600">${i.item}</span>: ${i.weight}г x ${i.qty} шт.`).join('<br>');
                        
                        const phone = o.customer && o.customer.phone ? o.customer.phone : 'Не указан';
                        const email = o.customer && o.customer.email ? o.customer.email : 'Не указан';
                        const reqs = o.customer && o.customer.requisites ? o.customer.requisites : '';
                        
                        let rowStyle = '';
                        if (o.status === 'wholesale_new') rowStyle = 'background-color:#fef6f5;';
                        else if (o.status === 'completed') rowStyle = 'background-color:#f0f0f0; opacity: 0.6;'; 

                        // Выравниваем контент по верхнему краю (vertical-align:top), чтобы из-за блока реквизитов другие ячейки не "уплывали" вниз
                        html += `<tr style="${rowStyle}">
                            <td style="font-size:11px; white-space:nowrap; vertical-align:top; padding-top:10px;">${dateStrHTML}</td>
                            <td style="font-size:12px; vertical-align:top; padding-top:10px;">
                                ${email}<br><span style="color:gray">${phone}</span>
                                ${reqs ? `<div style="margin-top:6px; font-size:10px; line-height:1.3; color:#444; background:rgba(255,255,255,0.7); padding:6px; border-radius:4px; border:1px dashed #ccc; max-height:60px; overflow-y:auto;"><b>Реквизиты:</b><br>${reqs.replace(/\n/g, '<br>')}</div>` : ''}
                            </td>
                            <td style="font-size:11px; line-height:1.4; vertical-align:top; padding-top:10px;">${itemsHtml}</td>
                            <td style="font-weight:bold; vertical-align:top; padding-top:10px;">${o.total.toLocaleString('ru-RU')} ₽</td>
                            <td style="vertical-align:top; padding-top:6px;">
                                <select class="lc-input" style="padding:4px; font-size:11px; margin:0; min-width:60px; max-width:80px; width:100%;" onchange="UserSystem.updateOrderStatus('${o.id}', this.value)">
                                    <option value="wholesale_new" ${o.status === 'wholesale_new' ? 'selected' : ''}>Новый</option>
                                    <option value="wholesale_processed" ${o.status === 'wholesale_processed' ? 'selected' : ''}>В работе</option>
                                    <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Выполнено</option>
                                </select>
                            </td>
                            <td style="text-align:center; vertical-align:top; padding-top:8px;">
                                <button onclick="UserSystem.deleteWholesaleOrder('${o.id}')" style="color:#B66A58; border:1px solid #B66A58; background:transparent; border-radius:4px; cursor:pointer; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; transition:0.2s;" onmouseover="this.style.background='#B66A58'; this.style.color='#fff';" onmouseout="this.style.background='transparent'; this.style.color='#B66A58';">&times;</button>
                            </td>
                        </tr>`;
                    });
                    html += '</tbody></table></div>';
                    container.innerHTML = html;
                } catch(e) { container.innerHTML = '<div style="color:red; font-size:12px;">Ошибка загрузки</div>'; console.error(e); }
            },
            loadRetailOrders: async function() {
                const container = document.getElementById('admin-orders-list');
                if(!container) return;
                container.innerHTML = '<div class="loader" style="position:relative; top:0; color:var(--locus-dark);">Загрузка заказов...</div>';
                
                const token = localStorage.getItem('locus_token');
                try {
                    // Используем тот же API, но запрашиваем розничные заказы. 
                    // ВНИМАНИЕ: Для этого твоя Яндекс Функция должна поддерживать action=getAdminOrders
                    const res = await fetch(LOCUS_API_URL + '?action=getAdminOrders', { headers: { 'X-Auth-Token': token } });
                    const data = await res.json();
                    if(!data.success) throw new Error(data.error);
                    
                    if(data.orders.length === 0) {
                        container.innerHTML = '<div style="opacity:0.5; text-align:center; padding:20px;">Новых розничных заказов пока нет</div>';
                        return;
                    }
                    
                    // Сортировка (новые сверху)
                    data.orders.sort((a,b) => b.invId - a.invId);
                    
                    let html = '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>Заказ и Клиент</th><th>Состав и Сумма</th><th>Адрес доставки</th><th style="width: 100px;">Статус</th></tr></thead><tbody>';
                    
                    data.orders.forEach(o => {
                        const datePart = new Date(o.invId * 1000).toLocaleString('ru-RU');
                        const customer = o.customer || {};
                        const delivery = o.delivery || {};
                        
                        const itemsHtml = (o.items || []).map(i => `<span style="font-weight:600">${i.item}</span> <span style="font-size:10px; color:gray;">(${i.weight}г, ${i.grind})</span> x ${i.qty} шт.`).join('<br>');
                        
                        let rowStyle = '';
                        if (o.status === 'pending_payment') rowStyle = 'background-color:#fef6f5;';
                        else if (o.status === 'completed' || o.status === 'shipped') rowStyle = 'background-color:#f0f0f0; opacity: 0.6;'; 

                        html += `<tr style="${rowStyle}">
                            <td style="vertical-align:top; padding-top:10px; font-size:12px; line-height:1.4;">
                                <b style="font-size:13px;">№ ${o.id}</b><br>
                                <span style="font-size:10px; color:gray;">${datePart}</span><br>
                                <div style="margin-top:8px;"><b>${customer.name || 'Без ФИО'}</b></div>
                                <div style="color:gray;">${customer.phone || ''}</div>
                                <div style="color:gray;">${customer.email || ''}</div>
                            </td>
                            <td style="vertical-align:top; padding-top:10px; font-size:12px; line-height:1.5;">
                                ${itemsHtml}
                                <div style="margin-top:8px; font-weight:bold; font-size:14px;">Итого: ${o.total.toLocaleString('ru-RU')} ₽</div>
                            </td>
                            <td style="vertical-align:top; padding-top:10px; font-size:11px; line-height:1.4;">
                                <b>${delivery.type === 'PVZ' ? 'СДЭК ПВЗ' : (delivery.type === 'MANUAL' ? 'Ручной ввод' : 'Курьер')}</b><br>
                                ${delivery.city || ''}<br>
                                ${delivery.address || ''}<br>
                                <span style="color:gray; font-size:10px;">Стоимость: ${delivery.finalCost} ₽</span>
                            </td>
                            <td style="vertical-align:top; padding-top:10px;">
                                <select class="lc-input" style="padding:4px; font-size:11px; margin:0; width:100%;" onchange="UserSystem.updateRetailOrderStatus('${o.id}', this.value)">
                                    <option value="pending_payment" ${o.status === 'pending_payment' ? 'selected' : ''}>Не оплачен</option>
                                    <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>Оплачен</option>
                                    <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>В сборке</option>
                                    <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Отправлен</option>
                                    <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Выполнен</option>
                                </select>
                            </td>
                        </tr>`;
                    });
                    html += '</tbody></table></div>';
                    container.innerHTML = html;
                } catch(e) { container.innerHTML = '<div style="color:red; font-size:12px;">Ошибка загрузки</div>'; console.error(e); }
            },

            updateRetailOrderStatus: async function(orderId, newStatus) {
                const token = localStorage.getItem('locus_token');
                try {
                    await fetch(LOCUS_API_URL + '?action=updateOrderStatus', {
                        method: 'POST', headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'updateOrderStatus', orderId: orderId, status: newStatus })
                    });
                    this.loadRetailOrders();
                } catch(e) { alert('Ошибка обновления статуса'); }
            },
            updateOrderStatus: async function(orderId, newStatus) {
                const token = localStorage.getItem('locus_token');
                try {
                    await fetch(LOCUS_API_URL + '?action=updateOrderStatus', {
                        method: 'POST',
                        headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'updateOrderStatus', orderId: orderId, status: newStatus })
                    });
                    this.loadWholesaleOrders(); 
                } catch(e) { alert('Ошибка обновления статуса'); }
            },
            // Пункт 8: Новая функция для удаления заказа с запросом в YDB
            deleteWholesaleOrder: async function(orderId) {
                if(!confirm('Удалить этот оптовый заказ? Это действие необратимо.')) return;
                const token = localStorage.getItem('locus_token');
                try {
                    await fetch(LOCUS_API_URL + '?action=deleteWholesaleOrder', {
                        method: 'POST',
                        headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'deleteWholesaleOrder', orderId: orderId })
                    });
                    this.loadWholesaleOrders(); // Мгновенно обновляем таблицу
                } catch(e) { alert('Ошибка удаления: ' + e.message); }
            },

           addToCart: function(item, weight = 250, grind = "Зерно") {
                    const product = ALL_PRODUCTS_CACHE.find(p => (p.sample || p.sample_no || "").trim() === item.trim());
                if(!product) return alert("Ошибка товара: лот не найден в каталоге.");
                
                const isAroma = (product.category && product.category.toLowerCase().includes('ароматизация'));
                if (isAroma) grind = "Зерно (Ароматизация)";
                
                // Подтягиваем расчет из базы
                const rawGreen = parseFloat(product.rawGreenPrice || product.raw_green_price) || 0;
                const prices = this.calculateRetailPrices(rawGreen);
                const truePrice = weight === 1000 ? prices.p1000 : prices.p250;

                if (truePrice === 0) return alert("Цена для этого лота еще не рассчитана (в Extrinsic форме нет цены).");

                const existing = this.localCart.find(i => i.item === item && i.weight == weight && i.grind === grind);
                if(existing) existing.qty++;
                else this.localCart.push({ item, price: truePrice, weight: weight, qty: 1, grind: grind });
                
                this.saveCart(true);
                this.updateCartBadge();
                alert(`"${item}" (${weight} г, ${grind}) добавлен в корзину`);
            },

            // --- НАЧАЛО: НОВОЕ СОХРАНЕНИЕ КОРЗИНЫ ---
            saveCart: async function(syncToDb = false) { 
                localStorage.setItem('locus_cart', JSON.stringify(this.localCart)); 
                if (syncToDb && this.uid) {
                    const token = localStorage.getItem('locus_token');
                    if(token) {
                        try {
                            await fetch(LOCUS_API_URL + '?action=updateUser', {
                                method: 'POST',
                                headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' }, // Заменили заголовок
                                body: JSON.stringify({ action: 'updateUser', field: 'cart', data: this.localCart })
                            });
                        } catch(e) { console.error('Ошибка сохранения корзины', e); }
                    }
                }
                this.cdekInitialized = false; 
            },
            // --- КОНЕЦ: НОВОЕ СОХРАНЕНИЕ КОРЗИНЫ ---

            updateCartBadge: function() {
                const badge = document.getElementById('cart-count');
                const totalQty = this.localCart.reduce((acc, i) => acc + i.qty, 0);
                if(badge) { badge.textContent = totalQty; totalQty > 0 ? badge.classList.add('show') : badge.classList.remove('show'); }
            },

            renderCart: function() {
                const list = document.getElementById('cart-items-list');
                if(!list) return;
                list.innerHTML = '';
                
                if(this.localCart.length === 0) {
                    list.style.flex = '0 0 auto';
                    list.innerHTML = '<div style="opacity:0.5; text-align:center; padding-bottom: 20px;">Корзина пуста</div>';
                    this.updateCartTotals(); return;
                }
                
                this.localCart.forEach((p, idx) => {
                    const el = document.createElement('div');
                    el.className = 'cart-item-row';
                    const wDisplay = p.weight ? ` ${p.weight} г` : '';
                    const gDisplay = p.grind ? ` <span style="font-size:10px; opacity:0.7; border:1px solid #ccc; padding:0 3px; border-radius:3px;">${p.grind}</span>` : '';
                    
                    el.innerHTML = `
                        <div class="cart-item-info"><div class="cart-item-title">${p.item}${wDisplay}${gDisplay}</div><div class="cart-item-meta">${p.price} ₽</div></div>
                        <div class="cart-controls"><button class="qty-btn minus">-</button><span class="cart-qty">${p.qty}</span><button class="qty-btn plus">+</button></div>
                    `;
                    el.querySelector('.minus').onclick = () => this.updateItemQty(idx, -1);
                    el.querySelector('.plus').onclick = () => this.updateItemQty(idx, 1);
                    list.appendChild(el);
                });
                this.updateCartTotals();
                // Автозаполнение Email
                const emailInput = document.getElementById('order-email');
                if (emailInput && !emailInput.value && this.currentUser && this.currentUser.email) {
                    emailInput.value = this.currentUser.email;
                }
            },

            updateItemQty: function(idx, delta) {
                this.localCart[idx].qty += delta;
                if(this.localCart[idx].qty <= 0) this.localCart.splice(idx, 1);
                this.saveCart(true);
                this.updateCartBadge();
                this.renderCart();
                this.cdekInitialized = false;
                this.initCDEK();
            },

            updateCartTotals: function() {
                let subtotal = 0;
                this.localCart.forEach(i => subtotal += (i.price * i.qty));
                let discountPercent = 0;
                if(this.currentUser) {
                    discountPercent = Math.floor(this.currentUser.totalSpent / 3000);
                    if(discountPercent > 10) discountPercent = 10;
                }
                
                let loyaltyDiscountVal = Math.floor(subtotal * (discountPercent / 100));
                let totalAfterLoyalty = subtotal - loyaltyDiscountVal;

                if (totalAfterLoyalty >= 3000) {
                    this.cdekPrice = 0;
                }

                let promoDiscountVal = 0;
                if (this.activePromo) {
                    if (this.activePromo.type === 'percent') {
                        promoDiscountVal = Math.floor(totalAfterLoyalty * (this.activePromo.val / 100));
                    } else {
                        promoDiscountVal = this.activePromo.val;
                    }
                }

                let finalTotal = totalAfterLoyalty - promoDiscountVal + (this.cdekPrice || 0);
                if (finalTotal < 0) finalTotal = 1;

                const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
                setTxt('cart-subtotal', subtotal + ' ₽');
                setTxt('cart-discount-percent', discountPercent);
                setTxt('cart-discount-val', loyaltyDiscountVal + ' ₽');
                
                const shipValEl = document.getElementById('cart-shipping-val');
                if(shipValEl) {
                    if (this.cdekPrice === 0 && totalAfterLoyalty >= 3000) {
                        shipValEl.innerHTML = `<span style="color:#187a30; font-weight:bold;">Бесплатно</span>`;
                    } else if (this.cdekPrice > 0) {
                        shipValEl.textContent = this.cdekPrice + ' ₽';
                    } else {
                        shipValEl.textContent = 'Не выбрано';
                    }
                }

                setTxt('cart-total', finalTotal + ' ₽');

                const promoRow = document.getElementById('row-promo-discount');
                const promoValEl = document.getElementById('cart-promo-val');
                if (this.activePromo) {
                    promoRow.style.display = 'flex';
                    promoValEl.textContent = `-${promoDiscountVal} ₽ (${this.activePromo.code})`;
                } else {
                    promoRow.style.display = 'none';
                }
            },

            // --- НАЧАЛО: ВАЛИДАЦИЯ И ОФОРМЛЕНИЕ ЗАКАЗА ---
            placeOrder: async function() {
                if(this.localCart.length === 0) return alert('Корзина пуста');
                if(!this.uid) return alert('Для оформления заказа нужно войти');
                
                const name = document.getElementById('order-name').value.trim();
                const phone = document.getElementById('order-phone').value.trim();
                const emailInput = document.getElementById('order-email');
                const email = emailInput ? emailInput.value.trim() : this.currentUser.email;
                const policy = document.getElementById('policy-check').checked;
                
                // ЖЕСТКАЯ ВАЛИДАЦИЯ
                if(!name || !phone || !email) return alert('Заполните ФИО, телефон и e-mail');
                
                const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s\-]{2,100}$/;
                if(!nameRegex.test(name)) {
                    return alert('Пожалуйста, введите корректное ФИО (без цифр и странных символов).');
                }

                const phoneDigits = phone.replace(/\D/g, '');
                if(phoneDigits.length < 10 || phoneDigits.length > 15 || /(.)\1{5,}/.test(phoneDigits)) {
                    return alert('Пожалуйста, введите корректный номер телефона.');
                }

                if(!this.cdekInfo) {
                    return alert('Пожалуйста, выберите пункт выдачи на карте или введите адрес вручную.');
                }
                
                if(this.cdekInfo.type === 'MANUAL') {
                    const addr = this.cdekInfo.address;
                    if(addr.length < 10 || !/[a-zA-Zа-яА-ЯёЁ]/.test(addr) || /(.)\1{4,}/.test(addr)) {
                        return alert('Пожалуйста, введите корректный и полный адрес доставки.');
                    }
                }

                if(!policy) return alert('Необходимо согласие с Политикой конфиденциальности');

                const btn = document.getElementById('btn-checkout');
                if(btn) { btn.disabled = true; btn.textContent = 'Обработка...'; }

                let subtotal = 0;
                this.localCart.forEach(i => subtotal += (i.price * i.qty));
                let discountPercent = Math.floor(this.currentUser.totalSpent / 3000);
                if(discountPercent > 10) discountPercent = 10;
                let total = subtotal - Math.floor(subtotal * (discountPercent / 100));

                let shippingCost = this.cdekPrice;
                if (total >= 3000) shippingCost = 0;

                if(this.activePromo) {
                    let promoD = 0;
                    if(this.activePromo.type === 'percent') promoD = Math.floor(total * (this.activePromo.val / 100));
                    else promoD = this.activePromo.val;
                    total -= promoD;
                }

                total += shippingCost;
                if(total < 1) total = 1;

                try {
                    const invId = Math.floor(Date.now() / 1000);
                    const orderId = invId.toString();

                    // Формируем новый ОБЪЕКТ ЗАКАЗА для истории
                    const historyOrder = {
                        isOrder: true,
                        orderId: orderId,
                        date: new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }),
                        total: total,
                        items: JSON.parse(JSON.stringify(this.localCart)) // Копируем товары из корзины
                    };

                    const orderData = {
                        id: orderId,
                        invId: invId,
                        total: total,
                        discountPercent: discountPercent,
                        promo: this.activePromo ? this.activePromo.code : '',
                        status: 'pending_payment',
                        customer: { name, phone, email: email },
                        delivery: { ...this.cdekInfo, finalCost: shippingCost },
                        items: this.localCart,
                        historyItems: [historyOrder] // Отправляем как заказ
                    };

                    const token = localStorage.getItem('locus_token');
                    if(!token) throw new Error('Пожалуйста, авторизуйтесь заново');

                    const res = await fetch(LOCUS_API_URL + '?action=placeOrder', {
                        method: 'POST',
                        headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'placeOrder', order: orderData })
                    });
                    const data = await res.json();
                    if (data.error || data.errorMessage) throw new Error(data.error || data.errorMessage);

                    // Добавляем ЗАКАЗ в локальную историю
                    if(!this.currentUser.history) this.currentUser.history = [];
                    this.currentUser.history.push(historyOrder);

                    this.localCart = [];
                    this.activePromo = null;
                    this.saveCart(false);
                    this.updateCartBadge();
                    
                    const outSum = total.toString();
                    const signatureValue = CryptoJS.MD5(`${ROBOKASSA_LOGIN}:${outSum}:${invId}:${ROBOKASSA_PASS1}`).toString();
                    const robokassaUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?MerchantLogin=${ROBOKASSA_LOGIN}&OutSum=${outSum}&InvId=${invId}&Description=CoffeeOrder&SignatureValue=${signatureValue}&Email=${this.currentUser.email}`;

                    window.location.href = robokassaUrl;
                } catch (e) {
                    console.error(e);
                    alert('Ошибка создания заказа: ' + e.message);
                    if(btn) { btn.disabled = false; btn.textContent = 'Оформить и оплатить'; }
                }
            },
            // --- КОНЕЦ: ВАЛИДАЦИЯ И ОФОРМЛЕНИЕ ЗАКАЗА ---

            // --- НАЧАЛО: НОВАЯ АВТОРИЗАЦИЯ ЧЕРЕЗ YDB ---
                register: async function() {
                    const email = document.getElementById('reg-email')?.value; 
                    const pass = document.getElementById('reg-pass')?.value;
                    if(!email || !pass) return alert('Заполните поля');
                    try {
                        const res = await fetch(LOCUS_API_URL + '?action=register', {
                            method: 'POST',
                            body: JSON.stringify({ action: 'register', email, password: pass })
                        });
                        const data = await res.json();
                        
                        if (!res.ok || data.error || data.errorMessage) {
                            throw new Error(data.error || data.errorMessage || 'Ошибка сервера: ' + res.status);
                        }
                        
                        localStorage.setItem('locus_token', data.token);
                        this.uid = data.user.id;
                        // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: пропускаем данные через нашу умную функцию
                        await this.fetchUserData(); 
                        
                        this.updateUIState();
                        this.switchView('dashboard');
                        alert('Регистрация успешна!');
                    } catch (e) { alert('Ошибка: ' + e.message); }
                },

                login: async function() {
                    const email = document.getElementById('login-email')?.value; 
                    const pass = document.getElementById('login-pass')?.value;
                    if(!email || !pass) return alert('Заполните поля');
                    try {
                        const res = await fetch(LOCUS_API_URL + '?action=login', {
                            method: 'POST',
                            body: JSON.stringify({ action: 'login', email, password: pass })
                        });
                        const data = await res.json();
                        
                        if (!res.ok || data.error || data.errorMessage) {
                            throw new Error(data.error || data.errorMessage || 'Ошибка сервера: ' + res.status);
                        }
                        
                        localStorage.setItem('locus_token', data.token);
                        this.uid = data.user.id;
                        // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: пропускаем данные через нашу умную функцию
                        await this.fetchUserData(); 
                        
                        this.updateUIState();
                        this.switchView('dashboard');
                    } catch (e) { alert('Ошибка: ' + e.message); }
                },

                logout: async function() {
                    localStorage.removeItem('locus_token');
                    this.currentUser = null; this.uid = null; this.localCart = []; 
                    this.saveCart(false); this.updateCartBadge(); this.updateUIState(); this.switchView('login');
                },
                // --- КОНЕЦ: НОВАЯ АВТОРИЗАЦИЯ ЧЕРЕЗ YDB ---

            updateUIState: function() {
                const txt = document.getElementById('auth-status-text'); if(txt) txt.textContent = this.uid ? 'Кабинет' : 'Войти';
                if(this.localCart.length > 0) this.updateCartTotals();
            },
            
            addToSubscription: async function(itemName, weight = 250, grind = "Зерно") {
                if(!this.uid) return alert("Для оформления подписки необходимо войти в Личный кабинет.");
                if(!this.currentUser.subscription) this.currentUser.subscription = [];
                if(this.currentUser.subscription.find(s => s.item === itemName && s.weight === weight && s.grind === grind)) return alert('Этот сорт уже в подписке');

                const product = ALL_PRODUCTS_CACHE.find(p => (p.sample || p.sample_no || "").trim() === itemName.trim());
                if(!product) return alert("Ошибка товара: лот не найден в каталоге.");

                // Подтягиваем расчет из базы
                const rawGreen = parseFloat(product.rawGreenPrice || product.raw_green_price) || 0;
                const prices = this.calculateRetailPrices(rawGreen);
                const weightPrice = weight === 1000 ? prices.p1000 : prices.p250;
                
                if (weightPrice === 0) return alert("Цена для этого лота еще не рассчитана (в Extrinsic форме нет цены).");
                
                const subPrice = weightPrice > 50 ? weightPrice - 50 : weightPrice;

                const subItem = { item: itemName, price: subPrice, weight: weight, grind: grind, dateAdded: new Date().toLocaleDateString(), active: true };
                this.currentUser.subscription.push(subItem);
                
                alert(`Сорт "${itemName}" (${weight} г, ${grind}) добавлен в вашу подписку.`);
                this.renderDashboard();
                
                const token = localStorage.getItem('locus_token');
                if(token) {
                    try {
                        await fetch(LOCUS_API_URL + '?action=updateUser', {
                            method: 'POST',
                            headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'updateUser', field: 'subscription', data: this.currentUser.subscription })
                        });
                    } catch(e) { console.error('Ошибка добавления подписки', e); }
                }
            },
            
            toggleSubStatus: async function(itemIndex) {
                if(!this.uid || !this.currentUser.subscription[itemIndex]) return;
                const newStatus = !this.currentUser.subscription[itemIndex].active;
                this.currentUser.subscription[itemIndex].active = newStatus;
                this.renderDashboard();

                const token = localStorage.getItem('locus_token');
                if(token) {
                    try {
                        await fetch(LOCUS_API_URL + '?action=updateUser', {
                            method: 'POST',
                            headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'updateUser', field: 'subscription', data: this.currentUser.subscription })
                        });
                    } catch(e) { 
                        this.currentUser.subscription[itemIndex].active = !newStatus; 
                        this.renderDashboard(); 
                    }
                }
            },
            
            removeFromSubscription: async function(subItemFull) {
                if(!this.uid) return;
                const prev = [...this.currentUser.subscription];
                this.currentUser.subscription = this.currentUser.subscription.filter(s => !(s.item === subItemFull.item && s.weight === subItemFull.weight && s.grind === subItemFull.grind));
                this.renderDashboard(); 
                
                const token = localStorage.getItem('locus_token');
                if(token) {
                    try {
                        await fetch(LOCUS_API_URL + '?action=updateUser', {
                            method: 'POST',
                            headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'updateUser', field: 'subscription', data: this.currentUser.subscription })
                        });
                    } catch(e) { 
                        this.currentUser.subscription = prev; 
                        this.renderDashboard(); 
                    }
                }
            },

            removeFromHistory: async function(histItemFull) {
                if(!this.uid) return;
                const prev = [...this.currentUser.history];
                this.currentUser.history = this.currentUser.history.filter(h => !(h.item === histItemFull.item && h.date === histItemFull.date));
                this.renderDashboard();

                const token = localStorage.getItem('locus_token');
                if(token) {
                    try {
                        await fetch(LOCUS_API_URL + '?action=updateUser', {
                            method: 'POST',
                            headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'updateUser', field: 'history', data: this.currentUser.history })
                        });
                    } catch(e) { 
                        this.currentUser.history = prev; 
                        this.renderDashboard(); 
                    }
                }
            },
            removeOrderFromHistory: async function(orderId) {
                if(!this.uid) return;
                const prev = [...this.currentUser.history];
                this.currentUser.history = this.currentUser.history.filter(h => h.orderId !== orderId);
                this.renderDashboard();
                
                const token = localStorage.getItem('locus_token');
                if(token) {
                    try {
                        await fetch(LOCUS_API_URL + '?action=updateUser', {
                            method: 'POST', headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'updateUser', field: 'history', data: this.currentUser.history })
                        });
                    } catch(e) { 
                        this.currentUser.history = prev; 
                        this.renderDashboard(); 
                    }
                }
            },
            // --- НАЧАЛО: ЗАМЕНА ОТОБРАЖЕНИЯ ЛК (ИСТОРИЯ) ---
            renderDashboard: function() {
                try {
                    if(!this.currentUser) return;
                    const u = this.currentUser;
                    const safeSpent = isNaN(u.totalSpent) ? 0 : u.totalSpent;
                    let discountPercent = Math.floor(safeSpent / 3000);
                    if(discountPercent > 10) discountPercent = 10;
                    
                    const elDiscount = document.getElementById('user-discount-val'); if (elDiscount) elDiscount.textContent = discountPercent + '%';
                    let progress = discountPercent < 10 ? ((safeSpent % 3000) / 3000) * 100 : 100;
                    const elProgress = document.getElementById('user-progress-fill');
                    if (elProgress) elProgress.style.width = progress + '%';

                    const elNext = document.getElementById('user-next-level');
                    if (elNext) {
                        if(discountPercent < 10) { const remainder = 3000 - (safeSpent % 3000);
                            elNext.innerHTML = `Потрачено: <b>${safeSpent} ₽</b>.<br>До следующего % осталось: <b>${remainder} ₽</b>`;
                        } 
                        else { elNext.textContent = 'Вы достигли максимальной скидки!';
                        }
                    }

                    const isAdmin = (u.email === 'info@locus.coffee');
                    const feedbackArea = document.querySelector('.feedback-area');
                    const msgSection = document.getElementById('user-messages-section');
                    
                    if (isAdmin) {
                        if(feedbackArea) feedbackArea.style.display = 'none';
                        if(msgSection) msgSection.style.display = 'none';
                    } else {
                        if(feedbackArea) feedbackArea.style.display = 'block';
                        if(msgSection) msgSection.style.display = 'block';
                    }

                    const renderList = (containerId, items, isSub) => {
                        const cont = document.getElementById(containerId); if(!cont) return;
                        cont.innerHTML = '';
                        if(!items || items.length === 0) { cont.innerHTML = '<div style="opacity:0.5; font-size:11px">Список пуст</div>'; return; }

                        let itemsToShow = [...items].reverse();
                        if (!isSub) {
                            itemsToShow = itemsToShow.slice(0, 5);
                        }

                        itemsToShow.forEach((item, originalIndex) => {
                            if (!item || !item.item) return;
                            const realIndex = u.subscription.findIndex(s => s === item);

                            let productInStock;
                            const itemString = String(item.item).toLowerCase();

                            // Умный поиск: ищем частичное совпадение имени в кэше
                            productInStock = ALL_PRODUCTS_CACHE.find(p => {
                                const cacheName = String(p.sample).toLowerCase();
                                return itemString.includes(cacheName) || cacheName.includes(itemString.split(' (')[0]);
                            });

                            const el = document.createElement('div');
                            el.className = 'product-list-item';
                            const wDisplay = item.weight ? ` ${item.weight} г` : '';
                            const gDisplay = item.grind && item.grind !== 'Зерно' ? ` <span style="font-size:10px; opacity:0.7; border:1px solid #ccc; padding:0 3px; border-radius:3px;">${item.grind}</span>` : '';

                            let meta = isSub ? `В подписке • ${item.price} ₽` : `${item.date} • ${item.price} ₽`;
                            if(!productInStock && isSub) meta += ` <span style="color:#B66A58">(Нет в наличии)</span>`;

                            let checkBoxHTML = '';
                            if (isSub) {
                                const checked = item.active !== false ? 'checked' : '';
                                checkBoxHTML = `<input type="checkbox" class="sub-active-check" ${checked} style="margin-right:10px; accent-color:var(--locus-dark); transform:scale(1.2);">`;
                            }

                            el.innerHTML = `
                                <div style="display:flex; align-items:center;">
                                    ${checkBoxHTML}
                                    <div class="pli-info"><div class="pli-name">${item.item}${wDisplay}${gDisplay} ${!isSub ? `x${item.qty}` : ''}</div><div class="pli-meta">${meta}</div></div>
                                </div>
                                <div style="display:flex; gap:5px; align-items:center;">
                                    ${!isSub && productInStock ? `<button class="btn-small-reorder btn-action-reorder">Повторить</button>` : ''}
                                    <button class="btn-small-reorder btn-remove-sub" style="font-size:16px; padding:4px 8px; line-height:1;">&times;</button>
                                </div>
                            `;

                            if (isSub) {
                                const chk = el.querySelector('.sub-active-check');
                                chk.onchange = () => this.toggleSubStatus(realIndex);
                            }

                            if(!isSub && productInStock) {
                                const btnAction = el.querySelector('.btn-action-reorder');
                                if(btnAction) btnAction.onclick = (e) => {
                                    e.preventDefault(); e.stopImmediatePropagation();
                                    this.addToCart(productInStock.sample, item.weight || 250);
                                    this.toggleModal(true, 'cart');
                                };
                            }
                            const btnRemove = el.querySelector('.btn-remove-sub');
                            if(btnRemove) btnRemove.onclick = (e) => {
                                e.preventDefault(); e.stopImmediatePropagation();
                                if(confirm('Удалить?')) isSub ? this.removeFromSubscription(item) : this.removeFromHistory(item);
                            };
                            cont.appendChild(el);
                        });
                    };
                    renderList('user-subscription-list', u.subscription, true);
                   // --- НОВАЯ ОТРИСОВКА ИСТОРИИ (С ПОДДЕРЖКОЙ ЗАКАЗОВ) ---
                    const histCont = document.getElementById('user-history-list');
                    if(histCont) {
                        histCont.innerHTML = '';
                        if(!u.history || u.history.length === 0) {
                            histCont.innerHTML = '<div style="opacity:0.5; font-size:11px">Список пуст</div>';
                        } else {
                            const itemsToShow = [...u.history].reverse().slice(0, 15);
                            itemsToShow.forEach(hItem => {
                                if (hItem.isOrder) {
                                    // Отрисовка НОВОГО БЛОКА ЗАКАЗА
                                    const el = document.createElement('div');
                                    el.style.cssText = 'border: 1px solid var(--locus-border); border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #fff; box-shadow: 0 4px 10px rgba(105,58,5,0.03);';

                                    let itemsHtml = hItem.items.map(i => {
                                        const grindText = i.grind && i.grind !== 'Зерно' ? ` <span style="font-size:9px; opacity:0.7; border:1px solid #ccc; padding:0 3px; border-radius:3px;">${i.grind}</span>` : '';
                                        return `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px; border-bottom:1px dashed #eee; padding-bottom:8px;">
                                            <span><b style="font-weight:600;">${i.item}</b> (${i.weight}г)${grindText} x${i.qty}</span>
                                            <span style="white-space:nowrap; font-weight:600;">${i.price * i.qty} ₽</span>
                                        </div>`;
                                    }).join('');

                                    el.innerHTML = `
                                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 15px; border-bottom: 1px solid var(--locus-border); padding-bottom: 12px;">
                                            <div>
                                                <div style="font-weight:700; font-size:13px; color:var(--locus-dark); text-transform:uppercase;">Заказ № ${hItem.orderId}</div>
                                                <div style="font-size:10px; color:gray; margin-top:3px;">${hItem.date}</div>
                                            </div>
                                            <div style="font-weight:700; font-size:16px;">${hItem.total} ₽</div>
                                        </div>
                                        <div style="margin-bottom:15px;">
                                            ${itemsHtml}
                                        </div>
                                        <div style="display:flex; gap:10px; justify-content:flex-end;">
                                            <button class="btn-small-reorder btn-repeat-order" style="padding:8px 15px; font-size:10px;">Повторить заказ</button>
                                            <button class="btn-small-reorder btn-remove-sub" style="font-size:12px; padding:8px 12px;">&times; Удалить</button>
                                        </div>
                                    `;

                                    // Обработчик "Повторить весь заказ"
                                    el.querySelector('.btn-repeat-order').onclick = (e) => {
                                        e.preventDefault(); e.stopImmediatePropagation();
                                        hItem.items.forEach(i => {
                                            const existing = this.localCart.find(cartItem => cartItem.item === i.item && cartItem.weight == i.weight && cartItem.grind === i.grind);
                                            if(existing) existing.qty += i.qty;
                                            else this.localCart.push({ ...i });
                                        });
                                        this.saveCart(true);
                                        this.updateCartBadge();
                                        this.toggleModal(true, 'cart');
                                    };

                                    // Обработчик "Удалить заказ из истории"
                                    el.querySelector('.btn-remove-sub').onclick = (e) => {
                                        e.preventDefault(); e.stopImmediatePropagation();
                                        if(confirm('Удалить этот заказ из истории?')) this.removeOrderFromHistory(hItem.orderId);
                                    };

                                    histCont.appendChild(el);
                                } else {
                                    // СОХРАНЕНИЕ СТАРОГО ФОРМАТА (Для старых покупок)
                                    const productInStock = ALL_PRODUCTS_CACHE.find(p => String(hItem.item).toLowerCase().includes(String(p.sample).toLowerCase().split(' (')[0]));
                                    const el = document.createElement('div');
                                    el.className = 'product-list-item';
                                    const wDisplay = hItem.weight ? ` ${hItem.weight} г` : '';
                                    const gDisplay = hItem.grind && hItem.grind !== 'Зерно' ? ` <span style="font-size:10px; opacity:0.7; border:1px solid #ccc; padding:0 3px; border-radius:3px;">${hItem.grind}</span>` : '';
                                    
                                    el.innerHTML = `
                                        <div style="display:flex; align-items:center;">
                                            <div class="pli-info"><div class="pli-name">${hItem.item}${wDisplay}${gDisplay} x${hItem.qty || 1}</div><div class="pli-meta">${hItem.date} • ${hItem.price} ₽</div></div>
                                        </div>
                                        <div style="display:flex; gap:5px; align-items:center;">
                                            ${productInStock ? `<button class="btn-small-reorder btn-action-reorder">Повторить</button>` : ''}
                                            <button class="btn-small-reorder btn-remove-sub" style="font-size:16px; padding:4px 8px; line-height:1;">&times;</button>
                                        </div>
                                    `;
                                    if(productInStock) {
                                        el.querySelector('.btn-action-reorder').onclick = () => {
                                            this.addToCart(productInStock.sample, hItem.weight || 250, hItem.grind || 'Зерно');
                                            this.toggleModal(true, 'cart');
                                        };
                                    }
                                    el.querySelector('.btn-remove-sub').onclick = () => { if(confirm('Удалить?')) this.removeFromHistory(hItem); };
                                    histCont.appendChild(el);
                                }
                            });
                        }
                    }
                    // -----------------------------------------------------------------
                    this.renderRecommendations();
                } catch(e) { console.error(e); }
            },
            // --- КОНЕЦ: ЗАМЕНА ОТОБРАЖЕНИЯ ЛК (ИСТОРИЯ) ---

            renderRecommendations: function() {
                const recContainer = document.getElementById('user-recommendations-list');
                if(!recContainer) return;
                recContainer.innerHTML = '';
                
                const history = this.currentUser?.history || [];
                if(history.length === 0) { recContainer.innerHTML = '<div style="font-size: 11px; opacity: 0.5;">Сделайте заказ для рекомендаций.</div>'; return; }

                let userDescriptors = new Set();
                history.forEach(hItem => {
                    const cleanName = hItem.item.split(' (')[0].trim();
                    const product = ALL_PRODUCTS_CACHE.find(p => p.sample.trim() === cleanName);
                    if(product && product.flavorNotes) {
                        product.flavorNotes.split(',').forEach(tag => {
                            const t = tag.trim().toLowerCase();
                            if(t) userDescriptors.add(t);
                        });
                    }
                });

                if(userDescriptors.size === 0) return; 

                const recommendations = ALL_PRODUCTS_CACHE.filter(p => {
                    if(p.inCatalog !== "1") return false;
                    if(!p.flavorNotes) return false;
                    const pTags = p.flavorNotes.split(',').map(t => t.trim().toLowerCase());
                    if(pTags.length === 0) return false;
                    let matchCount = 0;
                    pTags.forEach(tag => { if(userDescriptors.has(tag)) matchCount++; });
                    return (matchCount / pTags.length) >= 0.3;
                });

                const finalRecs = recommendations.slice(0, 3);
                if(finalRecs.length > 0) {
                    finalRecs.forEach(p => {
                        const el = document.createElement('div');
                        el.className = 'product-list-item';
                        el.innerHTML = `<div class="pli-info"><div class="pli-name">${p.sample}</div><div class="pli-meta">Вам понравится</div></div><button class="btn-small-reorder">В корзину</button>`;
                        el.querySelector('button').onclick = () => this.addToCart(p.sample, 250);
                        recContainer.appendChild(el);
                    });
                } else { recContainer.innerHTML = '<div style="font-size: 11px; opacity: 0.5;">Мы подбираем для вас лучшие сорта.</div>'; }
            }
        };

        window.UserSystem = UserSystem;

        async function fetchExternalData() {
            try {
                // 1. Делаем два запроса ПАРАЛЛЕЛЬНО для максимальной скорости загрузки
                const [catRes, extRes] = await Promise.all([
                    fetch(YANDEX_FUNCTION_URL + "?type=catalog").then(r => r.json()),
                    fetch(LOCUS_API_URL + "?action=getExtrinsicData").then(r => r.json()).catch(() => ({success: false, data: []}))
                ]);
                
                if (!catRes.success) throw new Error(catRes.error || "Ошибка загрузки каппингов");
                console.log("ОТВЕТ БЕКЕНДА (EXT + AI):", extRes);

                // 2. Собираем словари с ЗАЩИТОЙ РЕГИСТРА
                const extMap = {};
                const aiMap = {}; 
                
                if (extRes.ai_stories) {
                    for (let k in extRes.ai_stories) {
                        aiMap[k.trim().toLowerCase()] = extRes.ai_stories[k];
                    }
                }
                
                if (extRes.success && extRes.data) {
                    extRes.data.forEach(e => {
                        if(e.sample_no) extMap[e.sample_no.trim().toLowerCase()] = e;
                    });
                }

                ALL_PRODUCTS_CACHE = [];
                
                catRes.data.forEach(r => {
                    const sName = r.sample_no || r.sample;
                    
                    if (sName) {
                        const extItem = extMap[sName.trim().toLowerCase()] || {};
                        const extData = extItem.form_data || {};

                        const getE = (key) => {
                            if (extData[key] !== undefined && String(extData[key]).trim() !== '') return extData[key];
                            return '';
                        };

                        const raw = { 
                            cuppingDate: r.cupping_date, 
                            sample: sName, 
                            roast: r.roast_level, 
                            smellInt: r.fragrance, 
                            aromaInt: r.aroma, 
                            aromaDesc: r.aroma_descriptors, 
                            aromaNotes: r.aroma_notes, 
                            flavorInt: r.flavor, 
                            atInt: r.aftertaste, 
                            flavorDesc: r.flavor_descriptors, 
                            mainFlavors: r.main_tastes, 
                            flavorNotes: r.flavor_notes, 
                            acidInt: r.acidity, 
                            acidNotes: r.acidity_notes, 
                            sweetInt: r.sweetness, 
                            sweetNotes: r.sweetness_notes, 
                            bodyInt: r.mouthfeel, 
                            bodyDesc: r.mouthfeel_descriptors, 
                            bodyNotes: r.mouthfeel_notes, 
                            inCatalog: r.in_catalogue, 
                            category: r.category || '', 
                            price: r.price || '0',
                            rawGreenPrice: parseFloat(r.raw_green_price || extItem.raw_green_price || getE('Farm Gate Price')) || 0,
                            
                            // ДОБАВЛЕНО ПОЛЕ ИСТОРИИ ИЗ БАЗЫ
                            aiStory: aiMap[sName.trim().toLowerCase()] || null,
                            
                            country: getE('Country'),
                            region: getE('Region'),
                            farm: getE('Name of farm or Co-op'),
                            producer: getE('Name of Producer(s)'),
                            variety: getE('Species Variety or Varieties'),
                            harvest: getE('Harvest Date/Year'),
                            processor: getE('Name of Processor(s)'),
                            wetMill: getE('Wet Mill / Station'),
                            dryMill: getE('Dry Mill'),
                            processType: getE('Process Type'),
                            washed: getE('Washed'),
                            natural: getE('Natural'),
                            decaf: getE('Decaffeinated'),
                            processDesc: getE('Process Description'),
                            grade: getE('Grade'),
                            ico: getE('ICO Number'),
                            importer: getE('Name of Importer'),
                            exporter: getE('Name of Exporter'),
                            farmGatePrice: getE('Farm Gate Price'),
                            lotSize: getE('Lot Size'),
                            cert4C: getE('4C'),
                            certFairTrade: getE('Fair trade'),
                            certOrganic: getE('Organic'),
                            certRainforest: getE('Rainforest Alliance'),
                            certFoodSafety: getE('Food Safety'),
                            otherCertifications: getE('Other_Certifications'),
                            otherFarming: getE('Other_Farming'),
                            otherProcessor: getE('Other_Processor'),
                            otherProcessType: getE('Other_Process_Type'),
                            otherTrading: getE('Other_Trading'),
                            awards: getE('Awards')
                        };

                        ALL_PRODUCTS_CACHE.push(raw);
                        
                        if(raw.inCatalog === "1" || raw.inCatalog === 1 || raw.inCatalog === true) {
                            const roastVal = parseFloat(raw.roast);
                            let targetCategoryLabel = 'ФИЛЬТР'; 
                            
                            const dbCat = raw.category ? String(raw.category).toLowerCase() : '';
                            
                            if (dbCat.includes('ароматизация')) {
                                targetCategoryLabel = 'АРОМАТИЗАЦИЯ';
                            } else if (roastVal >= 10) { 
                                targetCategoryLabel = 'ЭСПРЕССО'; 
                            }
                            
                            const target = SHOP_DATA.find(c => c.label === targetCategoryLabel);
                            if (target) {
                                const petalColor = mixFlavorColors(raw.flavorDesc + " " + raw.mainFlavors, target.color);
                                let wheelLabel = raw.sample;
                                const words = wheelLabel.split(' ');
                                if(words.length > 2) {
                                    const mid = Math.ceil(words.length / 2);
                                    wheelLabel = words.slice(0, mid).join(' ') + '\n' + words.slice(mid).join(' ');
                                }
                                target.children.push({ label: wheelLabel, color: petalColor, depth: 1, raw: raw });
                            }
                        }
                    }
                });
                renderWheel();
                initWheelInteraction();
                UserSystem.init();
            } catch (e) { 
                console.error("Ошибка загрузки каталога:", e); 
                document.getElementById('loading-overlay').textContent = "Ошибка загрузки";
                renderWheel(); 
                UserSystem.init(); 
            }
        }
        fetchExternalData();