
/* ESHEETS v5.1q additions — staged tracked-submission snapshots. */
(function () {
    'use strict';

    if (!window.ESHEETS || window.ESHEETS.__snapshotQInstalled) return;
    window.ESHEETS.__snapshotQInstalled = true;

    var PORTAL_SUBMISSION_URL = 'https://portal.esheets.io/api/submissions';
    var SNAPSHOT_FORMAT_VERSION = 1;
    var CLIENT_SNAPSHOT_LIMIT = 440 * 1024;
    var CLIENT_REQUEST_LIMIT = 900 * 1024;
    var TRACKING_CODE_REGEX = /^[A-HJ-NP-Z2-9]{5}$/;
    var answerItemsProvider = null;
    var cachedStyleMarkup = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function normaliseUrl(input, baseUrl) {
        try {
            return new URL(input, baseUrl).href;
        } catch (error) {
            return '';
        }
    }

    function nextBrowserTurn() {
        return new Promise(function (resolve) {
            if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(function () {
                    window.setTimeout(resolve, 0);
                });
            } else {
                window.setTimeout(resolve, 0);
            }
        });
    }

    function getElementIndexMap(sourceRoot, cloneRoot) {
        var sourceElements = [sourceRoot].concat(Array.prototype.slice.call(sourceRoot.querySelectorAll('*')));
        var cloneElements = [cloneRoot].concat(Array.prototype.slice.call(cloneRoot.querySelectorAll('*')));
        var map = new Map();
        var length = Math.min(sourceElements.length, cloneElements.length);
        for (var i = 0; i < length; i++) map.set(sourceElements[i], cloneElements[i]);
        return map;
    }

    function getAnswerState(sourceRoot, cloneRoot) {
        var answerValues = new Map();
        var revealedControls = new Set();

        if (typeof answerItemsProvider !== 'function') {
            return { answerValues: answerValues, revealedControls: revealedControls };
        }

        var items = answerItemsProvider() || [];
        if (!Array.isArray(items)) items = Array.prototype.slice.call(items || []);
        var elementMap = getElementIndexMap(sourceRoot, cloneRoot);

        items.forEach(function (item) {
            if (!item) return;

            if (item.inputEl && sourceRoot.contains(item.inputEl) && !item.inputEl.classList.contains('es-correct-locked')) {
                answerValues.set(item.inputEl, item.answer == null ? '' : String(item.answer));
                revealedControls.add(item.inputEl);
            }

            if (item.feedbackEl && sourceRoot.contains(item.feedbackEl)) {
                var cloneFeedback = elementMap.get(item.feedbackEl);
                if (cloneFeedback && (!item.inputEl || !item.inputEl.classList.contains('es-correct-locked'))) {
                    cloneFeedback.innerHTML = '<span class="es-muted" style="font-style: italic; font-weight: normal;">Revealed answer</span>';
                }
            }
        });

        return { answerValues: answerValues, revealedControls: revealedControls };
    }

    function buildStaticControl(sourceControl, cloneControl, doc, answerState) {
        var tagName = sourceControl.tagName.toLowerCase();
        var type = (sourceControl.type || '').toLowerCase();

        if (tagName === 'input' && type === 'hidden') {
            cloneControl.remove();
            return;
        }

        var replacement = doc.createElement(tagName === 'textarea' ? 'div' : 'span');
        replacement.className = [
            'es-snapshot-control',
            sourceControl.className || '',
            type ? 'es-snapshot-' + type : ''
        ].join(' ').trim();

        if (answerState && answerState.revealedControls.has(sourceControl)) {
            replacement.classList.add('es-revealed');
        }
        if (sourceControl.id) replacement.setAttribute('data-source-id', sourceControl.id);
        if (sourceControl.getAttribute('aria-label')) {
            replacement.setAttribute('aria-label', sourceControl.getAttribute('aria-label'));
        }

        var hasAnswerOverride = answerState && answerState.answerValues.has(sourceControl);
        var displayValue = '';

        if (hasAnswerOverride) {
            displayValue = answerState.answerValues.get(sourceControl);
        } else if (tagName === 'select') {
            displayValue = Array.prototype.slice.call(sourceControl.selectedOptions || [])
                .map(function (option) { return option.textContent.trim(); })
                .join(', ');
        } else if (tagName === 'textarea') {
            displayValue = sourceControl.value;
        } else if (type === 'radio') {
            displayValue = sourceControl.checked ? '◉' : '○';
            replacement.setAttribute('data-checked', sourceControl.checked ? 'true' : 'false');
        } else if (type === 'checkbox') {
            displayValue = sourceControl.checked ? '☑' : '☐';
            replacement.setAttribute('data-checked', sourceControl.checked ? 'true' : 'false');
        } else if (type === 'range') {
            displayValue = sourceControl.value;
            replacement.setAttribute('data-range-value', sourceControl.value);
        } else {
            displayValue = sourceControl.value;
        }

        replacement.textContent = displayValue || '';
        if (displayValue === '') replacement.setAttribute('data-empty', 'true');
        if (sourceControl.disabled) replacement.setAttribute('data-disabled', 'true');
        if (sourceControl.readOnly) replacement.setAttribute('data-readonly', 'true');
        cloneControl.replaceWith(replacement);
    }

    function copyLiveControls(sourceRoot, cloneRoot, doc, answerState) {
        var sourceControls = Array.prototype.slice.call(sourceRoot.querySelectorAll('input, textarea, select'));
        var cloneControls = Array.prototype.slice.call(cloneRoot.querySelectorAll('input, textarea, select'));

        sourceControls.forEach(function (sourceControl, index) {
            if (cloneControls[index]) buildStaticControl(sourceControl, cloneControls[index], doc, answerState);
        });
    }

    function replaceCanvases(sourceRoot, cloneRoot, doc) {
        var sourceCanvases = Array.prototype.slice.call(sourceRoot.querySelectorAll('canvas'));
        var cloneCanvases = Array.prototype.slice.call(cloneRoot.querySelectorAll('canvas'));

        sourceCanvases.forEach(function (sourceCanvas, index) {
            var cloneCanvas = cloneCanvases[index];
            if (!cloneCanvas) return;

            try {
                var image = doc.createElement('img');
                image.className = ((sourceCanvas.className || '') + ' es-snapshot-canvas-image').trim();
                image.alt = sourceCanvas.getAttribute('aria-label') || 'Captured worksheet diagram';
                image.src = sourceCanvas.toDataURL('image/png');
                image.width = sourceCanvas.width;
                image.height = sourceCanvas.height;
                image.style.maxWidth = '100%';
                image.style.height = 'auto';
                cloneCanvas.replaceWith(image);
            } catch (error) {
                var placeholder = doc.createElement('div');
                placeholder.className = 'es-snapshot-canvas-failure';
                placeholder.textContent = 'This diagram could not be captured.';
                cloneCanvas.replaceWith(placeholder);
            }
        });
    }

    function removeInteractiveUi(cloneRoot) {
        var selectors = [
            '#teacherPanel', '.esheets-teacher-panel',
            '#identityBar', '.esheets-identity-bar',
            '#submissionBar', '.esheets-submission-bar',
            '.es-lockout-message', '#es-teacher-signup-cta', '#es-topic-guide-jump',
            'script', 'noscript', 'button', '.es-btn', '[data-snapshot-exclude]'
        ];

        selectors.forEach(function (selector) {
            Array.prototype.slice.call(cloneRoot.querySelectorAll(selector)).forEach(function (element) {
                element.remove();
            });
        });

        Array.prototype.slice.call(cloneRoot.querySelectorAll('a')).forEach(function (anchor) {
            anchor.removeAttribute('href');
            anchor.removeAttribute('target');
        });

        Array.prototype.slice.call(cloneRoot.querySelectorAll('*')).forEach(function (element) {
            Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
                if (/^on/i.test(attribute.name) || attribute.name === 'contenteditable') {
                    element.removeAttribute(attribute.name);
                }
            });
        });
    }

    function collectStyleMarkup(sourceDocument) {
        if (cachedStyleMarkup !== null) return cachedStyleMarkup;

        var baseUrl = sourceDocument.location.href;
        var linkedStyles = Array.prototype.slice.call(sourceDocument.querySelectorAll('link[rel~="stylesheet"]'))
            .map(function (link) {
                var href = normaliseUrl(link.getAttribute('href'), baseUrl);
                return href ? '<link rel="stylesheet" href="' + escapeHtml(href) + '">' : '';
            })
            .filter(Boolean)
            .join('\n');

        var inlineStyles = Array.prototype.slice.call(sourceDocument.querySelectorAll('style'))
            .map(function (style) { return '<style>' + (style.textContent || '') + '</style>'; })
            .join('\n');

        cachedStyleMarkup = linkedStyles + '\n' + inlineStyles;
        return cachedStyleMarkup;
    }

    function createSnapshot(sourceDocument, kind) {
        var sourceRoot = sourceDocument.querySelector('.esheets-worksheet');
        if (!sourceRoot) throw new Error('No worksheet container was found.');

        var isAnswers = kind === 'answers';
        var cloneRoot = sourceRoot.cloneNode(true);
        var answerState = isAnswers ? getAnswerState(sourceRoot, cloneRoot) : null;

        copyLiveControls(sourceRoot, cloneRoot, sourceDocument, answerState);
        replaceCanvases(sourceRoot, cloneRoot, sourceDocument);
        removeInteractiveUi(cloneRoot);

        var title = sourceDocument.title || 'Worksheet snapshot';
        var sourceUrl = sourceDocument.location.href;
        var capturedAt = new Date().toISOString();
        var heading = isAnswers ? 'Worksheet answer view' : 'Student response';
        var note = isAnswers
            ? 'Captured from the worksheet’s own answer provider.'
            : 'Captured from the student’s marked worksheet state.';

        var snapshotCss = [
            'html { background: #f3f4f6; }',
            'body { margin: 0; padding: 1rem; background: #f3f4f6; }',
            '.es-lockout-message { display: none !important; }',
            '.es-snapshot-meta { max-width: 900px; margin: 0 auto 1rem; padding: 0.75rem 1rem; background: #fff8d8; border: 1px solid #dec76d; border-radius: 8px; font: 14px/1.45 system-ui, sans-serif; }',
            '.es-snapshot-control { display: inline-block; min-width: 2.25em; min-height: 1.4em; box-sizing: border-box; padding: 0.18em 0.4em; margin: 0 0.1em; border: 1px solid #777; border-radius: 4px; background: #fff; color: #111; text-align: center; vertical-align: middle; white-space: pre-wrap; }',
            '.es-snapshot-control[data-empty="true"]::before { content: "\\00a0"; }',
            '.es-snapshot-radio, .es-snapshot-checkbox { min-width: 1.4em; padding: 0; border: 0; background: transparent; font-size: 1.15em; }',
            '.es-snapshot-control.es-correct-locked, .es-snapshot-control.correct, .correct .es-snapshot-control { border-color: #198754; background: #d1e7dd; }',
            '.es-snapshot-control.incorrect, .incorrect .es-snapshot-control { border-color: #dc3545; background: #f8d7da; }',
            '.es-snapshot-control.es-revealed { border-color: #8a6d1d; background: #fff3cd; }',
            '.es-snapshot-canvas-image { display: block; }',
            '.es-snapshot-canvas-failure { padding: 1rem; border: 2px dashed #b42318; color: #b42318; background: #fff; }'
        ].join('\n');

        var html = '<!doctype html>\n' +
            '<html lang="en" data-snapshot-kind="' + (isAnswers ? 'answers' : 'student') + '">\n' +
            '<head>\n<meta charset="utf-8">\n' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
            '<base href="' + escapeHtml(sourceUrl) + '">\n' +
            '<title>' + escapeHtml(title) + ' — ' + escapeHtml(isAnswers ? 'worksheet answers' : 'student response') + '</title>\n' +
            collectStyleMarkup(sourceDocument) + '\n<style>' + snapshotCss + '</style>\n</head>\n<body>\n' +
            '<div class="es-snapshot-meta"><strong>' + escapeHtml(heading) + '</strong><br>' +
            escapeHtml(note) + '<br>Captured: ' + escapeHtml(capturedAt) + '</div>\n' +
            cloneRoot.outerHTML + '\n</body>\n</html>';

        return {
            html: html,
            byteLength: new Blob([html]).size
        };
    }

    function isPortalSubmissionRequest(input) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        return String(url || '').replace(/\/+$/, '') === PORTAL_SUBMISSION_URL;
    }

    function isTrackedPayload(payload) {
        return payload &&
            TRACKING_CODE_REGEX.test(String(payload.class_code || '').trim().toUpperCase()) &&
            TRACKING_CODE_REGEX.test(String(payload.task_code || '').trim().toUpperCase());
    }

    function sendWithSnapshots(originalFetch, input, init, payload) {
        var amended = {};
        Object.keys(init || {}).forEach(function (key) { amended[key] = init[key]; });

        return nextBrowserTurn()
            .then(function () {
                try {
                    var student = createSnapshot(document, 'student');
                    if (student.byteLength <= CLIENT_SNAPSHOT_LIMIT) {
                        payload.student_snapshot_html = student.html;
                    } else {
                        console.warn('ESHEETS: student snapshot exceeded the client size limit and was omitted.');
                    }
                } catch (error) {
                    console.warn('ESHEETS: student snapshot capture failed', error);
                }
                return nextBrowserTurn();
            })
            .then(function () {
                if (!payload.student_snapshot_html || typeof answerItemsProvider !== 'function') return;
                try {
                    var answers = createSnapshot(document, 'answers');
                    if (answers.byteLength <= CLIENT_SNAPSHOT_LIMIT) {
                        payload.answer_snapshot_html = answers.html;
                    } else {
                        console.warn('ESHEETS: answer snapshot exceeded the client size limit and was omitted.');
                    }
                } catch (error) {
                    console.warn('ESHEETS: answer snapshot capture failed', error);
                }
            })
            .catch(function (error) {
                console.warn('ESHEETS: snapshot preparation failed; submitting the score without snapshots.', error);
            })
            .then(function () {
                if (payload.student_snapshot_html) {
                    payload.snapshot_format_version = SNAPSHOT_FORMAT_VERSION;
                } else {
                    delete payload.answer_snapshot_html;
                    delete payload.snapshot_format_version;
                }

                var body = JSON.stringify(payload);
                if (new Blob([body]).size > CLIENT_REQUEST_LIMIT && payload.answer_snapshot_html) {
                    delete payload.answer_snapshot_html;
                    body = JSON.stringify(payload);
                }
                if (new Blob([body]).size > CLIENT_REQUEST_LIMIT && payload.student_snapshot_html) {
                    delete payload.student_snapshot_html;
                    delete payload.snapshot_format_version;
                    body = JSON.stringify(payload);
                    console.warn('ESHEETS: combined snapshot request exceeded the client size limit; submitting the score only.');
                }

                amended.body = body;
                return originalFetch(input, amended);
            });
    }

    var originalFetch = window.fetch && window.fetch.bind(window);
    if (originalFetch) {
        window.fetch = function (input, init) {
            if (!isPortalSubmissionRequest(input) || !init || typeof init.body !== 'string') {
                return originalFetch(input, init);
            }

            var payload;
            try {
                payload = JSON.parse(init.body);
            } catch (error) {
                return originalFetch(input, init);
            }

            if (!isTrackedPayload(payload)) return originalFetch(input, init);
            return sendWithSnapshots(originalFetch, input, init, payload);
        };
    }

    var originalMountTeacherPanel = window.ESHEETS.mountTeacherPanel;
    if (typeof originalMountTeacherPanel === 'function') {
        window.ESHEETS.mountTeacherPanel = function (config) {
            answerItemsProvider = config && typeof config.getAnswerItems === 'function'
                ? config.getAnswerItems
                : null;
            return originalMountTeacherPanel.apply(this, arguments);
        };
    }

    function trackedLaunchVisible() {
        if (document.querySelector('.es-student-warning')) return true;

        try {
            var params = new URLSearchParams(window.location.search);
            var classCode = params.get('class') || params.get('class_code') || params.get('classcode') || '';
            var taskCode = params.get('task') || params.get('task_code') || params.get('taskcode') || '';
            return TRACKING_CODE_REGEX.test(String(classCode).trim().toUpperCase()) &&
                TRACKING_CODE_REGEX.test(String(taskCode).trim().toUpperCase());
        } catch (error) {
            return false;
        }
    }

    function revealLockoutVisible() {
        return Array.prototype.slice.call(document.querySelectorAll('.es-lockout-message')).some(function (message) {
            return window.getComputedStyle(message).display !== 'none';
        });
    }

    var originalMountSubmissionBar = window.ESHEETS.mountSubmissionBar;
    if (typeof originalMountSubmissionBar === 'function') {
        window.ESHEETS.mountSubmissionBar = function () {
            var result = originalMountSubmissionBar.apply(this, arguments);
            if (!result || !result.recordBtn || !trackedLaunchVisible()) return result;

            var button = result.recordBtn;
            var originalUpdateState = result.updateState;

            result.updateState = function () {
                if (typeof originalUpdateState === 'function') originalUpdateState.apply(result, arguments);
                if (!revealLockoutVisible() && button.textContent !== 'Recording...') {
                    button.disabled = false;
                    if (button.textContent === 'Recorded!') button.textContent = 'Record my score';
                }
            };

            window.setTimeout(function () {
                if (!revealLockoutVisible() && button.textContent !== 'Recording...') button.disabled = false;
            }, 0);

            var labelObserver = new MutationObserver(function () {
                if (button.textContent === 'Recorded!' && !revealLockoutVisible()) {
                    window.setTimeout(function () {
                        button.textContent = 'Record my score';
                        button.disabled = false;
                    }, 0);
                }
            });
            labelObserver.observe(button, { childList: true, subtree: true, characterData: true });

            return result;
        };
    }
}());
