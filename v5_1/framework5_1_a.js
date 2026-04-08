/* CANONICAL v5.1 — Full Framework (Scoped: .esheets-worksheet) */

/**
 * ESHEETS v5.1 Framework Core
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

    var meta = {};          
    var worksheetMeta = {}; 
    var isMounted = false;
    var trackingAdapter = null;
    var lockoutActive = false;
    var lockoutUIHandler = function(){};

    var launchTracking = {
        class_code: "",
        task_code: "",
        active: false
    };

    // --- Internal Helpers ---

    function getStorage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);

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

            var identity = {
                first_name: data.first_name || "",
                last_name: data.last_name || ""
            };

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

    function formatPct(p) {
        var rounded = Math.round(p * 10) / 10;
        return Number.isInteger(rounded) ? rounded : rounded.toFixed(1);
    }

    function formatScore(s, m, p) {
        return s + ' / ' + m + ' (' + formatPct(p) + '%)';
    }

    var TRACKING_CODE_REGEX = /^[A-HJ-NP-Z2-9]{5}$/;

    function normalizeTrackingCode(str) {
        if (typeof str !== 'string') return "";
        return str.trim().toUpperCase().replace(/\s+/g, '');
    }

    function isValidTrackingCode(str) {
        return TRACKING_CODE_REGEX.test(str);
    }

    window.ESHEETS = window.ESHEETS || {};

    Object.assign(window.ESHEETS, {

        init: function (options) {
            if (!document.querySelector('.esheets-worksheet')) {
                return;
            }

            meta = options || {};
            if (meta.meta) {
                worksheetMeta = meta.meta; 
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

        setFeedback: function (feedbackEl, state, message) {
            if (!feedbackEl) return;

            if (!feedbackEl.classList.contains('es-feedback')) {
                feedbackEl.classList.add('es-feedback');
            }

            feedbackEl.classList.remove('es-feedback--correct', 'es-feedback--incorrect', 'es-feedback--neutral');

            if (state === 'correct' || state === 'incorrect' || state === 'neutral') {
                feedbackEl.classList.add('es-feedback--' + state);
            }

            feedbackEl.textContent = message || "";
        },

        clearFeedback: function (feedbackEl) {
            this.setFeedback(feedbackEl, 'neutral', "");
        },

        setScore: function (score, maxScore) {
            if (!isMounted) return;
            if (typeof score !== 'number' || typeof maxScore !== 'number' || isNaN(score) || isNaN(maxScore)) return;

            var s = Math.max(0, score);
            var m = Math.max(1, maxScore);
            var pct = (m > 0) ? (s / m) * 100 : 0;

            // Updated label per v5.1 requirements
            var text = 'Current score: ' + s + ' / ' + m + ' (' + formatPct(pct) + '%)';
            updatePlaceholders(text);

            if (s === 0) {
                document.documentElement.classList.add('es-score-zero');
            } else {
                document.documentElement.classList.remove('es-score-zero');
            }
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

            var payloadIdentity = getIdentityStorage();
            if (launchTracking.active) {
                payloadIdentity.class_code = launchTracking.class_code;
                payloadIdentity.task_code = launchTracking.task_code;
            }

            var payload = {
                worksheet_id: meta.worksheet_id,
                score: s,
                maxScore: m,
                percent: pct,
                submittedAt: now,
                first_name: payloadIdentity.first_name || "",
                last_name: payloadIdentity.last_name || "",
                class_code: payloadIdentity.class_code || "",
                task_code: payloadIdentity.task_code || "",
                bestScore: updates.bestScore !== undefined ? updates.bestScore : currentBestScore,
                bestPercent: updates.bestPercent !== undefined ? updates.bestPercent : currentBestPercent
            };

            if (typeof trackingAdapter === 'function') {
                try {
                    trackingAdapter(payload);
                } catch (e) {
                    console.warn('ESHEETS: tracking adapter error', e);
                }
            }

            if (launchTracking.active) {
                return fetch('https://portal.esheets.io/api/submissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(function (res) {
                    if (!res.ok) throw new Error('Central submission failed');
                    return { success: true };
                }).catch(function (err) {
                    console.warn('ESHEETS: central submission error', err);
                    return { success: false };
                });
            }

            return Promise.resolve({ success: true, localOnly: true });
        },

        renderSubmissionSummary: function (container) {
            if (!container || !meta.worksheet_id) return;

            container.innerHTML = '';
            container.classList.add('esheets-summary');

            var record = getRecord(meta.worksheet_id);

            if (!record || !record.submittedAt) {
                var p = document.createElement('div');
                p.textContent = "No previous submissions.";
                container.appendChild(p);
                return;
            }

            // Updated summary labels per v5.1 requirements
            var lastText = "Last recorded: " + formatScore(record.lastScore, record.maxScore, record.lastPercent);
            var bestText = "Personal best: " + formatScore(record.bestScore, record.maxScore, record.bestPercent);

            var pLast = document.createElement('div');
            pLast.textContent = lastText;

            var pBest = document.createElement('div');
            pBest.textContent = bestText;

            container.appendChild(pLast);
            container.appendChild(pBest);
        },

        lockCorrectAnswer: function (inputs, button) {
            if (inputs) {
                var inputList = Array.isArray(inputs) ? inputs : 
                               (typeof NodeList !== 'undefined' && inputs instanceof NodeList ? Array.prototype.slice.call(inputs) : [inputs]);
                for (var i = 0; i < inputList.length; i++) {
                    var el = inputList[i];
                    if (el) {
                        // Completely lock the input structurally and visually
                        el.readOnly = true;
                        el.disabled = true;
                        el.classList.add('es-correct-locked');
                    }
                }
            }
            if (button) {
                // Ensure logic loops are terminated by wiping the button
                button.style.display = 'none';
            }
        },

        focusNextUnanswered: function (currentInput) {
            if (!currentInput) return false;
            var inputs = document.querySelectorAll('.esheets-worksheet input[type="text"]:not(:disabled):not([readonly]), .esheets-worksheet input[type="number"]:not(:disabled):not([readonly])');
            var foundCurrent = false;
            for (var i = 0; i < inputs.length; i++) {
                if (foundCurrent && inputs[i] !== currentInput && inputs[i].offsetParent !== null) {
                    inputs[i].focus();
                    return true;
                }
                if (inputs[i] === currentInput) {
                    foundCurrent = true;
                }
            }
            return false;
        },

        mountSubmissionBar: function (config) {
            if (!config || !config.containerEl) return;

            var container = config.containerEl;

            var topScoreEl = document.querySelector('[data-esheets-score="top"]');
            var topLockout = null;
            if (topScoreEl && topScoreEl.parentNode) {
                topLockout = document.createElement('div');
                topLockout.className = 'es-lockout-message';
                topLockout.style.display = 'none';
                topLockout.textContent = 'Answers were revealed. Record my score is disabled until new questions are generated.';
                if (topScoreEl.nextSibling) {
                    topScoreEl.parentNode.insertBefore(topLockout, topScoreEl.nextSibling);
                } else {
                    topScoreEl.parentNode.appendChild(topLockout);
                }
            }

            var bottomLockout = document.createElement('div');
            bottomLockout.className = 'es-lockout-message';
            bottomLockout.style.display = 'none';
            bottomLockout.textContent = 'Answers were revealed. Record my score is disabled until new questions are generated.';
            
            if (container.parentNode) {
                container.parentNode.insertBefore(bottomLockout, container);
            }

            container.innerHTML = '';
            container.classList.add('esheets-submission-bar');

            var wrap = document.createElement('div');
            wrap.className = 'esheets-btn-group';

            var btnRecord = document.createElement('button');
            btnRecord.textContent = "Record my score";
            btnRecord.className = 'esheets-btn esheets-btn-primary';
            btnRecord.disabled = true;

            var btnReset = document.createElement('button');
            btnReset.textContent = "New questions";
            btnReset.className = 'esheets-btn esheets-btn-secondary';

            wrap.appendChild(btnRecord);
            wrap.appendChild(btnReset);
            container.appendChild(wrap);

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

            var summaryDiv = document.createElement('div');
            container.appendChild(summaryDiv);

            ESHEETS.renderSubmissionSummary(summaryDiv);

            btnRecord.addEventListener('click', function () {
                var data = config.getScore ? config.getScore() : { score: 0, maxScore: 0 };
                
                btnRecord.disabled = true;
                btnRecord.textContent = "Recording...";
                
                var existingErr = container.querySelector('.es-submit-error');
                if (existingErr) existingErr.remove();

                var submitResult = ESHEETS.submit(data.score, data.maxScore);
                ESHEETS.renderSubmissionSummary(summaryDiv);

                if (submitResult && typeof submitResult.then === 'function') {
                    submitResult.then(function(res) {
                        if (res && res.success === false) {
                            btnRecord.textContent = "Record my score";
                            btnRecord.disabled = false;
                            
                            var errDiv = document.createElement('div');
                            errDiv.className = 'es-submit-error';
                            errDiv.style.color = '#d32f2f';
                            errDiv.style.backgroundColor = '#fff2f2';
                            errDiv.style.border = '1px solid #ffcdd2';
                            errDiv.style.padding = '0.75rem';
                            errDiv.style.borderRadius = '4px';
                            errDiv.style.marginTop = '0.5rem';
                            errDiv.style.fontSize = '0.9em';
                            errDiv.textContent = "Your score was saved on this device, but could not be sent to the teacher portal. Please try again.";
                            if (summaryDiv.parentNode) {
                                summaryDiv.parentNode.insertBefore(errDiv, summaryDiv);
                            }
                        } else {
                            btnRecord.textContent = "Recorded!";
                        }
                    });
                } else {
                    btnRecord.textContent = "Recorded!";
                }
            });

            btnReset.addEventListener('click', function () {
                confirmDiv.style.display = 'block';
                wrap.style.display = 'none';
            });

            confirmDiv.addEventListener('click', function (e) {
                if (e.target.tagName !== 'BUTTON') return;
                var action = e.target.getAttribute('data-action');

                if (action === 'confirm') {
                    lockoutActive = false;
                    lockoutUIHandler();
                    if (config.onNewQuestions) config.onNewQuestions();
                    confirmDiv.style.display = 'none';
                    wrap.style.display = 'flex';
                    btnRecord.textContent = "Record my score";
                } else if (action === 'cancel') {
                    confirmDiv.style.display = 'none';
                    wrap.style.display = 'flex';
                }
            });

            lockoutUIHandler = function() {
                if (lockoutActive) {
                    if (topLockout) topLockout.style.display = 'block';
                    bottomLockout.style.display = 'block';
                    btnRecord.disabled = true;
                } else {
                    if (topLockout) topLockout.style.display = 'none';
                    bottomLockout.style.display = 'none';
                }
            };
            lockoutUIHandler();

            return {
                recordBtn: btnRecord,
                updateState: function (score) {
                    if (lockoutActive) {
                        btnRecord.disabled = true;
                        return;
                    }
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
            if (!document.querySelector('.esheets-worksheet')) return;
            if (!config || !config.containerEl) return;

            var container = config.containerEl;
            var identity = getIdentityStorage();
            var params = new URLSearchParams(window.location.search);
            var updates = {};

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

            var parsedClass = "";
            var parsedTask = "";

            if (config.queryPrefill) {
                var qp = config.queryPrefill;

                if (qp.first_name && qp.first_name.paramAnyOf) {
                    var fVal = checkParams(qp.first_name.paramAnyOf, qp.first_name.allowEmpty);
                    if (fVal !== null) updates.first_name = fVal;
                }

                if (qp.last_name && qp.last_name.paramAnyOf) {
                    var lVal = checkParams(qp.last_name.paramAnyOf, qp.last_name.allowEmpty);
                    if (lVal !== null) updates.last_name = lVal;
                }

                if (qp.class_code && qp.class_code.paramAnyOf) {
                    parsedClass = checkParams(qp.class_code.paramAnyOf, qp.class_code.allowEmpty) || "";
                }

                if (qp.task_code && qp.task_code.paramAnyOf) {
                    parsedTask = checkParams(qp.task_code.paramAnyOf, qp.task_code.allowEmpty) || "";
                }

                if (qp.name && qp.name.paramAnyOf) {
                    var nVal = checkParams(qp.name.paramAnyOf, qp.name.allowEmpty);
                    if (nVal !== null) {
                        var parts = nVal.trim().split(/\s+/);
                        if (parts.length > 0) {
                            if (!updates.first_name) updates.first_name = parts[0];
                            if (!updates.last_name) updates.last_name = parts.slice(1).join(' ');
                        }
                    }
                }

            } else {
                var fValDef = checkParams(["first", "firstname", "fname"], false);
                if (fValDef !== null) updates.first_name = fValDef;

                var lValDef = checkParams(["last", "lastname", "lname"], false);
                if (lValDef !== null) updates.last_name = lValDef;

                parsedClass = checkParams(["class", "class_code", "classcode"], false) || "";
                parsedTask = checkParams(["task", "task_code", "taskcode"], false) || "";

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

            // Dual tracking check layer - Strict Launch Context (No Persistence)
            var activeClass = normalizeTrackingCode(parsedClass);
            var activeTask = normalizeTrackingCode(parsedTask);
            var isTrackingActive = isValidTrackingCode(activeClass) && isValidTrackingCode(activeTask);

            if (isTrackingActive) {
                launchTracking.class_code = activeClass;
                launchTracking.task_code = activeTask;
                launchTracking.active = true;
            } else {
                launchTracking.class_code = "";
                launchTracking.task_code = "";
                launchTracking.active = false;
            }

            if (Object.keys(updates).length > 0) {
                identity = ESHEETS.setIdentity(updates);
            }

            container.innerHTML = '';
            container.classList.add('esheets-identity-bar');

            var showFirst = (!config.fields || config.fields.first_name !== false);
            var showLast = (!config.fields || config.fields.last_name !== false);

            var printHeaderFields = {};

            function createField(label, key, value) {
                var wrap = document.createElement('div');
                wrap.className = 'es-id-field';

                var lbl = document.createElement('label');
                lbl.textContent = label;

                var inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'es-input';
                inp.value = value || '';
                inp.placeholder = '...';

                inp.addEventListener('change', function () {
                    var u = {};
                    u[key] = inp.value;
                    ESHEETS.setIdentity(u);

                    var current = getIdentityStorage();
                    if (current[key] !== inp.value) {
                        inp.value = current[key];
                    }
                    if (printHeaderFields[key]) {
                        printHeaderFields[key].textContent = current[key] || '____________________';
                    }
                });

                wrap.appendChild(lbl);
                wrap.appendChild(inp);
                return wrap;
            }

            if (isTrackingActive) {
                container.classList.remove('es-tracking-inactive');
                var inputsWrap = document.createElement('div');
                inputsWrap.className = 'es-id-row';

                if (showFirst) {
                    inputsWrap.appendChild(createField('First name:', 'first_name', identity.first_name));
                }
                if (showLast) {
                    inputsWrap.appendChild(createField('Last name:', 'last_name', identity.last_name));
                }
                
                container.appendChild(inputsWrap);

                var trackPanel = document.createElement('div');
                trackPanel.className = 'es-tracking-panel';
                trackPanel.innerHTML = '<span class="es-track-label">Class:</span> <span class="es-track-val">' + launchTracking.class_code + '</span> ' +
                                       '<span class="es-track-label">Task:</span> <span class="es-track-val">' + launchTracking.task_code + '</span>';
                container.appendChild(trackPanel);
            } else {
                container.classList.add('es-tracking-inactive');
            }

            // Print Header Setup
            var printHeader = document.createElement('div');
            printHeader.className = 'es-print-header';
            
            var printHeaderFirstWrap = document.createElement('div');
            var dispFirst = isTrackingActive ? (identity.first_name || '____________________') : '____________________';
            printHeaderFirstWrap.innerHTML = 'First Name: <span>' + dispFirst + '</span>';
            printHeaderFields.first_name = printHeaderFirstWrap.querySelector('span');

            var printHeaderLastWrap = document.createElement('div');
            var dispLast = isTrackingActive ? (identity.last_name || '____________________') : '____________________';
            printHeaderLastWrap.innerHTML = 'Last Name: <span>' + dispLast + '</span>';
            printHeaderFields.last_name = printHeaderLastWrap.querySelector('span');

            printHeader.appendChild(printHeaderFirstWrap);
            printHeader.appendChild(printHeaderLastWrap);
            
            container.appendChild(printHeader);
        },

        mountTeacherPanel: function (config) {
            if (!config || !config.containerEl) return;

            var panelEl = config.containerEl;
            panelEl.classList.add('esheets-teacher-panel');

            var isRevealed = false;
            var originalValues = new Map(); 

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

            function setTeacherMode(isTeacher) {
                document.documentElement.classList.toggle('esheets-teacher', isTeacher);
                panelEl.style.display = isTeacher ? 'flex' : 'none';
            }

            setTeacherMode(unlocked);

            panelEl.innerHTML =
                '<div class="es-tp-header">Teacher Mode</div>' +
                '<div class="es-tp-actions">' +
                '<button class="es-btn es-btn-small es-btn-secondary" id="es-tp-reveal">Reveal Answers</button>' +
                '<button class="es-btn es-btn-small es-btn-secondary" id="es-tp-print">Print Worksheet</button>' +
                '<button class="es-btn-outline es-tp-close" id="es-tp-close" title="Hide Panel (Ctrl+Alt+R)" style="margin-left: 0.5rem;">&#10006;</button>' +
                '</div>';

            var revealBtn = panelEl.querySelector('#es-tp-reveal');
            var printBtn = panelEl.querySelector('#es-tp-print');
            var closeBtn = panelEl.querySelector('#es-tp-close');

            if (revealBtn) {
                revealBtn.addEventListener('click', function () {
                    if (typeof config.getAnswerItems !== 'function') return;
                    var items = config.getAnswerItems();

                    if (!isRevealed) {
                        items.forEach(function (item) {
                            if (item.inputEl) {
                                if (!originalValues.has(item.inputEl)) {
                                    originalValues.set(item.inputEl, {
                                        value: item.inputEl.value,
                                        disabled: item.inputEl.disabled,
                                        wasRevealed: item.inputEl.classList.contains('es-revealed'),
                                        isCorrectLocked: item.inputEl.classList.contains('es-correct-locked')
                                    });
                                }
                                
                                if (!item.inputEl.classList.contains('es-correct-locked')) {
                                    item.inputEl.value = item.answer;
                                    item.inputEl.disabled = true;
                                    item.inputEl.classList.add('es-revealed');
                                }
                            }
                            if (item.checkBtnEl && item.checkBtnEl.style.display !== 'none') {
                                item.checkBtnEl.style.visibility = 'hidden';
                            }
                            if (item.feedbackEl && (!item.inputEl || !item.inputEl.classList.contains('es-correct-locked'))) {
                                if (!item.feedbackEl.hasAttribute('data-original')) {
                                    item.feedbackEl.setAttribute('data-original', item.feedbackEl.innerHTML);
                                    item.feedbackEl.innerHTML = '<span class="es-muted" style="font-style: italic; font-weight: normal;">Revealed answer</span>';
                                }
                            }
                        });
                        revealBtn.textContent = "Hide Answers";
                        isRevealed = true;
                        lockoutActive = true;
                        lockoutUIHandler();
                    } else {
                        items.forEach(function (item) {
                            if (item.inputEl && originalValues.has(item.inputEl)) {
                                var orig = originalValues.get(item.inputEl);
                                if (!orig.isCorrectLocked) {
                                    item.inputEl.value = orig.value;
                                    item.inputEl.disabled = orig.disabled;
                                }
                                if (!orig.wasRevealed) item.inputEl.classList.remove('es-revealed');
                            }
                            if (item.checkBtnEl && item.checkBtnEl.style.display !== 'none') {
                                item.checkBtnEl.style.visibility = '';
                            }
                            if (item.feedbackEl && item.feedbackEl.hasAttribute('data-original') && (!item.inputEl || !item.inputEl.classList.contains('es-correct-locked'))) {
                                item.feedbackEl.innerHTML = item.feedbackEl.getAttribute('data-original');
                                item.feedbackEl.removeAttribute('data-original');
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
