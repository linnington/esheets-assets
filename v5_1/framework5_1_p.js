/* ESHEETS v5.1p — cache-busting production wrapper.
 *
 * Loads the proven v5.1o framework synchronously, then adds:
 * - frozen student-response and worksheet-answer snapshots for tracked portal submissions;
 * - first-tap / always-available Record my score behaviour outside genuine reveal lockout.
 *
 * Direct worksheet use remains unchanged: snapshots are created only when valid portal
 * class and task codes are present in the outgoing submission payload.
 */
(function () {
    'use strict';

    var BASE_FRAMEWORK_URL = 'https://assets.esheets.io/v5_1/framework5_1_o.js';
    var PORTAL_SUBMISSION_URL = 'https://portal.esheets.io/api/submissions';
    var SNAPSHOT_FORMAT_VERSION = 1;
    var CLIENT_SNAPSHOT_LIMIT = 440 * 1024;
    var TRACKING_CODE_REGEX = /^[A-HJ-NP-Z2-9]{5}$/;

    function installProductionAdditions() {
        if (!window.ESHEETS || window.ESHEETS.__snapshotProductionInstalled) return;
        window.ESHEETS.__snapshotProductionInstalled = true;

        var answerItemsProvider = null;

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

        function getElementIndexMap(sourceRoot, cloneRoot) {
            var sourceElements = [sourceRoot].concat(Array.prototype.slice.call(sourceRoot.querySelectorAll('*')));
            var cloneElements = [cloneRoot].concat(Array.prototype.slice.call(cloneRoot.querySelectorAll('*')));
            var map = new Map();
            for (var i = 0; i < sourceElements.length && i < cloneElements.length; i++) {
                map.set(sourceElements[i], cloneElements[i]);
            }
            return map;
        }

        function getAnswerState(sourceRoot, cloneRoot) {
            var answerValues = new Map();
            var revealedControls = new Set();

            if (typeof answerItemsProvider !== 'function') {
                return { answerValues: answerValues, revealedControls: revealedControls };
            }

            var items;
            try {
                items = answerItemsProvider() || [];
            } catch (error) {
                throw new Error('The worksheet answer provider failed: ' + (error && error.message ? error.message : error));
            }

            if (!Array.isArray(items)) items = Array.prototype.slice.call(items || []);
            var elementMap = getElementIndexMap(sourceRoot, cloneRoot);

            items.forEach(function (item) {
                if (!item) return;

                if (item.inputEl && sourceRoot.contains(item.inputEl)) {
                    if (!item.inputEl.classList.contains('es-correct-locked')) {
                        answerValues.set(item.inputEl, item.answer == null ? '' : String(item.answer));
                        revealedControls.add(item.inputEl);
                    }
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
                var cloneControl = cloneControls[index];
                if (!cloneControl) return;
                buildStaticControl(sourceControl, cloneControl, doc, answerState);
            });
        }

        function replaceCanvases(sourceRoot, cloneRoot, doc) {
            var sourceCanvases = Array.prototype.slice.call(sourceRoot.querySelectorAll('canvas'));
            var cloneCanvases = Array.prototype.slice.call(cloneRoot.querySelectorAll('canvas'));
            var failures = [];

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
                    failures.push({
                        id: sourceCanvas.id || 'canvas-' + (index + 1),
                        message: error && error.message ? error.message : String(error)
                    });
                }
            });

            return failures;
        }

        function removeInteractiveUi(cloneRoot) {
            var selectors = [
                '#teacherPanel',
                '.esheets-teacher-panel',
                '#identityBar',
                '.esheets-identity-bar',
                '#submissionBar',
                '.esheets-submission-bar',
                '.es-lockout-message',
                '#es-teacher-signup-cta',
                '#es-topic-guide-jump',
                'script',
                'noscript',
                'button',
                '.es-btn',
                '[data-snapshot-exclude]'
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
                    if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
                    if (attribute.name === 'contenteditable') element.removeAttribute(attribute.name);
                });
            });
        }

        function collectStyleMarkup(sourceDocument) {
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

            return linkedStyles + '\n' + inlineStyles;
        }

        function createSnapshot(sourceDocument, kind) {
            var sourceRoot = sourceDocument.querySelector('.esheets-worksheet') || sourceDocument.body;
            if (!sourceRoot) throw new Error('No worksheet container was found.');

            var descriptor = kind === 'answers'
                ? {
                    kind: 'answers',
                    heading: 'Worksheet answer view',
                    titleSuffix: 'worksheet answers',
                    note: 'Captured from the worksheet’s own answer provider.'
                }
                : {
                    kind: 'student',
                    heading: 'Student response',
                    titleSuffix: 'student response',
                    note: 'Captured from the student’s marked worksheet state.'
                };

            var cloneRoot = sourceRoot.cloneNode(true);
            var answerState = kind === 'answers' ? getAnswerState(sourceRoot, cloneRoot) : null;
            copyLiveControls(sourceRoot, cloneRoot, sourceDocument, answerState);
            var canvasFailures = replaceCanvases(sourceRoot, cloneRoot, sourceDocument);
            removeInteractiveUi(cloneRoot);

            var title = sourceDocument.title || 'Worksheet snapshot';
            var sourceUrl = sourceDocument.location.href;
            var styleMarkup = collectStyleMarkup(sourceDocument);
            var capturedAt = new Date().toISOString();

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
                '<html lang="en" data-snapshot-kind="' + descriptor.kind + '">\n' +
                '<head>\n' +
                '<meta charset="utf-8">\n' +
                '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
                '<base href="' + escapeHtml(sourceUrl) + '">\n' +
                '<title>' + escapeHtml(title) + ' — ' + escapeHtml(descriptor.titleSuffix) + '</title>\n' +
                styleMarkup + '\n' +
                '<style>' + snapshotCss + '</style>\n' +
                '</head>\n' +
                '<body>\n' +
                '<div class="es-snapshot-meta">\n' +
                '<strong>' + escapeHtml(descriptor.heading) + '</strong><br>\n' +
                escapeHtml(descriptor.note) + '<br>\n' +
                'Captured: ' + escapeHtml(capturedAt) + '\n' +
                '</div>\n' +
                cloneRoot.outerHTML + '\n' +
                '</body>\n' +
                '</html>';

            return {
                kind: descriptor.kind,
                html: html,
                byteLength: new Blob([html]).size,
                canvasFailures: canvasFailures
            };
        }

        function createSubmissionSnapshots() {
            var result = {
                student: null,
                answers: null
            };

            try {
                result.student = createSnapshot(document, 'student');
            } catch (error) {
                console.warn('ESHEETS: student snapshot capture failed', error);
            }

            try {
                if (typeof answerItemsProvider === 'function') {
                    result.answers = createSnapshot(document, 'answers');
                }
            } catch (error) {
                console.warn('ESHEETS: answer snapshot capture failed', error);
            }

            return result;
        }

        function isTrackedPortalPayload(payload) {
            return payload &&
                TRACKING_CODE_REGEX.test(String(payload.class_code || '').trim().toUpperCase()) &&
                TRACKING_CODE_REGEX.test(String(payload.task_code || '').trim().toUpperCase());
        }

        function isPortalSubmissionRequest(input) {
            var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
            return String(url || '').replace(/\/+$/, '') === PORTAL_SUBMISSION_URL;
        }

        function addSnapshotsToRequest(input, init) {
            if (!isPortalSubmissionRequest(input) || !init || typeof init.body !== 'string') {
                return init;
            }

            var payload;
            try {
                payload = JSON.parse(init.body);
            } catch (error) {
                return init;
            }

            if (!isTrackedPortalPayload(payload)) return init;

            var snapshots = createSubmissionSnapshots();
            var hasSnapshot = false;

            if (snapshots.student && snapshots.student.byteLength <= CLIENT_SNAPSHOT_LIMIT) {
                payload.student_snapshot_html = snapshots.student.html;
                hasSnapshot = true;
            } else if (snapshots.student) {
                console.warn('ESHEETS: student snapshot exceeded the client size limit and was omitted.');
            }

            if (snapshots.answers && snapshots.answers.byteLength <= CLIENT_SNAPSHOT_LIMIT) {
                payload.answer_snapshot_html = snapshots.answers.html;
                hasSnapshot = true;
            } else if (snapshots.answers) {
                console.warn('ESHEETS: answer snapshot exceeded the client size limit and was omitted.');
            }

            if (hasSnapshot) payload.snapshot_format_version = SNAPSHOT_FORMAT_VERSION;

            var amended = {};
            Object.keys(init).forEach(function (key) { amended[key] = init[key]; });
            amended.body = JSON.stringify(payload);
            return amended;
        }

        var originalFetch = window.fetch && window.fetch.bind(window);
        if (originalFetch) {
            window.fetch = function (input, init) {
                var amendedInit = init;
                try {
                    amendedInit = addSnapshotsToRequest(input, init);
                } catch (error) {
                    console.warn('ESHEETS: snapshot preparation failed; submitting the score without snapshots.', error);
                }
                return originalFetch(input, amendedInit);
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

        function isRevealLockoutVisible() {
            return Array.prototype.slice.call(document.querySelectorAll('.es-lockout-message')).some(function (message) {
                return window.getComputedStyle(message).display !== 'none';
            });
        }

        function applyRecordButtonPolicy(button) {
            if (!button) return;
            var label = (button.textContent || '').trim();

            if (isRevealLockoutVisible()) {
                button.disabled = true;
                return;
            }

            if (label === 'Recording...') {
                button.disabled = true;
                return;
            }

            if (label !== 'Record my score') button.textContent = 'Record my score';
            button.disabled = false;
        }

        var originalMountSubmissionBar = window.ESHEETS.mountSubmissionBar;
        if (typeof originalMountSubmissionBar === 'function') {
            window.ESHEETS.mountSubmissionBar = function () {
                var result = originalMountSubmissionBar.apply(this, arguments);
                if (!result || !result.recordBtn) return result;

                var button = result.recordBtn;
                var originalUpdateState = result.updateState;

                result.updateState = function () {
                    if (typeof originalUpdateState === 'function') {
                        originalUpdateState.apply(result, arguments);
                    }
                    applyRecordButtonPolicy(button);
                };

                var observer = new MutationObserver(function () {
                    applyRecordButtonPolicy(button);
                });
                observer.observe(button, {
                    attributes: true,
                    childList: true,
                    subtree: true,
                    characterData: true,
                    attributeFilter: ['disabled', 'style']
                });

                Array.prototype.slice.call(document.querySelectorAll('.es-lockout-message')).forEach(function (message) {
                    observer.observe(message, {
                        attributes: true,
                        childList: true,
                        subtree: true,
                        attributeFilter: ['style', 'class']
                    });
                });

                applyRecordButtonPolicy(button);
                return result;
            };
        }
    }

    if (window.ESHEETS && typeof window.ESHEETS.mountSubmissionBar === 'function') {
        installProductionAdditions();
        return;
    }

    if (document.readyState === 'loading') {
        document.write('<script src="' + BASE_FRAMEWORK_URL + '"><\/script>');
        installProductionAdditions();
        return;
    }

    var baseScript = document.createElement('script');
    baseScript.src = BASE_FRAMEWORK_URL;
    baseScript.onload = installProductionAdditions;
    baseScript.onerror = function () {
        console.error('ESHEETS: could not load the v5.1o base framework.');
    };
    (document.head || document.documentElement).appendChild(baseScript);
}());
