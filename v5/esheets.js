/**
 * ESHEETS v5 Framework Core
 *
 * Minimal, readable, and robust.
 *
 * Usage:
 *   ESHEETS.init({ worksheet_id: 'unique_id' });
 *   ESHEETS.setScore(score, maxScore);
 *   ESHEETS.newAttempt();
 *   ESHEETS.attachScoreObserver(element);
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
            bestScore: 0,
            maxScore: 0,
            bestPercent: 0,
            attempts: 0,
            lastAttemptAt: null,
            completedAt: null
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
                els[i].textContent = text;
                if (!els[i].classList.contains('esheets-scorebar')) {
                    els[i].classList.add('esheets-scorebar');
                }
            }
        }); // Fixed missing paren
    }

    // Internal implementation of setScore to be used by observer
    function setScoreImpl(score, maxScore) {
        if (typeof score !== 'number' || typeof maxScore !== 'number' || isNaN(score) || isNaN(maxScore)) {
            console.warn('ESHEETS: setScore received invalid numbers', score, maxScore);
            return;
        }

        var s = Math.max(0, score);
        var m = Math.max(1, maxScore);
        var pct = (s / m) * 100;

        // Update DOM
        var text = 'Score: ' + s + ' / ' + m + ' (' + Math.round(pct) + '%)';
        updatePlaceholders(text);

        // Save Progress
        if (meta.worksheet_id) {
            var record = getRecord(meta.worksheet_id) || { bestPercent: 0, bestScore: 0 };
            var updates = {};

            // Update bests if improved (higher percent, or same percent with higher score)
            var currentBestPercent = record.bestPercent || 0;
            var currentBestScore = record.bestScore || 0;

            if (pct > currentBestPercent || (Math.abs(pct - currentBestPercent) < 0.001 && s > currentBestScore)) {
                updates.bestPercent = pct;
                updates.bestScore = s;
                updates.maxScore = m;
            }

            // completedAt logic
            if (Math.abs(pct - 100) < 0.001 && !record.completedAt) {
                updates.completedAt = new Date().toISOString();
            }

            // Ensure attempts initialized
            if (!record.attempts) {
                updates.attempts = 1;
                updates.lastAttemptAt = new Date().toISOString();
            }

            saveRecord(meta.worksheet_id, updates);
        }
    }

    // --- Public API ---

    window.ESHEETS = {
        init: function (options) {
            meta = options || {};
            if (!meta.worksheet_id) console.warn('ESHEETS: init called without worksheet_id');

            // Load progress - could restore UI state here if needed, 
            // but strictly we wait for setScore or show "0 / Y" if we knew Y.
        },

        setScore: setScoreImpl,

        newAttempt: function () {
            if (!meta.worksheet_id) return;

            var record = getRecord(meta.worksheet_id) || {};
            var newCount = (record.attempts || 0) + 1;

            // Clear completedAt for *current attempt* means we assume they are starting fresh.
            // Requirement: "clears completedAt for the *current attempt* (set it back to null)"

            saveRecord(meta.worksheet_id, {
                attempts: newCount,
                lastAttemptAt: new Date().toISOString(),
                completedAt: null
            });

            // Show warning
            var banners = document.querySelectorAll('[data-esheets-warning]');
            for (var i = 0; i < banners.length; i++) {
                banners[i].textContent = "New questions generated — previous answers cleared.";
                banners[i].style.display = 'block';
                if (!banners[i].classList.contains('esheets-warning')) {
                    banners[i].classList.add('esheets-warning');
                }
            }
        },

        attachScoreObserver: function (element) {
            if (!element) return;

            function parse() {
                var txt = element.textContent || '';
                var match = txt.match(/(\d+)\s*\/\s*(\d+)/);
                if (match) {
                    var val = parseInt(match[1], 10);
                    var max = parseInt(match[2], 10);
                    setScoreImpl(val, max);
                }
            }

            parse();
            var obs = new MutationObserver(parse);
            obs.observe(element, { childList: true, characterData: true, subtree: true });
        },

        getProgress: function (id) {
            return getRecord(id);
        }
    };

})();
