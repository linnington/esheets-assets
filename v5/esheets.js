/* CANONICAL v5 — Full Framework (Scoped: .esheets-worksheet) — 2026-02-15 */

/**
 * ESHEETS v5 Framework Core
 *
 * Scoped, safe, and feature-rich.
 *
 * Usage:
 *   ESHEETS.init({ worksheet_id: 'unique_id', meta: {} });
 *   ESHEETS.setScore(score, maxScore); 
 *   ESHEETS.lockCorrectAnswer(input, button);
 *   ESHEETS.mountSubmissionBar({ ... });
 *   ESHEETS.mountIdentityBar({ ... });
 *   ESHEETS.setTrackingAdapter(fn);
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'esheets:v5:progress';
    var LEGACY_KEY = 'esheets:v1:progress';
    var IDENTITY_KEY = 'esheets:v5:identity';

    var meta = {};          // Framework config (worksheet_id, etc)
    var worksheetMeta = {}; // Optional extra metadata
    var isMounted = false;
    var trackingAdapter = null;

    // --- Internal Helpers ---

    function getStorage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);

            // Migration: Try reading legacy key if v5 is empty
            var legacy = localStorage.getItem(LEGACY_KEY);
            if (legacy) {
                try {
                    return JSON.parse(legacy);
                } catch (e) {
                    return {};
                }
            }
            return {};
        } catch (e) {
            console.warn('ESHEETS: storage read error', e);
            return {};
        }
    }

    function setStorage(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('ESHEETS: storage write error', e);
        }
    }

    function getIdentityStorage() {
        try {
            var raw = localStorage.getItem(IDENTITY_KEY);
            var data = raw ? JSON.parse(raw) : {};

            // Ensure structure
            var identity = {
                first_name: data.first_name || "",
                last_name: data.last_name || "",
                class_code: data.class_code || ""
            };

            // Migration: if legacy student_name exists
            // We just format it in-memory. It will be saved explicitly later if changed.
            if (data.student_name) {
                var parts = data.student_name.trim().split(/\s+/);
                if (parts.length > 0) {
                    if (!identity.first_name) identity.first_name = parts[0];
                    if (!identity.last_name) identity.last_name = parts.slice(1).join(' ');
                }
            }

            return identity;
        } catch (e) {
            return { first_name: "", last_name: "", class_code: "" };
        }
    }

    function setIdentityStorage(data) {
        try {
            localStorage.setItem(IDENTITY_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('ESHEETS: identity write error', e);
        }
    }

    function getRecord(id) {
        if (!id) return null;
        var data = getStorage();
        return data[id] || null;
    }

    function saveRecord(id, updates) {
        if (!id) return;
        var data = getStorage();
        var record = data[id] || {
            bestScore: 0,
            maxScore: 0,
            bestPercent: 0,
            lastScore: 0,
            lastPercent: 0,
            submittedAt: null
        };

        for (var key in updates) {
            if (Object.prototype.hasOwnProperty.call(updates, key)) {
                record[key] = updates[key];
            }
        }

        data[id] = record;
        setStorage(data);
        return record;
    }

    // Helper to ensure an element is inside our scope
    function isInScope(el) {
        return el && el.closest('.esheets-worksheet');
    }

    function updatePlaceholders(text) {
        var roots = document.querySelectorAll('.esheets-worksheet');
        if (roots.length === 0) return;

        var selectors = [
            '[data-esheets-score="top"]',
            '[data-esheets-score="bottom"]'
        ];

        for (var r = 0; r < roots.length; r++) {
            var root = roots[r];
            selectors.forEach(function (sel) {
                var els = root.querySelectorAll(sel);
                for (var i = 0; i < els.length; i++) {
                    // Elements found inside root are guaranteed to be in scope
                    if (els[i].textContent !== text) {
                        els[i].textContent = text;
                    }
                    if (!els[i].classList.contains('esheets-scorebar')) {
                        els[i].classList.add('esheets-scorebar');
                    }
                }
            });
        }
    }

    function formatScore(s, m, p) {
        return s + ' / ' + m + ' (' + Math.round(p) + '%)';
    }

    // --- Class Code Validation Helpers ---

    // Spec: 4 chars, hyphen, 4 chars. Allowed: A-H, J-N, P-Z, 2-9
    var CLASS_CODE_REGEX = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

    function normalizeClassCode(str) {
        if (typeof str !== 'string') return "";
        // trim, uppercase, remove ALL whitespace
        return str.trim().toUpperCase().replace(/\s+/g, '');
    }

    function isValidClassCode(str) {
        return CLASS_CODE_REGEX.test(str);
    }

    // --- Public API ---

    window.ESHEETS = window.ESHEETS || {};

    Object.assign(window.ESHEETS, {

        init: function (options) {
            if (!document.querySelector('.esheets-worksheet')) {
                // Silent return to avoid noise on non-worksheet pages, 
                // but strict inertness requirement says "must do nothing".
                // If init is called, user code is running. We respect that but prevent side effects.
                return;
            }

            meta = options || {};
            if (meta.meta) {
                worksheetMeta = meta.meta; // Store optional metadata
            }
            if (!meta.worksheet_id) {
                console.warn('ESHEETS: init called without worksheet_id');
            }
            isMounted = true;
        },

        setTrackingAdapter: function (fn) {
            if (typeof fn === 'function') {
                trackingAdapter = fn;
            }
        },

        getIdentity: function () {
            return getIdentityStorage();
        },

        setIdentity: function (updates) {
            var current = getIdentityStorage();
            var changed = false;

            for (var k in updates) {
                if (Object.prototype.hasOwnProperty.call(updates, k)) {
                    var val = updates[k];

                    // Class Code Normalization & Validation Logic
                    if (k === 'class_code') {
                        var norm = normalizeClassCode(val);
                        if (isValidClassCode(norm)) {
                            val = norm;
                        } else {
                            val = ""; // Store empty if invalid
                        }
                    }

                    if (current[k] !== val) {
                        current[k] = val;
                        changed = true;
                    }
                }
            }

            if (changed) {
                setIdentityStorage(current);
            }
            return current;
        },

        setScore: function (score, maxScore) {
            if (!isMounted) return;
            if (typeof score !== 'number' || typeof maxScore !== 'number' || isNaN(score) || isNaN(maxScore)) return;

            var s = Math.max(0, score);
            var m = Math.max(1, maxScore);
            var pct = (m > 0) ? (s / m) * 100 : 0;

            var text = 'Score: ' + s + ' / ' + m + ' (' + Math.round(pct) + '%)';
            updatePlaceholders(text);
        },

        submit: function (score, maxScore) {
            if (!isMounted || !meta.worksheet_id) return;
            if (typeof score !== 'number' || typeof maxScore !== 'number') return;

            var s = Math.max(0, score);
            var m = Math.max(1, maxScore);
            var pct = (m > 0) ? (s / m) * 100 : 0;
            var now = new Date().toISOString();

            var record = getRecord(meta.worksheet_id) || { bestPercent: 0, bestScore: 0 };

            var updates = {
                lastScore: s,
                lastPercent: pct,
                submittedAt: now,
                maxScore: m
            };

            var currentBestPercent = record.bestPercent || 0;
            var currentBestScore = record.bestScore || 0;

            if (pct > currentBestPercent || (Math.abs(pct - currentBestPercent) < 0.001 && s > currentBestScore)) {
                updates.bestPercent = pct;
                updates.bestScore = s;
            }

            saveRecord(meta.worksheet_id, updates);

            // Trigger Tracking Adapter if present
            if (typeof trackingAdapter === 'function') {
                var payload = {
                    worksheet_id: meta.worksheet_id,
                    score: s,
                    maxScore: m,
                    percent: pct,
                    submittedAt: now,
                    meta: worksheetMeta,
                    // Identity now returns { first_name, last_name, class_code } automatically
                    identity: getIdentityStorage()
                };
                try {
                    trackingAdapter(payload);
                } catch (e) {
                    console.warn('ESHEETS: tracking adapter error', e);
                }
            }
        },

        renderSubmissionSummary: function (container) {
            if (!container || !meta.worksheet_id) return;

            // Ensure container is cleared and styled
            container.innerHTML = '';
            container.classList.add('esheets-summary');

            var record = getRecord(meta.worksheet_id);

            if (!record || !record.submittedAt) {
                var p = document.createElement('div');
                p.textContent = "No previous submissions.";
                container.appendChild(p);
                return;
            }

            var lastText = "Last recorded: " + formatScore(record.lastScore, record.maxScore, record.lastPercent);
            var bestText = "Best score: " + formatScore(record.bestScore, record.maxScore, record.bestPercent);

            var pLast = document.createElement('div');
            pLast.textContent = lastText;

            var pBest = document.createElement('div');
            pBest.textContent = bestText;
            pBest.style.fontWeight = 'bold';

            container.appendChild(pLast);
            container.appendChild(pBest);
        },

        // --- Helpers ---

        lockCorrectAnswer: function (input, button) {
            if (input) {
                input.disabled = true;
                // We rely on CSS for styling disabled inputs
            }
            if (button) {
                button.disabled = true;
                button.textContent = "Correct"; // Optional feedback
            }
        },

        mountSubmissionBar: function (config) {
            // config: { containerEl, worksheet_id, getScore: fn, onNewQuestions: fn }
            if (!config || !config.containerEl) return;

            // Scope check? We assume containerEl is provided by user code inside worksheet.

            var container = config.containerEl;
            container.innerHTML = '';
            container.classList.add('esheets-submission-bar');

            // Main button wrapper
            var wrap = document.createElement('div');
            wrap.className = 'esheets-btn-group';

            // 1. Record Button
            var btnRecord = document.createElement('button');
            btnRecord.textContent = "Record my score";
            btnRecord.className = 'esheets-btn esheets-btn-primary';
            btnRecord.disabled = true;

            // 2. New Questions Button
            var btnReset = document.createElement('button');
            btnReset.textContent = "New questions";
            btnReset.className = 'esheets-btn esheets-btn-secondary';

            wrap.appendChild(btnRecord);
            wrap.appendChild(btnReset);
            container.appendChild(wrap);

            // Confirmation UI
            var confirmDiv = document.createElement('div');
            confirmDiv.className = 'esheets-confirm-ui';
            confirmDiv.style.display = 'none';

            confirmDiv.innerHTML =
                '<p>Start new questions? This will reset your current progress.</p>' +
                '<div class="esheets-btn-group">' +
                '<button class="esheets-btn esheets-btn-secondary" data-action="cancel">Cancel</button>' +
                '<button class="esheets-btn esheets-btn-primary" data-action="confirm">Yes, start new</button>' +
                '</div>';

            container.appendChild(confirmDiv);

            // 3. Summary Area
            var summaryDiv = document.createElement('div');
            container.appendChild(summaryDiv);

            // --- Logic ---

            // Update summary initially
            ESHEETS.renderSubmissionSummary(summaryDiv);

            // Handle Record
            btnRecord.addEventListener('click', function () {
                var data = config.getScore ? config.getScore() : { score: 0, maxScore: 0 };
                ESHEETS.submit(data.score, data.maxScore);
                ESHEETS.renderSubmissionSummary(summaryDiv);

                btnRecord.disabled = true;
                btnRecord.textContent = "Recorded!";
            });

            // Handle Reset
            btnReset.addEventListener('click', function () {
                confirmDiv.style.display = 'block';
                wrap.style.display = 'none';
            });

            // Handle Confirm/Cancel (delegation)
            confirmDiv.addEventListener('click', function (e) {
                if (e.target.tagName !== 'BUTTON') return;
                var action = e.target.getAttribute('data-action');

                if (action === 'confirm') {
                    if (config.onNewQuestions) config.onNewQuestions();
                    confirmDiv.style.display = 'none';
                    wrap.style.display = 'flex';
                    btnRecord.textContent = "Record my score";
                } else if (action === 'cancel') {
                    confirmDiv.style.display = 'none';
                    wrap.style.display = 'flex';
                }
            });

            // Return controls
            return {
                recordBtn: btnRecord,
                updateState: function (score) {
                    if (score > 0) {
                        btnRecord.disabled = false;
                        if (btnRecord.textContent === "Recorded!") btnRecord.textContent = "Record my score";
                    } else {
                        btnRecord.disabled = true;
                    }
                }
            };
        },

        mountIdentityBar: function (config) {
            // config: { containerEl, fields: { first_name, last_name, class_code }, queryPrefill: { ... } }
            if (!document.querySelector('.esheets-worksheet')) return;
            if (!config || !config.containerEl) return;

            var container = config.containerEl;
            var identity = getIdentityStorage();
            var params = new URLSearchParams(window.location.search);
            var updates = {};

            // Helper for param checking
            function checkParams(keys, allowEmpty) {
                if (!keys || !Array.isArray(keys)) return null;
                for (var i = 0; i < keys.length; i++) {
                    if (params.has(keys[i])) {
                        var val = params.get(keys[i]);
                        if (val || allowEmpty) return val;
                    }
                }
                return null;
            }

            // Prefill Logic
            if (config.queryPrefill) {
                // Config driven
                var qp = config.queryPrefill;

                // 1. first_name
                if (qp.first_name && qp.first_name.paramAnyOf) {
                    var fVal = checkParams(qp.first_name.paramAnyOf, qp.first_name.allowEmpty);
                    if (fVal !== null) updates.first_name = fVal;
                }

                // 2. last_name
                if (qp.last_name && qp.last_name.paramAnyOf) {
                    var lVal = checkParams(qp.last_name.paramAnyOf, qp.last_name.allowEmpty);
                    if (lVal !== null) updates.last_name = lVal;
                }

                // 3. class_code
                if (qp.class_code && qp.class_code.paramAnyOf) {
                    var cVal = checkParams(qp.class_code.paramAnyOf, qp.class_code.allowEmpty);
                    if (cVal !== null) updates.class_code = cVal;
                }

                // 4. legacy name
                if (qp.name && qp.name.paramAnyOf) {
                    var nVal = checkParams(qp.name.paramAnyOf, qp.name.allowEmpty);
                    if (nVal !== null) {
                        // Split logic
                        var parts = nVal.trim().split(/\s+/);
                        if (parts.length > 0) {
                            if (!updates.first_name) updates.first_name = parts[0];
                            if (!updates.last_name) updates.last_name = parts.slice(1).join(' ');
                        }
                    }
                }

            } else {
                // Default Hardcoded Behavior (Fallback)
                var fValDef = checkParams(["first", "firstname", "fname"], false);
                if (fValDef !== null) updates.first_name = fValDef;

                var lValDef = checkParams(["last", "lastname", "lname"], false);
                if (lValDef !== null) updates.last_name = lValDef;

                var cValDef = checkParams(["class", "classcode", "code"], false);
                if (cValDef !== null) updates.class_code = cValDef;

                if (params.has("name")) {
                    var nValDef = params.get("name");
                    if (nValDef) {
                        var partsDef = nValDef.trim().split(/\s+/);
                        if (partsDef.length > 0) {
                            if (!updates.first_name) updates.first_name = partsDef[0];
                            if (!updates.last_name) updates.last_name = partsDef.slice(1).join(' ');
                        }
                    }
                }
            }

            // Apply updates if any & Handle Class Code Read-Only Logic
            var classCodeFromUrl = false;
            if (Object.keys(updates).length > 0) {
                // If class code came from URL, check validity before saving
                if (updates.class_code) {
                    var norm = normalizeClassCode(updates.class_code);
                    if (isValidClassCode(norm)) {
                        classCodeFromUrl = true; // Use normalized valid code as locked
                        updates.class_code = norm;
                    } else {
                        // Invalid URL param? setIdentity will reject it to empty.
                    }
                }
                identity = ESHEETS.setIdentity(updates);
            }

            // Render UI
            container.innerHTML = '';
            container.classList.add('esheets-identity-bar');

            // Fields visibility config
            var showFirst = (!config.fields || config.fields.first_name !== false);
            var showLast = (!config.fields || config.fields.last_name !== false);
            var showClass = (!config.fields || config.fields.class_code !== false);

            function createField(label, key, value, isClassCode) {
                var wrap = document.createElement('div');

                var lbl = document.createElement('label');
                lbl.textContent = label;

                var inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'es-input';
                inp.value = value || '';
                inp.placeholder = '...';

                // Specific handling for class code
                if (isClassCode) {
                    if (classCodeFromUrl) {
                        inp.readOnly = true;
                        inp.classList.add('es-readonly');
                    }

                    // Visual feedback on input
                    inp.addEventListener('input', function () {
                        var val = normalizeClassCode(inp.value);
                        var valid = isValidClassCode(val);
                        // If valid or empty -> fine. If content exists but invalid -> es-invalid.
                        if (!valid && val !== "") {
                            inp.classList.add('es-invalid');
                        } else {
                            inp.classList.remove('es-invalid');
                        }
                    });
                }

                inp.addEventListener('change', function () {
                    var u = {};
                    u[key] = inp.value;
                    ESHEETS.setIdentity(u);

                    // Re-sync input value with what was actually stored (e.g. normalized or emptied)
                    var current = getIdentityStorage();
                    if (current[key] !== inp.value) {
                        inp.value = current[key];
                        // Re-trigger visual validation logic in case it was emptied
                        if (isClassCode) {
                            inp.dispatchEvent(new Event('input'));
                        }
                    }
                });

                wrap.appendChild(lbl);
                wrap.appendChild(inp);
                return wrap;
            }

            if (showFirst) {
                container.appendChild(createField('First name:', 'first_name', identity.first_name, false));
            }
            if (showLast) {
                container.appendChild(createField('Last name:', 'last_name', identity.last_name, false));
            }
            if (showClass) {
                container.appendChild(createField('Class code:', 'class_code', identity.class_code, true));
            }
        },

        /**
         * Mounts the Teacher Panel if unlocked via URL parameters.
         * @param {Object} config
         * @param {HTMLElement} config.containerEl - Where to mount the panel
         * @param {Function} config.getAnswerItems - Returns array of { inputEl, answer, feedbackEl, checkBtnEl }
         * @param {Object} config.unlock - { queryParamAnyOf: string[], allowValues: string[] }
         */
        mountTeacherPanel: function (config) {
            if (!config || !config.containerEl) return;

            var panelEl = config.containerEl;
            panelEl.classList.add('esheets-teacher-panel');

            // State for toggle
            var isRevealed = false;
            var originalValues = new Map(); // Store original input values

            // 1. Initial State Check
            var unlocked = false;
            var params = new URLSearchParams(window.location.search);

            if (config.unlock && Array.isArray(config.unlock.queryParamAnyOf)) {
                config.unlock.queryParamAnyOf.forEach(function (param) {
                    if (params.has(param)) {
                        var val = params.get(param);
                        if (config.unlock.allowValues && Array.isArray(config.unlock.allowValues)) {
                            if (config.unlock.allowValues.indexOf(val) !== -1 || config.unlock.allowValues.indexOf('*') !== -1) {
                                unlocked = true;
                            }
                        } else if (val) {
                            unlocked = true;
                        }
                    }
                });
            }

            // Logic to toggle teacher mode
            function setTeacherMode(isTeacher) {
                document.documentElement.classList.toggle('esheets-teacher', isTeacher);
                panelEl.style.display = isTeacher ? 'flex' : 'none';
            }

            // Initialize state
            setTeacherMode(unlocked);

            // 2. Render Panel
            panelEl.innerHTML =
                '<div class="es-tp-header">Teacher Mode</div>' +
                '<div class="es-tp-actions">' +
                '<button class="es-btn es-btn-small es-btn-secondary" id="es-tp-reveal">Reveal Answers</button>' +
                '<button class="es-btn es-btn-small es-btn-secondary" id="es-tp-print">Print Worksheet</button>' +
                '<button class="es-btn es-btn-small es-btn-outline" id="es-tp-close" title="Hide Panel (Ctrl+Alt+R)" style="margin-left: 0.5rem;">&#10006;</button>' +
                '</div>';

            // 3. Bind Events
            var revealBtn = panelEl.querySelector('#es-tp-reveal');
            var printBtn = panelEl.querySelector('#es-tp-print');
            var closeBtn = panelEl.querySelector('#es-tp-close');

            if (revealBtn) {
                revealBtn.addEventListener('click', function () {
                    if (typeof config.getAnswerItems !== 'function') return;
                    var items = config.getAnswerItems();

                    if (!isRevealed) {
                        // REVEAL
                        items.forEach(function (item) {
                            if (item.inputEl) {
                                // Store original state
                                if (!originalValues.has(item.inputEl)) {
                                    originalValues.set(item.inputEl, {
                                        value: item.inputEl.value,
                                        disabled: item.inputEl.disabled,
                                        wasRevealed: item.inputEl.classList.contains('es-revealed')
                                    });
                                }
                                item.inputEl.value = item.answer;
                                item.inputEl.disabled = true;
                                item.inputEl.classList.add('es-revealed');
                            }
                            if (item.checkBtnEl) {
                                item.checkBtnEl.style.visibility = 'hidden';
                            }
                            if (item.feedbackEl) {
                                // Store feedback text if needed, but for now just overwrite
                                item.feedbackEl.dataset.original = item.feedbackEl.innerHTML;
                                item.feedbackEl.innerHTML = '<span class="es-pill es-pill-correct">Reveal</span>';
                            }
                        });
                        revealBtn.textContent = "Hide Answers";
                        isRevealed = true;
                    } else {
                        // HIDE (Restore)
                        items.forEach(function (item) {
                            if (item.inputEl && originalValues.has(item.inputEl)) {
                                var orig = originalValues.get(item.inputEl);
                                item.inputEl.value = orig.value;
                                item.inputEl.disabled = orig.disabled;
                                if (!orig.wasRevealed) item.inputEl.classList.remove('es-revealed');
                            }
                            if (item.checkBtnEl) {
                                item.checkBtnEl.style.visibility = '';
                            }
                            if (item.feedbackEl) {
                                if (item.feedbackEl.dataset.original) {
                                    item.feedbackEl.innerHTML = item.feedbackEl.dataset.original;
                                } else {
                                    item.feedbackEl.innerHTML = '';
                                }
                            }
                        });
                        revealBtn.textContent = "Reveal Answers";
                        isRevealed = false;
                    }
                });
            }

            if (printBtn) {
                printBtn.addEventListener('click', function () {
                    window.print();
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', function () {
                    setTeacherMode(false);
                });
            }

            // 4. Keyboard Shortcut (Ctrl + Alt + R)
            document.addEventListener('keydown', function (e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

                if (e.ctrlKey && e.altKey && (e.key === 'r' || e.key === 'R')) {
                    e.preventDefault();
                    var currentlyTeacher = document.documentElement.classList.contains('esheets-teacher');
                    setTeacherMode(!currentlyTeacher);
                }
            });
        },

        getProgress: function () {
            if (!meta.worksheet_id) return null;
            return getRecord(meta.worksheet_id);
        }
    });

})();