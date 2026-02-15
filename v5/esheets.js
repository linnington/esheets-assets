/* CANONICAL v5 — 2026-02-15 — Synced core logic with auto-detection */

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
                // Safety: prevent redundant mutations
                if (els[i].textContent !== text) {
                    els[i].textContent = text;
                }
                if (!els[i].classList.contains('esheets-scorebar')) {
                    els[i].classList.add('esheets-scorebar');
                }
            }
        });
    }

    function isVisible(el) {
        if (!el) return false;
        var r = el.getBoundingClientRect();
        if (!r || r.width === 0 || r.height === 0) return false;
        var style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    function parseScoreText(txt) {
        if (!txt) return null;
        var match = txt.match(/(\d+)\s*\/\s*(\d+)/);
        if (!match) return null;

        var val = parseInt(match[1], 10);
        var max = parseInt(match[2], 10);
        if (!isFinite(val) || !isFinite(max) || max <= 0) return null;

        // guard against random “1/2” fractions in instructions
        if (max > 500) return null;

        return { score: val, max: max };
    }

    function findScoreElement() {
        // Quick wins
        var selectors = [
            '.score',
            '#score',
            '.scoreBox',
            '.score-box',
            '.score-container',
            '[data-score]',
            '[data-esheets-legacy-score]'
        ];

        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el && isVisible(el)) {
                // Only return if it parses nicely
                if (parseScoreText(el.textContent)) return el;
            }
        }

        // Heuristic search
        var candidates = [];
        var root = document.body || document.documentElement;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

        while (walker.nextNode()) {
            var node = walker.currentNode;
            if (!isVisible(node)) continue;

            var txt = (node.textContent || '').trim();
            if (txt.length < 3 || txt.length > 80) continue;

            var lower = txt.toLowerCase();
            if (lower.indexOf('score') === -1) continue; // Must contain "score"

            var parsed = parseScoreText(txt);
            if (!parsed) continue;

            // Penalise noisy containers
            var penalty = node.querySelectorAll('input,button,select,textarea').length > 0 ? 10 : 0;
            candidates.push({ el: node, penalty: penalty, len: txt.length });
        }

        if (!candidates.length) return null;

        candidates.sort(function (a, b) {
            if (a.penalty !== b.penalty) return a.penalty - b.penalty;
            return a.len - b.len;
        });

        return candidates[0].el;
    }

    // Internal implementation of setScore logic (decoupled from UI binding loops if possible)
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

            var currentBestPercent = record.bestPercent || 0;
            var currentBestScore = record.bestScore || 0;

            // Update bests if improved
            if (pct > currentBestPercent || (Math.abs(pct - currentBestPercent) < 0.001 && s > currentBestScore)) {
                updates.bestPercent = pct;
                updates.bestScore = s;
                updates.maxScore = m;
            }

            // completedAt logic
            if (Math.abs(pct - 100) < 0.001 && !record.completedAt) {
                updates.completedAt = new Date().toISOString();
            }

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

            // Auto-detect legacy score display
            window.setTimeout(function () {
                if (window.ESHEETS && window.ESHEETS.autoAttachScoreObserver) {
                    window.ESHEETS.autoAttachScoreObserver();
                }
            }, 0);

            if (!meta.worksheet_id) {
                console.warn('ESHEETS: init called without worksheet_id');
            }
        },

        setScore: setScoreImpl,

        findScoreElement: function () {
            return findScoreElement();
        },

        autoAttachScoreObserver: function () {
            var el = findScoreElement();
            if (!el) return null;
            window.ESHEETS.attachScoreObserver(el);
            return el;
        },

        newAttempt: function () {
            if (!meta.worksheet_id) return;

            var record = getRecord(meta.worksheet_id) || {};
            var newCount = (record.attempts || 0) + 1;

            saveRecord(meta.worksheet_id, {
                attempts: newCount,
                lastAttemptAt: new Date().toISOString(),
                completedAt: null
            });

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
                var p = parseScoreText(txt);
                if (p) {
                    setScoreImpl(p.score, p.max);
                }
            }

            parse();
            var obs = new MutationObserver(parse);
            obs.observe(element, { childList: true, characterData: true, subtree: true });
        }

        // getProgress intentionally private or not exposed unless needed? 
        // Requirement said: "Add helper ESHEETS.getProgress(worksheet_id) to return stored record (optional)"
        // The previous version had it. I will restore it to be safe.
        , getProgress: function (id) {
            return getRecord(id);
        }
    };

})();