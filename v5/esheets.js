/* CANONICAL v5.1 — Explicit Submission Model — 2026-02-15 */

/**
 * ESHEETS v5.1 Framework Core
 *
 * Explicit submission model.
 *
 * Usage:
 *   ESHEETS.init({ worksheet_id: 'unique_id' });
 *   ESHEETS.setScore(score, maxScore); // Updates UI only
 *   ESHEETS.submit(score, maxScore);   // Saves to history
 *   ESHEETS.renderSubmissionSummary(container);
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'esheets:v1:progress';
    var meta = {};

    // --- Internal Helpers ---

    function getStorage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.warn('ESHEETS: localStorage access failed', e);
            return {};
        }
    }

    function setStorage(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('ESHEETS: localStorage write failed', e);
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
            // Historical fields (v5.0 compat)
            bestScore: 0,
            maxScore: 0,
            bestPercent: 0,
            // New v5.1 explicit fields
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

    function updatePlaceholders(text) {
        var selectors = [
            '[data-esheets-score="top"]',
            '[data-esheets-score="bottom"]'
        ];

        selectors.forEach(function (sel) {
            var els = document.querySelectorAll(sel);
            for (var i = 0; i < els.length; i++) {
                // Safety: prevent redundant mutations
                if (els[i].textContent !== text) {
                    els[i].textContent = text;
                }
                if (!els[i].classList.contains('esheets-scorebar')) {
                    els[i].classList.add('esheets-scorebar');
                }
            }
        }); // Fixed missing paren
    }

    // --- Public API ---

    window.ESHEETS = {
        init: function (options) {
            meta = options || {};
            if (!meta.worksheet_id) {
                console.warn('ESHEETS: init called without worksheet_id');
            }
        },

        // UI Update Only - No Storage
        setScore: function (score, maxScore) {
            if (typeof score !== 'number' || typeof maxScore !== 'number' || isNaN(score) || isNaN(maxScore)) {
                return;
            }
            var s = Math.max(0, score);
            var m = Math.max(1, maxScore);
            var pct = (s / m) * 100;
            var text = 'Score: ' + s + ' / ' + m + ' (' + Math.round(pct) + '%)';
            updatePlaceholders(text);
        },

        // Explicit Submission - Writes to Storage
        submit: function (score, maxScore) {
            if (!meta.worksheet_id) return;
            if (typeof score !== 'number' || typeof maxScore !== 'number' || isNaN(score) || isNaN(maxScore)) return;

            var s = Math.max(0, score);
            var m = Math.max(1, maxScore);
            var pct = (s / m) * 100;
            var now = new Date().toISOString();

            // Read current record to check bests
            var record = getRecord(meta.worksheet_id) || { bestPercent: 0, bestScore: 0 };

            var updates = {
                lastScore: s,
                lastPercent: pct,
                submittedAt: now,
                // Update maxScore to latest known
                maxScore: m
            };

            // Best Score Logic: Higher percent, then higher score
            var currentBestPercent = record.bestPercent || 0;
            var currentBestScore = record.bestScore || 0;

            if (pct > currentBestPercent || (Math.abs(pct - currentBestPercent) < 0.001 && s > currentBestScore)) {
                updates.bestPercent = pct;
                updates.bestScore = s;
            }

            saveRecord(meta.worksheet_id, updates);
        },

        renderSubmissionSummary: function (container) {
            if (!container || !meta.worksheet_id) return;

            var record = getRecord(meta.worksheet_id);
            if (!record || !record.submittedAt) {
                container.textContent = "No previous submissions.";
                return;
            }

            // Format helpers
            function fmt(s, m, p) {
                return s + ' / ' + m + ' (' + Math.round(p) + '%)';
            }

            var lastText = "Last submitted: " + fmt(record.lastScore, record.maxScore, record.lastPercent);
            var bestText = "Best score: " + fmt(record.bestScore, record.maxScore, record.bestPercent);

            container.innerHTML = '';
            var pLast = document.createElement('div');
            pLast.textContent = lastText;
            var pBest = document.createElement('div');
            pBest.textContent = bestText;
            pBest.style.fontWeight = 'bold'; // Emphasize best

            container.appendChild(pLast);
            container.appendChild(pBest);
        },

        // Optional helper access
        getProgress: function () {
            if (!meta.worksheet_id) return null;
            return getRecord(meta.worksheet_id);
        }
    };

})();