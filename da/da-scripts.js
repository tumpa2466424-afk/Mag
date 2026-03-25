// === ФУНКЦИЯ АВТОМАТИЧЕСКОГО ПОВТОРА ПРИ СБОЯХ СЕТИ ===
async function fetchWithRetry(url, options, maxRetries = 3, retryDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            // Если сервер ответил ошибкой 500, 502, 503 или 504, имеет смысл попробовать снова
            if (!response.ok && response.status >= 500 && attempt < maxRetries) {
                console.warn(`Попытка ${attempt} не удалась (статус ${response.status}). Повтор через ${retryDelay}мс...`);
                await new Promise(res => setTimeout(res, retryDelay));
                continue;
            }
            // Если все ОК или ошибка клиента (например, 400 Bad Request), возвращаем ответ
            return response; 
        } catch (error) {
            // Ошибка сети (Failed to fetch). Если попытки исчерпаны — пробрасываем ошибку дальше
            if (attempt === maxRetries) throw error; 
            
            console.warn(`Ошибка сети на попытке ${attempt}: ${error.message}. Повтор через ${retryDelay}мс...`);
            await new Promise(res => setTimeout(res, retryDelay));
        }
    }
}
    // === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И СИНХРОНИЗАЦИЯ ===
    window.globalActiveSample = 1;

    // === ГЛОБАЛЬНЫЙ ТАЙМЕР ===
    let globalTimerInterval = null;
    let globalTimerSeconds = 0;
    let isGlobalTimerRunning = false;

    function formatGlobalTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    window.globalToggleTimer = function() {
        const btnCvad = document.getElementById('cvad-mainTimer');
        const btnCvaa = document.getElementById('cvaa-mainTimer');

        if (isGlobalTimerRunning) {
            clearInterval(globalTimerInterval);
            isGlobalTimerRunning = false;
            if(btnCvad) btnCvad.classList.remove('running');
            if(btnCvaa) btnCvaa.classList.remove('running');
        } else {
            isGlobalTimerRunning = true;
            if(btnCvad) btnCvad.classList.add('running');
            if(btnCvaa) btnCvaa.classList.add('running');
            
            globalTimerInterval = setInterval(() => {
                globalTimerSeconds++;
                const timeStr = formatGlobalTime(globalTimerSeconds);
                if(btnCvad) btnCvad.innerHTML = timeStr;
                if(btnCvaa) btnCvaa.innerHTML = timeStr;
            }, 1000);
        }
    };

    window.globalResetTimer = function() {
        if (globalTimerInterval) clearInterval(globalTimerInterval);
        isGlobalTimerRunning = false;
        globalTimerSeconds = 0;
        const btnCvad = document.getElementById('cvad-mainTimer');
        const btnCvaa = document.getElementById('cvaa-mainTimer');
        
        if(btnCvad) {
            btnCvad.classList.remove('running');
            btnCvad.innerHTML = `00:00`;
        }
        if(btnCvaa) {
            btnCvaa.classList.remove('running');
            btnCvaa.innerHTML = `00:00`;
        }
    };

    // Маппинг секций: Дескриптивная (CVAD) -> Аффективная (CVAA)
    const mapCvadToCvaa = {
        'aroma': 'fragrance',           // Запах и Аромат -> Запах
        'flavor': 'bouquet',            // Букет и Послевкусие -> Букет
        'acidity-sweetness': 'acidity', // Кислотность и Сладость -> Кислотность
        'mouthfeel': 'tactility'        // Тактильность -> Тактильность
    };

    // Маппинг секций: Аффективная (CVAA) -> Дескриптивная (CVAD)
    const mapCvaaToCvad = {
        'fragrance': 'aroma',
        'aroma': 'aroma',
        'bouquet': 'flavor',
        'aftertaste': 'flavor',
        'acidity': 'acidity-sweetness',
        'sweetness': 'acidity-sweetness',
        'tactility': 'mouthfeel',
        'overall': 'mouthfeel'
    };

    // Единая функция переключения вкладок (образцов) для обеих форм
    window.globalSwitchTab = function(sampleId) {
        window.globalActiveSample = sampleId;

        // Синхронизация вкладок CVAD
        document.querySelectorAll("#cvad-wrapper .tab-btn").forEach(t => {
            if (parseInt(t.getAttribute("data-tab")) === sampleId) t.classList.add("active");
            else t.classList.remove("active");
        });
        document.querySelectorAll("#cvad-wrapper .sample-form").forEach(f => {
            if (parseInt(f.getAttribute("data-id")) === sampleId) f.classList.add("active");
            else f.classList.remove("active");
        });

        // Синхронизация вкладок CVAA
        document.querySelectorAll('#cvaa-wrapper .tab-btn').forEach((btn, idx) => {
            if ((idx + 1) === sampleId) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        document.querySelectorAll('#cvaa-wrapper .sample-content').forEach(div => {
            if (div.id === `sample-${sampleId}`) div.classList.add('active');
            else div.classList.remove('active');
        });

        if (window.updateGlobalScoreDisplay) window.updateGlobalScoreDisplay();
    };

    // 100% надежное определение видимой секции ДО переключения
    function getVisibleSection(app) {
        const containerId = app === 'cvad' ? 'cvad-scroll-container' : 'cvaa-scroll-container';
        const container = document.getElementById(containerId);
        if (!container) return null;

        const header = container.querySelector('.tabs-header');
        if (!header) return null;

        // Точка сканирования: нижняя граница шапки (относительно экрана) + 10px вниз
        const headerRect = header.getBoundingClientRect();
        const targetY = headerRect.bottom + 10;

        let sections = [];
        if (app === 'cvad') {
            const activeForm = document.querySelector(`#cvad-wrapper .sample-form[data-id="${window.globalActiveSample}"]`);
            if (activeForm) sections = Array.from(activeForm.querySelectorAll('fieldset[data-section]'));
        } else {
            const activeForm = document.querySelector(`#cvaa-wrapper #sample-${window.globalActiveSample}`);
            if (activeForm) sections = Array.from(activeForm.querySelectorAll('.attribute-container'));
        }

        let bestMatch = null;
        let minDistance = Infinity;

        sections.forEach(sec => {
            const rect = sec.getBoundingClientRect();
            // Секция пересекает нашу точку фокуса
            if (rect.top <= targetY && rect.bottom >= targetY) {
                bestMatch = sec;
                minDistance = 0; 
            } else if (minDistance !== 0) {
                // Если мы еще не нашли 100% пересечение, ищем ближайшую по верхней границе
                const dist = Math.abs(rect.top - targetY);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestMatch = sec;
                }
            }
        });

        if (!bestMatch) return null;

        if (app === 'cvad') {
            return bestMatch.getAttribute('data-section');
        } else {
            return bestMatch.id.split('-')[2];
        }
    }

    // 100% точная прокрутка до элемента путем вычисления пиксельных отступов
    function scrollToTarget(el, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !el) return;

        const header = container.querySelector('.tabs-header');
        const headerHeight = header ? header.offsetHeight : 0;
        const extraPadding = 10; // Небольшой эстетический зазор

        // Идем вверх по дереву и складываем все отступы (offsetTop).
        // Это гарантированно дает точную координату элемента внутри контейнера,
        // независимо от масштаба Tilda, вьюпорта мобилки или перерисовок окна.
        let elementTop = 0;
        let currentEl = el;
        
        while (currentEl && currentEl !== container && currentEl !== document.body && currentEl !== document.documentElement) {
            elementTop += currentEl.offsetTop;
            currentEl = currentEl.offsetParent;
        }

        // Позиция для скролла: верх элемента МИНУС высота шапки (чтобы встать прямо под ней)
        const targetScrollTop = elementTop - headerHeight - extraPadding;

        container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: "smooth"
        });
    }

    // === ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ПРИЛОЖЕНИЙ (ФОРМ) ===
    window.switchApp = function(targetApp) {
        const currentApp = document.getElementById('cvad-wrapper').style.display !== 'none' ? 'cvad' : 'cvaa';
        if (currentApp === targetApp) return;

        // Фиксируем, на что мы смотрим ДО скрытия формы
        const visibleSection = getVisibleSection(currentApp);

        // Переключение интерфейса
        const cvad = document.getElementById('cvad-wrapper');
        const cvaa = document.getElementById('cvaa-wrapper');
        const btnsCvad = document.querySelectorAll('.btn-switch-cvad');
        const btnsCvaa = document.querySelectorAll('.btn-switch-cvaa');

        if (targetApp === 'cvad') {
            cvad.style.display = 'block';
            cvaa.style.display = 'none';
            btnsCvad.forEach(b => b.classList.add('active'));
            btnsCvaa.forEach(b => b.classList.remove('active'));
        } else {
            cvad.style.display = 'none';
            cvaa.style.display = 'block';
            btnsCvad.forEach(b => b.classList.remove('active'));
            btnsCvaa.forEach(b => b.classList.add('active'));
        }

        if (visibleSection) {
            // В Tilda и на мобильных устройствах изменение display: block 
            // может вызывать тяжелый перерасчет верстки (reflow).
            // Ожидаем 300мс, а затем используем requestAnimationFrame для гарантии,
            // что браузер уже отрисовал новые размеры перед вычислением координат.
            setTimeout(() => {
                requestAnimationFrame(() => {
                    let targetEl = null;
                    let targetContainerId = '';

                    if (targetApp === 'cvaa') {
                        const mappedAttr = mapCvadToCvaa[visibleSection];
                        if (mappedAttr) {
                            targetEl = document.getElementById(`container-${window.globalActiveSample}-${mappedAttr}`);
                            targetContainerId = 'cvaa-scroll-container';
                        }
                    } else if (targetApp === 'cvad') {
                        const mappedSection = mapCvaaToCvad[visibleSection];
                        if (mappedSection) {
                            const activeForm = document.querySelector(`#cvad-wrapper .sample-form[data-id="${window.globalActiveSample}"]`);
                            if (activeForm) {
                                targetEl = activeForm.querySelector(`fieldset[data-section="${mappedSection}"]`);
                                targetContainerId = 'cvad-scroll-container';
                            }
                        }
                    }

                    if (targetEl && targetContainerId) {
                        scrollToTarget(targetEl, targetContainerId);
                    }
                });
            }, 300);
        }
    };

    // ==========================================
    // === ЛОГИКА ДЛЯ ФОРМЫ "ОПИСАНИЕ" (CVAD) ===
    // ==========================================
    (function() {
        
        
        document.addEventListener("DOMContentLoaded", () => {
          document.getElementById("cupping-date").valueAsDate = new Date();

          const wrapper = document.getElementById("cvad-forms-wrapper");
          const template = document.getElementById("cvad-sample-template").content;

          const scaDescriptors = {
            "Floral": ["Черный чай", "Ромашка", "Роза", "Жасмин"],
            "Fruity": ["Кокос", "Вишня", "Гранат", "Ананас"],
            "Berry": ["Ежевика", "Малина", "Черника", "Клубника"],
            "Dried Fruit": ["Изюм", "Чернослив"],
            "Citrus Fruit": ["Грейпфрут", "Апельсин", "Лимон", "Лайм"],
            "Sour/Fermented": ["Кислый", "Алкогольный", "Ферментированный"],
            "Sour": ["Кислая ароматика", "Лимонная кислота", "Яблочная кислота", "Уксусная кислота", "Масляная кислота", "Изовалериановая кислота"],
            "Fermented": ["Винный", "Виски", "Перебродивший", "Перезрелый"],
            "Green/Vegetative": ["Оливковое масло", "Сырой", "Зеленый/Растительный", "Бобы", "Стручковый", "Свежий", "Сено", "Травы"],
            "Roasted": ["Обжаренный"],
            "Cereal": ["Солод", "Зерно"],
            "Burnt": ["Едкий", "Дымный", "Пепельный", "Коричневая обжарка"],
            "Tobacco": ["Табак", "Трубочный табак"],
            "Nutty/Cocoa": ["Ореховый", "Какао"],
            "Nutty": ["Арахис", "Фундук", "Миндаль"],
            "Cocoa": ["Шоколад", "Темный шоколад"],
            "Spice": ["Острый", "Коричневые специи", "Черный перец", "Анис", "Мускатный орех", "Корица", "Гвоздика"],
            "Sweet": ["Сладкий аромат", "В целом сладкий"],
            "Vanilla/Vanillin": ["Ваниль", "Ванилин"],
            "Brown Sugar": ["Патока", "Кленовый сироп", "Карамельный", "Мёд"],
            "Other": ["Другие"],
            "Chemical": ["Резиновый", "Скунс", "Нефтяной", "Лекарственный", "Соленый", "Горький"],
            "Musty/Earthy": ["Землистый", "Плесень/Сырость", "Пыльный"],
            "Woody": ["Древесный", "Картон", "Бумажный"],
            "Rough": ["Шершавая", "Грубая", "Меловая"],
            "Oily": ["Маслянистая", "Жирная пленка"],
            "Smooth": ["Гладкая", "Округлая"],
            "Velvety": ["Бархатистая", "Мягкая"],
            "Silky": ["Шелковистая", "Нежная"],
            "Syrupy": ["Густая", "Тягучая", "Плотная", "Сиропистая"],
            "Mouth-Drying": ["Сушащая", "Стягивающая", "Покалывающая"],
            "Metallic": ["Жестяная банка", "Алюминиевая фольга", "Металлическая"]
          };

          const valueToRu = {
            "Floral": "Цветочный", "Fruity": "Фруктовый", "Berry": "Ягоды", "Dried Fruit": "Сухофрукты",
            "Citrus Fruit": "Цитрусовые фрукты", "Sour/Fermented": "Кислый/Ферментированный", "Sour": "Кислый",
            "Fermented": "Ферментированный", "Green/Vegetative": "Зелёный/Растительный", "Roasted": "Жареный",
            "Cereal": "Злаки", "Burnt": "Жжёный", "Tobacco": "Табак", "Nutty/Cocoa": "Ореховый/Какао",
            "Nutty": "Ореховый", "Cocoa": "Какао", "Spice": "Пряности", "Sweet": "Сладкий",
            "Vanilla/Vanillin": "Ваниль/Ванилин", "Brown Sugar": "Коричневый сахар", "Other": "Другие",
            "Chemical": "Химический", "Musty/Earthy": "Затхлый/Землистый", "Woody": "Древесный",
            "Rough": "Грубый", "Oily": "Маслянистый", "Smooth": "Гладкий", "Velvety": "Бархатистый",
            "Silky": "Шелковистый", "Syrupy": "Сиропистый", "Mouth-Drying": "Сушащий", "Metallic": "Металлический",
            "Шершавый": "Шершавый", "Меловой": "Меловой", "Песчаный": "Песчаный"
          };
          const tr = (v) => valueToRu[v] || v;

          function updateSuggestions(target) {
            const fieldset = target.closest("fieldset");
            if (!fieldset) return;

            const notesTextarea = fieldset.querySelector("textarea");
            if (!notesTextarea) return;

            let suggestBox = fieldset.querySelector(".suggestion-box");
            if (!suggestBox) {
              suggestBox = document.createElement("div");
              suggestBox.className = "suggestion-box";
              notesTextarea.parentNode.insertBefore(suggestBox, notesTextarea.nextSibling);
            }

            const checkedBoxes = Array.from(fieldset.querySelectorAll('input[type="checkbox"]:checked'));
            let found = [];
            checkedBoxes.forEach(cb => {
              if (scaDescriptors[cb.value]) found = found.concat(scaDescriptors[cb.value]);
            });
            found = [...new Set(found)];

            if (found.length) {
              const tagsHtml = found.map(d => `<span class="suggestion-tag">${d}</span>`).join("");
              suggestBox.innerHTML = `<strong>Рекомендуемые дескрипторы (нажмите, чтобы добавить):</strong><div style="margin-top:4px;">${tagsHtml}</div>`;
              suggestBox.classList.add("visible");
            } else {
              suggestBox.classList.remove("visible");
            }
          }

          for (let i = 1; i <= 8; i++) {
            const clone = document.importNode(template, true);
            const formDiv = clone.querySelector(".sample-form");
            formDiv.setAttribute("data-id", i);
            if (i === 1) formDiv.classList.add("active");
            wrapper.appendChild(clone);
          }

          const tabs = document.querySelectorAll("#cvad-wrapper .tab-btn");
          // Использование глобальной функции переключения вкладок
          tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                const tabId = parseInt(tab.getAttribute("data-tab"), 10);
                window.globalSwitchTab(tabId);
            });
          });

          wrapper.addEventListener("touchstart", (e) => {
              if (e.target.type === "range") {
                  const slider = e.target;
                  slider.dataset.isTouch = "true";
                  slider.dataset.unlocked = "false";
                  slider.dataset.origVal = slider.value;
                  slider.classList.add("waiting-unlock");
                  slider.unlockTimer = setTimeout(() => {
                      slider.dataset.unlocked = "true";
                      slider.classList.remove("waiting-unlock");
                      slider.classList.add("unlocked");
                      if (navigator.vibrate) navigator.vibrate(50);
                  }, 300);
              }
          }, { passive: true });

          wrapper.addEventListener("touchmove", (e) => {
              if (e.target.type === "range") {
                  const slider = e.target;
                  if (slider.dataset.unlocked !== "true") {
                      clearTimeout(slider.unlockTimer);
                      slider.classList.remove("waiting-unlock");
                  }
              }
          }, { passive: true });

          function endTouch(e) {
              if (e.target.type === "range") {
                  const slider = e.target;
                  clearTimeout(slider.unlockTimer);
                  slider.dataset.isTouch = "false";
                  slider.dataset.unlocked = "false";
                  slider.classList.remove("waiting-unlock", "unlocked");
              }
          }

          wrapper.addEventListener("touchend", endTouch);
          wrapper.addEventListener("touchcancel", endTouch);

          wrapper.addEventListener("input", (e) => {
            if (e.target.type === "range") {
              if (e.target.dataset.isTouch === "true" && e.target.dataset.unlocked !== "true") {
                  e.target.value = e.target.dataset.origVal;
                  return;
              }
              e.target.closest(".slider-row").querySelector(".slider-val").textContent = e.target.value;
            }
          });

          function calculateMouthfeelScore(block) {
            const checked = Array.from(block.querySelectorAll(".inp-mf-desc:checked"));
            if (checked.length === 0) return 0;
            const smoothParent = block.querySelector(".inp-mf-smooth-parent");
            const smoothChildren = Array.from(block.querySelectorAll(".inp-mf-smooth-child"));
            const smoothChildrenChecked = smoothChildren.filter(ch => ch.checked);
            const hasSmoothParent = smoothParent && smoothParent.checked;
            const k = smoothChildrenChecked.length;
            const others = checked.filter(ch =>
              !ch.classList.contains("inp-mf-smooth-parent") &&
              !ch.classList.contains("inp-mf-smooth-child")
            );
            let score = others.length;
            if (k === 0) { if (hasSmoothParent) score += 1; } 
            else if (k === 1) { score += 1; } 
            else { score += 2; }
            return score;
          }

          function calculateScore(block) {
            if (!block) return 0;
            const logic = block.getAttribute("data-logic");
            if (logic === "mouthfeel") return calculateMouthfeelScore(block);
            if (logic !== "complex") return block.querySelectorAll('input[type="checkbox"]:checked').length;
            let score = 0;
            const groups = block.querySelectorAll(".cb-group");
            groups.forEach(group => {
              const parent = group.querySelector(".cb-parent input");
              const children = group.querySelectorAll(".cb-child input:checked");
              if (parent && parent.checked) {
                score += (children.length > 0) ? children.length : 1;
              } else {
                score += children.length;
              }
            });
            return score;
          }

          const preState = new WeakMap();

          function snapshotCheckboxState(root) {
            return Array.from(root.querySelectorAll('input[type="checkbox"]')).map(cb => [cb, cb.checked]);
          }
          function restoreCheckboxState(snapshot) {
            snapshot.forEach(([cb, checked]) => { cb.checked = checked; });
          }

          function storePreState(e) {
            const t = e.target;
            if (!t || t.type !== "checkbox") return;
            const block = t.closest(".check-limit-block");
            if (!block) return;
            const logic = block.getAttribute("data-logic");
            if (logic === "complex") {
              preState.set(block, snapshotCheckboxState(block));
            } else {
              t.dataset.prevChecked = t.checked ? "1" : "0";
            }
          }
          wrapper.addEventListener("pointerdown", storePreState, true);
          wrapper.addEventListener("mousedown", storePreState, true);

          wrapper.addEventListener("click", (e) => {
            if (e.target.classList.contains("suggestion-tag")) {
              const tagText = e.target.textContent;
              const suggestBox = e.target.closest(".suggestion-box");
              if (suggestBox) {
                const textarea = suggestBox.previousElementSibling;
                if (textarea && textarea.tagName === "TEXTAREA") {
                  let cur = textarea.value.trim();
                  if (cur.length > 0) {
                    const lastChar = cur.slice(-1);
                    if (lastChar !== "," && lastChar !== ";") cur += ", ";
                    else cur += " ";
                  }
                  textarea.value = cur + tagText;
                }
              }
              return;
            }

            const t = e.target;
            if (!t || t.type !== "checkbox") return;
            const block = t.closest(".check-limit-block");
            if (!block) return;

            const logic = block.getAttribute("data-logic");
            const limit = parseInt(block.getAttribute("data-limit") || "999", 10);

            if (logic === "complex") {
              const snap = preState.get(block) || snapshotCheckboxState(block);
              const group = t.closest(".cb-group");
              if (group) {
                const isChild = !!t.closest(".cb-child");
                const parentInput = group.querySelector(".cb-parent input");
                const childInputs = Array.from(group.querySelectorAll(".cb-child input"));
                if (isChild && t.checked && parentInput && !parentInput.checked) {
                  parentInput.checked = true;
                }
                const isParentClick = !!t.closest(".cb-parent");
                if (isParentClick && parentInput && !parentInput.checked) {
                  childInputs.forEach(ch => { ch.checked = false; });
                }
              }
              const score = calculateScore(block);
              if (score > limit) {
                restoreCheckboxState(snap);
                preState.delete(block);
                updateSuggestions(t);
                alert(`Вы можете выбрать только (до) ${limit} дескрипторов(-а) в разделе "${block.getAttribute("data-name") || "этот раздел"}".`);
                return;
              }
              preState.delete(block);
              updateSuggestions(t);
              return;
            }

            const score = calculateScore(block);
            if (score > limit) {
              const prev = t.dataset.prevChecked === "1";
              t.checked = prev;
              updateSuggestions(t);
              alert(`Вы можете выбрать только (до) ${limit} дескрипторов(-а) в разделе "${block.getAttribute("data-name") || "этот раздел"}".`);
              return;
            }
            updateSuggestions(t);
          });

          wrapper.addEventListener("change", (e) => {
            if (e.target && e.target.type === "checkbox") updateSuggestions(e.target);
          });

          function getGroupedDescriptors(block) {
            const groups = {};
            const cols = block.querySelectorAll(".checkbox-col");
            cols.forEach(col => {
              col.querySelectorAll(".cb-group").forEach(g => {
                const parentLabel = g.querySelector(".cb-parent");
                if (!parentLabel) return;
                const parentInput = parentLabel.querySelector("input");
                const parentName = parentInput.value;
                const childrenInputs = g.querySelectorAll(".cb-child input:checked");
                if (parentInput.checked || childrenInputs.length > 0) {
                  if (!groups[parentName]) groups[parentName] = [];
                  childrenInputs.forEach(child => groups[parentName].push(child.value));
                }
              });
            });
            return groups;
          }

          function getMouthfeelDescriptors(fieldset) {
            const groups = {};
            const smoothParent = fieldset.querySelector(".inp-mf-smooth-parent");
            const smoothChildren = Array.from(fieldset.querySelectorAll(".inp-mf-smooth-child:checked")).map(c => c.value);
            if (smoothParent && (smoothParent.checked || smoothChildren.length > 0)) groups["Smooth"] = smoothChildren;
            const others = ["Rough", "Oily", "Mouth-Drying", "Metallic"];
            const checkedOthers = [];
            fieldset.querySelectorAll(".inp-mf-desc:checked").forEach(cb => {
              if (others.includes(cb.value)) checkedOthers.push(cb.value);
            });
            if (checkedOthers.length > 0) groups["_flat"] = checkedOthers;
            return groups;
          }

          function formatGroupedString(groupedData) {
            if (!groupedData || Object.keys(groupedData).length === 0) return "";
            let parts = [];
            for (const [key, arr] of Object.entries(groupedData)) {
              if (key === "_flat") {
                if (arr && arr.length) parts.push(arr.map(v => tr(v)).join("; "));
              } else {
                let p = tr(key);
                if (arr && arr.length) {
                  p += ": " + arr.map(v => tr(v)).join(", ");
                }
                parts.push(p);
              }
            }
            return parts.join("; ");
          }

          function drawSampleForm(data, sampleNo, date, name, purpose, groupedAroma, groupedFlavor, groupedMouthfeel) {
            const canvas = document.createElement("canvas");
            canvas.width = 1200; canvas.height = 4000; 
            const ctx = canvas.getContext("2d");

            ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#333"; ctx.textAlign = "center"; ctx.font = "bold 38px sans-serif";
            ctx.fillText("Форма описания кофе (CVA Descriptive Form)", canvas.width / 2, 60);
            ctx.textAlign = "left";

            const labelFont = "bold 24px sans-serif"; const valueFont = "24px sans-serif";
            const headerTopOffset = 50;

            ctx.font = labelFont; ctx.fillText("Имя:", 50, 110 + headerTopOffset);
            ctx.font = valueFont; ctx.fillText(name, 130, 110 + headerTopOffset);

            ctx.font = labelFont; ctx.fillText("Дата:", 50, 140 + headerTopOffset);
            ctx.font = valueFont; ctx.fillText(date, 130, 140 + headerTopOffset);

            ctx.font = labelFont; ctx.fillText("Цель:", 50, 170 + headerTopOffset);
            ctx.font = valueFont; const purposeEndY = drawTextInner(purpose, 130, 170 + headerTopOffset, 650, 32);

            ctx.font = labelFont; ctx.fillText("Образец:", 780, 110 + headerTopOffset);
            ctx.font = valueFont; const sampleEndY = drawTextInner(sampleNo, 920, 110 + headerTopOffset, 250, 32);

            let headerBottomY = Math.max(purposeEndY, sampleEndY, 200 + headerTopOffset);
            let currY = headerBottomY + 30;

            function drawSectionTitle(text, y) {
              ctx.fillStyle = "#6b3b1e"; ctx.fillRect(40, y, canvas.width - 80, 2);
              ctx.font = "bold 28px sans-serif"; ctx.textAlign = "left"; ctx.fillText(text, 40, y - 10);
            }
            function drawScale(label, value, x, y, width) {
              ctx.fillStyle = "#000"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "left"; ctx.fillText(label, x, y);
              const lineY = y + 30; ctx.strokeStyle = "#888"; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(x, lineY); ctx.lineTo(x + width, lineY); ctx.stroke();
              ctx.font = "16px sans-serif"; ctx.textAlign = "center";
              for (let i = 0; i <= 15; i += 5) {
                const tx = x + (i / 15) * width;
                ctx.beginPath(); ctx.moveTo(tx, lineY - 5); ctx.lineTo(tx, lineY + 5); ctx.stroke();
                ctx.fillText(i, tx, lineY + 20);
              }
              ctx.textAlign = "left";
              const val = parseFloat(value) || 0; const valX = x + (val / 15) * width;
              ctx.fillStyle = "#6b3b1e"; ctx.beginPath(); ctx.arc(valX, lineY, 8, 0, 2 * Math.PI); ctx.fill();
              ctx.textAlign = "center"; ctx.fillText(val, valX, lineY - 15); ctx.textAlign = "left";
            }
            function drawTextInner(text, x, y, maxWidth, lineHeight = 28) {
              if (!text) return y;
              if (text.includes("\n")) {
                const lines = text.split("\n"); let newY = y;
                lines.forEach(line => { newY = drawTextInner(line, x, newY, maxWidth, lineHeight); });
                return newY;
              }
              const words = text.split(/\s+/); let line = ""; let lineY = y;
              for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + " "; const testWidth = ctx.measureText(testLine).width;
                if (testWidth > maxWidth && n > 0) {
                  ctx.fillText(line, x, lineY); line = words[n] + " "; lineY += lineHeight;
                } else { line = testLine; }
              }
              ctx.fillText(line, x, lineY); return lineY + lineHeight;
            }
            function drawText(label, text, x, y, maxWidth) {
              ctx.fillStyle = "#444"; ctx.font = "italic 20px sans-serif"; ctx.textAlign = "left"; ctx.fillText(label, x, y);
              ctx.fillStyle = "#000"; ctx.font = "20px sans-serif"; return drawTextInner(text, x, y + 25, maxWidth);
            }
            function drawGroupedText(groupedData, x, y, maxWidth) {
              let currentY = y;
              if (!groupedData || Object.keys(groupedData).length === 0) {
                ctx.fillStyle = "#888"; ctx.font = "20px sans-serif"; ctx.fillText("(дескрипторы не выбраны)", x, currentY); return currentY + 30;
              }
              let tokens = []; const entries = Object.entries(groupedData);
              entries.forEach(([key, arr], index) => {
                const isLast = (index === entries.length - 1); const suffix = isLast ? "" : "; ";
                if (key === "_flat") {
                  if (arr && arr.length) tokens.push({ text: arr.map(v => tr(v)).join("; ") + suffix, isBold: false });
                } else {
                  let catText = tr(key);
                  if (arr && arr.length) {
                    tokens.push({ text: catText, isBold: true }); tokens.push({ text: ": " + arr.map(v => tr(v)).join(", ") + suffix, isBold: false });
                  } else {
                    tokens.push({ text: catText, isBold: true }); if (suffix) tokens.push({ text: suffix, isBold: false });
                  }
                }
              });
              const regularFont = "20px sans-serif"; const boldFont = "bold 20px sans-serif";
              let lineElements = []; let currentLineWidth = 0; let lines = [];
              for (let t of tokens) {
                ctx.font = t.isBold ? boldFont : regularFont; let words = t.text.split(' ');
                for (let i = 0; i < words.length; i++) {
                  let word = words[i]; let isLastWordInToken = (i === words.length - 1); let renderText = word + (isLastWordInToken ? "" : " ");
                  if (renderText === "") continue;
                  let wordWidth = ctx.measureText(renderText).width;
                  if (currentLineWidth + wordWidth > maxWidth && lineElements.length > 0) {
                    lines.push(lineElements); lineElements = []; currentLineWidth = 0;
                    renderText = renderText.trimStart(); if (renderText === "") continue;
                    wordWidth = ctx.measureText(renderText).width;
                  }
                  lineElements.push({ text: renderText, isBold: t.isBold }); currentLineWidth += wordWidth;
                }
              }
              if (lineElements.length > 0) lines.push(lineElements);
              const lineHeight = 28;
              for (let line of lines) {
                let currentX = x;
                for (let el of line) {
                  ctx.font = el.isBold ? boldFont : regularFont; ctx.fillStyle = el.isBold ? "#000" : "#444";
                  ctx.fillText(el.text, currentX, currentY); currentX += ctx.measureText(el.text).width;
                }
                currentY += lineHeight;
              }
              return currentY + 10;
            }

            drawSectionTitle("Степень обжарки", currY); currY += 40;
            drawScale("Интенсивность обжарки", data["Roast Level"], 50, currY, 400); currY += 140;

            drawSectionTitle("Запах и аромат", currY); currY += 40;
            drawScale("Запах", data["Fragrance"], 50, currY, 400); drawScale("Аромат", data["Aroma"], 600, currY, 400); currY += 80;
            ctx.fillStyle = "#444"; ctx.font = "italic 20px sans-serif"; ctx.fillText("Дескрипторы:", 50, currY); currY += 30;
            currY = drawGroupedText(groupedAroma, 70, currY, 1000);
            currY = drawText("Заметки:", data["Aroma Notes"], 50, currY + 10, 1100); currY += 70;

            drawSectionTitle("Букет и послевкусие", currY); currY += 40;
            drawScale("Букет", data["Flavor"], 50, currY, 400); drawScale("Послевкусие", data["Aftertaste"], 600, currY, 400); currY += 80;
            ctx.fillStyle = "#444"; ctx.font = "italic 20px sans-serif"; ctx.fillText("Дескрипторы:", 50, currY); currY += 30;
            currY = drawGroupedText(groupedFlavor, 70, currY, 1000);
            if (data["Main Tastes"]) {
              ctx.font = "bold 20px sans-serif"; ctx.fillStyle = "#000"; const lbl = "Базовые вкусы: "; ctx.fillText(lbl, 70, currY);
              const lblWidth = ctx.measureText(lbl).width; ctx.font = "20px sans-serif"; ctx.fillStyle = "#444";
              currY = drawTextInner(data["Main Tastes"], 70 + lblWidth, currY, 1000 - lblWidth);
            }
            currY = drawText("Заметки:", data["Flavor Notes"], 50, currY + 10, 1100); currY += 70;

            drawSectionTitle("Кислотность и сладость", currY); currY += 40;
            drawScale("Кислотность", data["Acidity"], 50, currY, 400); drawScale("Сладость", data["Sweetness"], 600, currY, 400); currY += 80;
            ctx.font = "italic 20px sans-serif"; ctx.fillStyle = "#444"; ctx.fillText("Заметки о кислотности:", 50, currY); ctx.fillText("Заметки о сладости:", 600, currY);
            ctx.font = "20px sans-serif"; ctx.fillStyle = "#000";
            const acY = drawTextInner(data["Acidity Notes"], 50, currY + 25, 500); const swY = drawTextInner(data["Sweetness Notes"], 600, currY + 25, 500);
            currY = Math.max(acY, swY) + 70;

            drawSectionTitle("Тактильность", currY); currY += 40;
            drawScale("Тактильность", data["Mouthfeel"], 50, currY, 400); currY += 80;
            ctx.fillStyle = "#444"; ctx.font = "italic 20px sans-serif"; ctx.fillText("Дескрипторы:", 50, currY); currY += 30;
            currY = drawGroupedText(groupedMouthfeel, 70, currY, 1000);
            currY = drawText("Заметки:", data["Mouthfeel Notes"], 50, currY + 10, 1100); currY += 50;

            ctx.fillStyle = "#aaa"; ctx.font = "14px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("Сформировано через CVA Digital Form", canvas.width / 2, currY); currY += 40;

            const finalCanvas = document.createElement("canvas"); finalCanvas.width = canvas.width; finalCanvas.height = currY;
            const finalCtx = finalCanvas.getContext("2d"); finalCtx.drawImage(canvas, 0, 0, canvas.width, currY, 0, 0, canvas.width, currY);
            return finalCanvas.toDataURL("image/jpeg", 0.9);
          }

          const LS_KEY = 'cvaa_descriptive_form_v1';
          function saveFormData() {
            const data = {
              global: { name: document.getElementById("taster-name").value, date: document.getElementById("cupping-date").value, purpose: document.getElementById("cupping-purpose").value },
              samples: {}
            };
            document.querySelectorAll("#cvad-wrapper .sample-form").forEach(form => {
              const id = form.getAttribute("data-id"); const sampleData = {};
              form.querySelectorAll("input[type='text'], input[type='range'], textarea").forEach(inp => { const key = inp.className; if(key) sampleData[key] = inp.value; });
              const allCb = Array.from(form.querySelectorAll("input[type='checkbox']"));
              sampleData.checkboxes = allCb.map(cb => cb.checked);
              data.samples[id] = sampleData;
            });
            localStorage.setItem(LS_KEY, JSON.stringify(data));
          }

          function loadFormData() {
            const raw = localStorage.getItem(LS_KEY); if (!raw) return;
            try {
              const data = JSON.parse(raw);
              if (data.global) {
                if (data.global.name) document.getElementById("taster-name").value = data.global.name;
                if (data.global.date) document.getElementById("cupping-date").value = data.global.date;
                if (data.global.purpose) document.getElementById("cupping-purpose").value = data.global.purpose;
              }
              if (data.samples) {
                document.querySelectorAll("#cvad-wrapper .sample-form").forEach(form => {
                  const id = form.getAttribute("data-id"); const sData = data.samples[id]; if (!sData) return;
                  form.querySelectorAll("input[type='text'], input[type='range'], textarea").forEach(inp => {
                    const key = inp.className;
                    if (sData[key] !== undefined) {
                      inp.value = sData[key];
                      if (inp.type === "range") { const display = inp.closest(".slider-row")?.querySelector(".slider-val"); if (display) display.textContent = inp.value; }
                    }
                  });
                  if (sData.checkboxes && Array.isArray(sData.checkboxes)) {
                    const allCb = Array.from(form.querySelectorAll("input[type='checkbox']"));
                    allCb.forEach((cb, idx) => { if (sData.checkboxes[idx] !== undefined) { cb.checked = sData.checkboxes[idx]; } });
                  }
                });
              }
            } catch (e) { console.error("Ошибка при загрузке сохраненных данных", e); }
          }

          wrapper.addEventListener("input", saveFormData);
          wrapper.addEventListener("change", saveFormData);
          document.querySelector("#cvad-wrapper .global-header").addEventListener("input", saveFormData);
          loadFormData();

          const saveBtn = document.getElementById("save-btn");
          
          // Заменяем Google Apps Script на Yandex Cloud Function (с параметром type=cvad)
          const SCRIPT_URL = "https://functions.yandexcloud.net/d4ekgff0csfc77v2nu5q?type=cvad";

          saveBtn.addEventListener("click", async () => {
            try {
              document.querySelectorAll("#cvad-wrapper .error-field").forEach(el => el.classList.remove("error-field"));
              document.querySelectorAll("#cvad-wrapper .error-block").forEach(el => el.classList.remove("error-block"));
              document.querySelectorAll("#cvad-wrapper .tab-btn").forEach(el => el.classList.remove("has-error"));

              const name = document.getElementById("taster-name").value.trim();
              const date = document.getElementById("cupping-date").value;
              const purpose = document.getElementById("cupping-purpose").value.trim();

              if (!name || !purpose) {
                if (!name) { alert("Введите имя"); const el = document.getElementById("taster-name"); el.classList.add("error-field"); el.scrollIntoView({ behavior: "smooth" }); } 
                else { alert("Введите цель"); const el = document.getElementById("cupping-purpose"); el.classList.add("error-field"); el.scrollIntoView({ behavior: "smooth" }); }
                return;
              }

              const formsToSave = []; let hasErrors = false; let firstErrorTab = null;

              document.querySelectorAll("#cvad-wrapper .sample-form").forEach(form => {
    const sampleNo = form.querySelector(".inp-sample-no").value.trim();
    
    // СНАЧАЛА создаем переменные
    const tabId = form.getAttribute("data-id"); 
    let formValid = true; 
    const errs = [];

    // ЗАТЕМ проверяем, трогал ли пользователь форму
    const isTouched = Array.from(form.querySelectorAll("textarea")).some(ta => ta.value.trim() !== '') || 
                      Array.from(form.querySelectorAll('input[type="checkbox"]')).some(cb => cb.checked);

    if (!sampleNo) {
        if (isTouched) {
            // Теперь скрипт знает, что такое formValid и errs
            formValid = false;
            form.querySelector(".inp-sample-no").classList.add("error-field");
            errs.push("Укажите 'Образец №'");
        } else {
            // Форма действительно девственно пуста -> безопасно пропускаем
            return; 
        }
    }
    const aromaBlock = form.querySelector('fieldset[data-section="aroma"]');
                const aromaScore = aromaBlock ? calculateScore(aromaBlock) : 0;
                if (aromaScore === 0) { formValid = false; if (aromaBlock) aromaBlock.classList.add("error-field"); errs.push("Запах/Аромат: выберите дескрипторы"); }

                const flavorFieldset = form.querySelector('fieldset[data-section="flavor"]');
                const flavorComplexBlock = flavorFieldset ? flavorFieldset.querySelector('.check-limit-block[data-logic="complex"]') : null;
                const flavorScore = flavorComplexBlock ? calculateScore(flavorComplexBlock) : 0;
                if (flavorScore === 0) { formValid = false; if (flavorComplexBlock) flavorComplexBlock.classList.add("error-field"); errs.push("Букет/Послевкусие: выберите дескрипторы"); }

                const mainBlock = flavorFieldset ? flavorFieldset.querySelector('.check-limit-block[data-logic="simple"][data-limit="2"]') : null;
                const mainChecked = mainBlock ? mainBlock.querySelectorAll("input.inp-main-taste:checked").length : 0;
                const mainGroup = mainBlock ? mainBlock.querySelector(".cb-group") : null;
                if (mainChecked !== 2) { formValid = false; if (mainGroup) mainGroup.classList.add("error-block"); errs.push("Базовые вкусы: выберите ровно 2"); }

                const acNotes = form.querySelector(".inp-acidity-notes");
                if (!acNotes.value.trim()) { formValid = false; acNotes.classList.add("error-field"); errs.push("Укажите характер кислотности"); }
                const swNotes = form.querySelector(".inp-sweetness-notes");
                if (!swNotes.value.trim()) { formValid = false; swNotes.classList.add("error-field"); errs.push("Укажите характер сладости"); }

                const mfBlock = form.querySelector('.check-limit-block[data-logic="mouthfeel"]');
                const mfScore = mfBlock ? calculateScore(mfBlock) : 0;
                if (mfScore < 1 || mfScore > 2) { formValid = false; if (mfBlock) mfBlock.classList.add("error-block"); errs.push("Тактильность: выберите до 2 дескрипторов"); }

                if (!formValid) {
                  hasErrors = true; const tab = document.querySelector(`#cvad-wrapper .tab-btn[data-tab="${tabId}"]`);
                  if (tab) tab.classList.add("has-error");
                  if (!firstErrorTab) { firstErrorTab = tabId; alert(`Образец ${tabId} — ошибки:\n- ${errs.join("\n- ")}`); }
                } else { formsToSave.push(form); }
              });

              if (hasErrors) {
                if (firstErrorTab) {
                  window.globalSwitchTab(firstErrorTab);
                  setTimeout(() => { const firstErr = document.querySelector("#cvad-wrapper .error-field, #cvad-wrapper .error-block"); if (firstErr) firstErr.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100);
                }
                return;
              }

              if (formsToSave.length === 0) { alert("Не заполнено ни одного образца."); return; }

              saveBtn.disabled = true; saveBtn.textContent = "Сохранение...";

              const sendForm = async (f) => {
                const dataMap = {}; const data = new URLSearchParams();
                data.append("Name", name); dataMap["Name"] = name;
                data.append("Date", date); dataMap["Date"] = date;
                data.append("Purpose", purpose); dataMap["Purpose"] = purpose;

                const sampleNo = f.querySelector(".inp-sample-no").value; data.append("Sample No", sampleNo); dataMap["Sample No"] = sampleNo;
                const roast = f.querySelector(".inp-roast").value; data.append("Roast Level", roast); dataMap["Roast Level"] = roast;
                const fragrance = f.querySelector(".inp-fragrance").value; data.append("Fragrance", fragrance); dataMap["Fragrance"] = fragrance;
                const aroma = f.querySelector(".inp-aroma").value; data.append("Aroma", aroma); dataMap["Aroma"] = aroma;

                const aromaBlock = f.querySelector('fieldset[data-section="aroma"]');
                const groupedAroma = aromaBlock ? getGroupedDescriptors(aromaBlock) : {};
                const aromaDescRu = formatGroupedString(groupedAroma); data.append("Aroma Descriptors", aromaDescRu); dataMap["Aroma Descriptors"] = aromaDescRu;

                const aromaNotes = f.querySelector(".inp-aroma-notes").value; data.append("Aroma Notes", aromaNotes); dataMap["Aroma Notes"] = aromaNotes;
                const flavor = f.querySelector(".inp-flavor").value; data.append("Flavor", flavor); dataMap["Flavor"] = flavor;
                const aftertaste = f.querySelector(".inp-aftertaste").value; data.append("Aftertaste", aftertaste); dataMap["Aftertaste"] = aftertaste;

                const flavorFieldset = f.querySelector('fieldset[data-section="flavor"]');
                const flavBlock = flavorFieldset ? flavorFieldset.querySelector('.check-limit-block[data-logic="complex"]') : null;
                const groupedFlavor = flavBlock ? getGroupedDescriptors(flavBlock) : {};
                const flavDescRu = formatGroupedString(groupedFlavor); data.append("Flavor Descriptors", flavDescRu); dataMap["Flavor Descriptors"] = flavDescRu;

                const mainBlock = flavorFieldset ? flavorFieldset.querySelector('.check-limit-block[data-logic="simple"][data-limit="2"]') : null;
                const mainTastes = mainBlock ? Array.from(mainBlock.querySelectorAll("input.inp-main-taste:checked")).map(c => c.value).join(", ") : "";
                data.append("Main Tastes", mainTastes); dataMap["Main Tastes"] = mainTastes;

                const flavorNotes = f.querySelector(".inp-flavor-notes").value; data.append("Flavor Notes", flavorNotes); dataMap["Flavor Notes"] = flavorNotes;
                const acidity = f.querySelector(".inp-acidity").value; data.append("Acidity", acidity); dataMap["Acidity"] = acidity;
                const acNotes = f.querySelector(".inp-acidity-notes").value; data.append("Acidity Notes", acNotes); dataMap["Acidity Notes"] = acNotes;
                const sweetness = f.querySelector(".inp-sweetness").value; data.append("Sweetness", sweetness); dataMap["Sweetness"] = sweetness;
                const swNotes = f.querySelector(".inp-sweetness-notes").value; data.append("Sweetness Notes", swNotes); dataMap["Sweetness Notes"] = swNotes;
                const mouthfeel = f.querySelector(".inp-mouthfeel").value; data.append("Mouthfeel", mouthfeel); dataMap["Mouthfeel"] = mouthfeel;

                const mfFieldset = f.querySelector('.check-limit-block[data-logic="mouthfeel"]');
                const groupedMouthfeel = mfFieldset ? getMouthfeelDescriptors(mfFieldset) : {};
                const mfDescRu = formatGroupedString(groupedMouthfeel); data.append("Mouthfeel Descriptors", mfDescRu); dataMap["Mouthfeel Descriptors"] = mfDescRu;

                const mfNotes = f.querySelector(".inp-mouthfeel-notes").value; data.append("Mouthfeel Notes", mfNotes); dataMap["Mouthfeel Notes"] = mfNotes;

                const includeCatalog = f.querySelector(".inp-include-catalog").checked ? "1" : "";
                data.append("In Cataloque", includeCatalog); dataMap["In Cataloque"] = includeCatalog;

                const imageUrl = drawSampleForm(dataMap, sampleNo, date, name, purpose, groupedAroma, groupedFlavor, groupedMouthfeel);
                const link = document.createElement("a"); link.href = imageUrl; link.download = `${sampleNo.replace(/\n/g, "_")}_CVA.jpg`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);

                // Явно указываем заголовки и преобразуем данные в строку для надежной передачи
                // Делаем 3 попытки с интервалом в 2 секунды
const response = await fetchWithRetry(SCRIPT_URL, { 
    method: "POST", 
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data.toString() 
}, 3, 2000);
                
                if (!response.ok) {
                    let errText = await response.text();
                    try {
                        const errJson = JSON.parse(errText);
                        errText = errJson.error || errJson.message || errText;
                    } catch(e) {}
                    throw new Error(`Ошибка сервера: ${response.status}. Подробности: ${errText}`);
                }
              };

              let completed = 0;
              for (const f of formsToSave) { 
                  await sendForm(f); 
                  completed++; 
                  saveBtn.textContent = `Сохранение (${completed}/${formsToSave.length})...`; 
              }
              localStorage.removeItem(LS_KEY);
              alert("Данные сохранены. Форма будет очищена."); location.reload(); 
              
            } catch (err) {
              console.error(err); 
              alert("Произошла ошибка при сохранении:\n" + err.message + "\nОткройте консоль (F12) и пришлите текст ошибки, если нужно.");
              saveBtn.disabled = false; saveBtn.textContent = "Сохранить результат";
            }
          });
        });
    })();

    // ========================================
    // === ЛОГИКА ДЛЯ ФОРМЫ "ОЦЕНКА" (CVAA) ===
    // ========================================
    (function() {
        // Заменяем Google Apps Script на Yandex Cloud Function (с параметром type=cvaa)
        const GOOGLE_SCRIPT_URL = "https://functions.yandexcloud.net/d4ekgff0csfc77v2nu5q?type=cvaa";
        
        const attributes = [
          { id: "fragrance",  name: "1. Запах" }, { id: "aroma",      name: "2. Аромат" },
          { id: "bouquet",    name: "3. Букет" }, { id: "aftertaste", name: "4. Послевкусие" },
          { id: "acidity",    name: "5. Кислотность" }, { id: "sweetness",  name: "6. Сладость" },
          { id: "tactility",  name: "7. Тактильность" }, { id: "overall",    name: "8. Общее впечатление" }
        ];
        const scorePhrases = {
            1: "впечатление о качестве атрибута применительно к цели крайне низкое", 2: "впечатление о качестве атрибута применительно к цели очень низкое",
            3: "впечатление о качестве атрибута применительно к цели умеренно низкое", 4: "впечатление о качестве атрибута применительно к цели немного низкое",
            5: "впечатление о качестве атрибута применительно к цели ни низкое, ни высокое", 6: "впечатление о качестве атрибута применительно к цели немного выше среднего",
            7: "впечатление о качестве атрибута применительно к цели умеренно высокое", 8: "впечатление о качестве атрибута применительно к цели очень высокое",
            9: "впечатление о качестве атрибута применительно к цели чрезвычайно высокое"
        };

        let currentAttrId = null; let currentSampleId = null; 
        
        function calculateScore(sampleId) {
            let sum = 0; let hasScores = false;
            attributes.forEach(attr => {
                const radios = document.getElementsByName(`${sampleId}-${attr.id}`);
                for (let i = 0; i < radios.length; i++) { if (radios[i].checked) { sum += parseInt(radios[i].value); hasScores = true; break; } }
            });
            if (!hasScores) return "--";
            const S = 0.65625 * sum + 52.75; return S.toFixed(2);
        }

        window.updateGlobalScoreDisplay = function() {
            const score = calculateScore(window.globalActiveSample); 
            const display = document.getElementById('globalScoreDisplay');
            if (score === "--") { display.textContent = "--"; } else { display.textContent = score; }
        };

        function initForms() {
            const wrapper = document.getElementById('cvaa-formsWrapper');
            for (let s = 1; s <= 8; s++) {
                const sampleDiv = document.createElement('div');
                sampleDiv.className = `sample-content ${s === 1 ? 'active' : ''}`; sampleDiv.classList.add('fade-in'); sampleDiv.id = `sample-${s}`;
                const infoHtml = `
                  <div class="info-grid">
                    <div class="info-field"><label>ФИО</label><input type="text" id="inputFio-${s}" placeholder="Иванов И.И."></div>
                    <div class="info-field"><label>E-mail</label><input type="email" id="inputEmail-${s}" placeholder="example@google.com"></div>
                    <div class="info-field"><label>Название / Номер лота</label><input type="text" id="inputLot-${s}" placeholder="Образец или номер ${s}..."></div>
                    <div class="info-field"><label>Цель оценки</label><input type="text" id="inputGoal-${s}" placeholder="Цель оценки..."></div>
                  </div>
                `;
                sampleDiv.innerHTML = infoHtml;

                attributes.forEach(attr => {
                    const container = document.createElement("div"); container.className = "attribute-container"; container.id = `container-${s}-${attr.id}`;
                    const title = document.createElement("div"); title.className = "attribute-title"; title.textContent = attr.name; container.appendChild(title);
                    const scaleContainer = document.createElement("div"); scaleContainer.className = "scale-container";

                    for (let i = 1; i <= 9; i++) {
                        const label = document.createElement("label"); label.className = "scale-label";
                        const radio = document.createElement("input"); radio.type = "radio"; radio.name = `${s}-${attr.id}`; radio.value = i;
                        radio.addEventListener("click", () => {
                            document.getElementById(`container-${s}-${attr.id}`).classList.remove('error');
                            cvaaOpenModal(s, attr.id, attr.name, i); updateGlobalScoreDisplay();
                        });
                        const span = document.createElement("span"); span.textContent = i;
                        label.appendChild(radio); label.appendChild(span); scaleContainer.appendChild(label);
                    }
                    container.appendChild(scaleContainer);

                    const resultOutput = document.createElement("div"); resultOutput.id = `output-${s}-${attr.id}`; resultOutput.className = "result-output"; container.appendChild(resultOutput);
                    const hiddenInput = document.createElement("input"); hiddenInput.type = "hidden"; hiddenInput.id = `text-${s}-${attr.id}`; container.appendChild(hiddenInput);
                    sampleDiv.appendChild(container);
                });

                const reportDiv = document.createElement('div'); reportDiv.id = `analyticalReport-${s}`; reportDiv.className = 'report-container';
                reportDiv.innerHTML = `<div class="report-title">Отчет по образцу <span id="reportTitle-${s}">${s}</span></div><div id="reportContent-${s}"></div>`;
                sampleDiv.appendChild(reportDiv); wrapper.appendChild(sampleDiv);
            }
            setupSync(); updateGlobalScoreDisplay();
        }

        function setupSync() {
            ['inputFio', 'inputEmail', 'inputGoal'].forEach(baseId => {
                const el1 = document.getElementById(`${baseId}-1`);
                el1.addEventListener('blur', () => { const val = el1.value; for(let s=2; s<=8; s++) { const target = document.getElementById(`${baseId}-${s}`); if(!target.value) target.value = val; } });
                for(let s=1; s<=8; s++) { document.getElementById(`${baseId}-${s}`).addEventListener('input', function() { this.classList.remove('error'); }); }
            });
            for(let s=1; s<=8; s++) { document.getElementById(`inputLot-${s}`).addEventListener('input', function() { this.classList.remove('error'); }); }
        }

        function cvaaOpenModal(sampleId, attrId, attrName, score) {
          const modalTitle = document.getElementById("modalTitle"); const modalInput = document.getElementById("modalInput"); const modal = document.getElementById("noteModal");
          currentSampleId = sampleId; currentAttrId = attrId; modalTitle.textContent = `${attrName} (Оценка: ${score})`;
          modalInput.value = document.getElementById(`text-${sampleId}-${attrId}`).value || "";
          modal.style.display = "block"; setTimeout(() => modalInput.focus(), 100);
        }
        
        window.cvaaCloseModal = function() { document.getElementById("noteModal").style.display = "none"; }
        
        window.cvaaSaveNote = function() {
          if (!currentAttrId || !currentSampleId) return;
          const text = document.getElementById("modalInput").value.trim();
          document.getElementById(`text-${currentSampleId}-${currentAttrId}`).value = text;
          const outputDiv = document.getElementById(`output-${currentSampleId}-${currentAttrId}`);
          const attrObj = attributes.find(a => a.id === currentAttrId);
          const cleanName = attrObj.name.replace(/^\d+\.\s*/, "");
          if (text) { outputDiv.textContent = `${cleanName}: ${text}`; outputDiv.style.display = "block"; } else { outputDiv.style.display = "none"; }
          window.cvaaCloseModal();
        }
        
        window.addEventListener('click', function(e) { if(e.target == document.getElementById("noteModal")) window.cvaaCloseModal(); });

        function collectDataForSample(s) {
            const lotInput = document.getElementById(`inputLot-${s}`); const lot = lotInput.value.trim();
            const emailInput = document.getElementById(`inputEmail-${s}`); const email = emailInput.value.trim();
            let hasScores = false; let missingNames = [];

            attributes.forEach(attr => {
                const radios = document.getElementsByName(`${s}-${attr.id}`); let isChecked = false;
                for(let i = 0; i < radios.length; i++) { if(radios[i].checked) isChecked = true; }
                if(isChecked) hasScores = true; else missingNames.push(attr.name);
            });

            if (!lot && !hasScores) return { status: "empty" };
            let errors = []; let errorMsg = "";

            if (!lot) { errors.push({ type: 'lot' }); errorMsg += "• Не указано название лота\n"; }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) { errors.push({ type: 'email' }); errorMsg += "• Некорректный E-mail\n"; }
            if (missingNames.length > 0) {
                missingNames.forEach(name => { const attr = attributes.find(a => a.name === name); errors.push({ type: 'attr', id: attr.id }); });
                errorMsg += `• Пропущены атрибуты: ${missingNames.length} шт. (см. красную подсветку)\n`;
            }

            if (errors.length > 0) return { status: "error", errors: errors, msg: errorMsg };

            let data = { fio: document.getElementById(`inputFio-${s}`).value.trim(), email: email, lot: lot, goal: document.getElementById(`inputGoal-${s}`).value.trim() };
            attributes.forEach(attr => {
                const text = document.getElementById(`text-${s}-${attr.id}`).value; let score = '';
                const radios = document.getElementsByName(`${s}-${attr.id}`);
                for (let i = 0; i < radios.length; i++) { if (radios[i].checked) { score = radios[i].value; break; } }
                data[attr.id + '_score'] = score; data[attr.id + '_text'] = text;
            });

            return { status: "valid", data: data };
        }

        function generateReportHTML(data) {
            let html = ''; html += `<div class="report-paragraph">Образец <strong>${data.lot}</strong> оценивался специалистом с целью <strong>"${data.goal}"</strong>.</div>`;
            let lowAttributes = []; let midAttributes = []; let highAttributes = []; let topAttributes = []; 

            attributes.forEach(attr => {
                const sc = parseInt(data[attr.id + '_score']); if(!sc) return;
                const phrase = scorePhrases[sc]; const cleanName = attr.name.replace(/^\d+\.\s*/, ""); const comm = data[attr.id + '_text'];
                if(sc >= 1 && sc <= 3) lowAttributes.push(cleanName); else if(sc >= 4 && sc <= 6) midAttributes.push(cleanName); else if(sc >= 7 && sc <= 9) highAttributes.push(cleanName);
                if(sc >= 8 && sc <= 9) topAttributes.push(cleanName);
                html += `<div class="report-paragraph">Атрибут <strong>${cleanName}</strong> имеет оценку <strong>${sc}</strong>, что означает, ${phrase}. `;
                html += comm ? `Впечатления от качества атрибута: <em>${comm}</em>.` : `Впечатления от качества атрибута не описаны.`; html += `</div>`;
            });
            
            if (topAttributes.length > 0) { html += `<div class="report-paragraph">Отличительными атрибутами, которые выделяют кофе для заявленной цели можно считать <strong>${topAttributes.join(", ")}</strong>, которые имеют довольно высокие оценки.</div>`; }
            
            const cntLow = lowAttributes.length; const cntMid = midAttributes.length; const cntHigh = highAttributes.length; let conclusion = "";

            if (cntLow > cntMid && cntLow > cntHigh) {
                conclusion = `По совокупности оценок атрибутов образец кофе скорее не подходит для заявленной цели "${data.goal}". `;
                if (lowAttributes.length > 0) conclusion += `Просим обратить внимание на такие атрибуты как <strong>${lowAttributes.join(", ")}</strong>, которые помешали получить высокое впечатление о качестве кофе`;
                if (midAttributes.length > 0) { if (lowAttributes.length > 0) conclusion += ` и на атрибуты `; conclusion += `<strong>${midAttributes.join(", ")}</strong>, впечатление о качестве которых могло бы быть выше.`; }
            } else if (cntMid > cntLow && cntMid > cntHigh) {
                conclusion = `По совокупности оценок атрибутов образец кофе может вызвать определенные проблемы и условно подходит заявленной цели "${data.goal}". `;
                if (lowAttributes.length > 0) conclusion += `Просим обратить внимание на такие атрибуты как <strong>${lowAttributes.join(", ")}</strong>, которые помешали получить высокое впечатление о качестве кофе`;
                if (midAttributes.length > 0) { if (lowAttributes.length > 0) conclusion += ` и на атрибуты `; conclusion += `<strong>${midAttributes.join(", ")}</strong>, впечатление о качестве которых могло бы быть выше.`; }
            } else if (cntHigh > cntMid && cntLow === 0) {
                if (cntHigh === 8) { conclusion = `По совокупности оценок атрибутов образец кофе в целом отлично подходит для цели "${data.goal}".`; } else {
                    conclusion = `По совокупности оценок атрибутов образец кофе в целом хорошо подойдет для цели "${data.goal}". `;
                    if (midAttributes.length > 0) { conclusion += `Просим обратить внимание на такие атрибуты как <strong>${midAttributes.join(", ")}</strong>, которые помешали получить более высокое впечатление о качестве кофе и впечатление о качестве которых могло бы быть выше.`; }
                }
            } else if (cntHigh > cntMid && cntLow > 0) {
                conclusion = `По совокупности оценок атрибутов образец кофе в целом мог бы подойти для цели "${data.goal}". `;
                conclusion += `Просим обратить внимание на такие атрибуты как <strong>${lowAttributes.join(", ")}</strong>, которые помешали получить высокое впечатление о качестве кофе`;
                if (midAttributes.length > 0) { conclusion += ` и на атрибуты <strong>${midAttributes.join(", ")}</strong>, впечатление о качестве которых могло бы быть выше.`; }
            } else {
                 if (cntHigh === 8) { conclusion = `По совокупности оценок атрибутов образец кофе в целом отлично подходит для цели "${data.goal}".`; } 
                 else { conclusion = `По совокупности оценок атрибутов образец кофе показывает смешанные результаты для цели "${data.goal}". Рекомендуется провести детальный анализ описанных выше атрибутов.`; }
            }

            html += `<div class="report-paragraph" style="margin-top:20px; border-top:1px solid #ccc; padding-top:15px;"><strong>ВЫВОД:</strong> ${conclusion}</div>`;
            return html;
        }

        window.cvaaSendToGoogle = async function() {
            const btn = document.getElementById('btnSend');
            if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("ВСТАВЬТЕ")) { alert("Ошибка: URL скрипта не настроен!"); return; }

            let validPayloads = []; let allErrorsText = ""; let firstErrorTab = null;
            document.querySelectorAll('#cvaa-wrapper .error').forEach(el => el.classList.remove('error'));
            document.querySelectorAll('#cvaa-wrapper .tab-btn').forEach(el => el.classList.remove('has-error'));

            for(let s=1; s<=8; s++) {
                const check = collectDataForSample(s);
                if (check.status === "error") {
                    if (!firstErrorTab) firstErrorTab = s;
                    document.getElementById(`tab-${s}`).classList.add('has-error');
                    allErrorsText += `\n[ОБРАЗЕЦ ${s}]\n${check.msg}`;
                    check.errors.forEach(err => {
                        if (err.type === 'lot') document.getElementById(`inputLot-${s}`).classList.add('error');
                        if (err.type === 'email') document.getElementById(`inputEmail-${s}`).classList.add('error');
                        if (err.type === 'attr') document.getElementById(`container-${s}-${err.id}`).classList.add('error');
                    });
                } 
                else if (check.status === "valid") {
                    const data = check.data; const reportHTML = generateReportHTML(data);
                    document.getElementById(`reportContent-${s}`).innerHTML = reportHTML;
                    document.getElementById(`analyticalReport-${s}`).style.display = 'block';
                    document.getElementById(`reportTitle-${s}`).textContent = data.lot; 
                    const tempDiv = document.createElement("div"); tempDiv.innerHTML = reportHTML; data.analytical_report = tempDiv.innerText;
                    validPayloads.push(data);
                }
            }

            if (allErrorsText) {
                alert(`ОБНАРУЖЕНЫ ОШИБКИ:${allErrorsText}\nПожалуйста, исправьте ошибки в подсвеченных вкладках.`);
                if(firstErrorTab) window.globalSwitchTab(firstErrorTab);
                return;
            }

            if (validPayloads.length === 0) { alert("Нет заполненных данных. Введите название лота и оценки хотя бы для одного образца."); return; }

            btn.textContent = `Сохранение (${validPayloads.length})...`; btn.classList.add('loading');

            try {
                for (let i = 0; i < validPayloads.length; i++) {
                    const data = validPayloads[i];
                    
                    // Убираем mode: "no-cors", чтобы корректно получать ответ об успехе или ошибке
                    const response = await fetchWithRetry(GOOGLE_SCRIPT_URL, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(data) 
}, 3, 2000);
                    
                    if (!response.ok) {
                        let errText = await response.text();
                        try {
                            const errJson = JSON.parse(errText);
                            errText = errJson.error || errJson.message || errText;
                        } catch(e) {}
                        throw new Error(`Ошибка сервера: ${response.status}. Подробности: ${errText}`);
                    }
                    
                    await new Promise(r => setTimeout(r, 800));
                }
                alert(`Успешно сохранено образцов: ${validPayloads.length}`);
            } catch (e) {
                console.error(e); alert("Ошибка:\n" + e.message);
            } finally {
                btn.textContent = "Сохранить результат"; btn.classList.remove('loading');
            }
        }

        initForms();
    })();