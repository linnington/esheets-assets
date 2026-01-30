/* esheets.js v1
   Global helpers for esheets.io worksheets.
   Safe to load on any page (does nothing if no .esheets present).
*/
(() => {
  "use strict";

  const ESHEETS = (window.ESHEETS = window.ESHEETS || {});
  const TEACHER_CLASS = "esheets-teacher";
  const PRINTING_CLASS = "esheets-printing";
  const LS_TEACHER_KEY = "esheets.teacher";

  // ---------- utilities ----------
  function qsParam(name) {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get(name);
    } catch {
      return null;
    }
  }

  function setClassOnRoot(className, on) {
    const root = document.documentElement;
    root.classList.toggle(className, !!on);
  }

  function isTeacherFromUrl() {
    const v = qsParam("teacher");
    return v === "1" || v === "true" || v === "yes";
  }

  function loadTeacherPref() {
    try {
      return localStorage.getItem(LS_TEACHER_KEY) === "1";
    } catch {
      return false;
    }
  }

  function saveTeacherPref(on) {
    try {
      localStorage.setItem(LS_TEACHER_KEY, on ? "1" : "0");
    } catch {
      // ignore
    }
  }

  // ---------- teacher mode ----------
  ESHEETS.isTeacher = () => document.documentElement.classList.contains(TEACHER_CLASS);

  ESHEETS.setTeacherMode = (on, { persist = true } = {}) => {
    setClassOnRoot(TEACHER_CLASS, on);
    if (persist) saveTeacherPref(on);
    // Notify any worksheet scripts listening
    document.dispatchEvent(new CustomEvent("esheets:teacher", { detail: { on: !!on } }));
  };

  ESHEETS.toggleTeacherMode = () => ESHEETS.setTeacherMode(!ESHEETS.isTeacher());

  function initTeacherMode() {
    const urlOn = isTeacherFromUrl();
    const storedOn = loadTeacherPref();
    // URL wins if present; otherwise stored preference.
    const shouldOn = urlOn || (!qsParam("teacher") && storedOn);
    ESHEETS.setTeacherMode(shouldOn, { persist: true });
  }

  // keyboard toggle: Ctrl+Alt+R
  function initTeacherHotkey() {
    document.addEventListener("keydown", (e) => {
      // Avoid triggering while typing in inputs/textareas/contenteditable
      const t = e.target;
      const typing =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);

      if (typing) return;

      if (e.ctrlKey && e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        ESHEETS.toggleTeacherMode();
      }
    });
  }

  // ---------- two-click reset ----------
  // Any element with data-esheets-reset becomes a two-click confirm button.
  // Optional attributes:
  //   data-reset-timeout="4000"
  //   data-reset-armed-text="Click again to reset"
  function initTwoClickReset() {
    const buttons = document.querySelectorAll("[data-esheets-reset]");
    buttons.forEach((btn) => {
      let armed = false;
      let timer = null;

      const timeout = Number(btn.getAttribute("data-reset-timeout")) || 4000;
      const armedText = btn.getAttribute("data-reset-armed-text") || "Click again to reset";
      const originalText = btn.getAttribute("data-reset-original-text") || btn.textContent;

      function disarm() {
        armed = false;
        btn.classList.remove("is-armed");
        btn.textContent = originalText;
        if (timer) window.clearTimeout(timer);
        timer = null;
      }

      btn.addEventListener("click", (e) => {
        // If something else wants to handle reset, we let it — but we control confirmation.
        if (!armed) {
          e.preventDefault();
          e.stopPropagation();

          armed = true;
          btn.classList.add("is-armed");
          btn.textContent = armedText;

          timer = window.setTimeout(disarm, timeout);
          return;
        }

        // Confirmed second click: disarm then fire a custom event
        disarm();
        btn.dispatchEvent(new CustomEvent("esheets:reset", { bubbles: true }));
      });

      // If user clicks elsewhere, disarm
      document.addEventListener("click", (evt) => {
        if (!armed) return;
        if (evt.target === btn || btn.contains(evt.target)) return;
        disarm();
      });
    });
  }

  // ---------- score API ----------
  // Convention: any element with data-esheets-score="correct" / "total" gets updated.
  ESHEETS.setScore = (correct, total) => {
    const c = Number(correct);
    const t = Number(total);

    document.querySelectorAll('[data-esheets-score="correct"]').forEach((el) => {
      el.textContent = Number.isFinite(c) ? String(c) : "";
    });
    document.querySelectorAll('[data-esheets-score="total"]').forEach((el) => {
      el.textContent = Number.isFinite(t) ? String(t) : "";
    });

    document.dispatchEvent(new CustomEvent("esheets:score", { detail: { correct: c, total: t } }));
  };

  // ---------- print helpers ----------
  function initPrintHooks() {
    window.addEventListener("beforeprint", () => setClassOnRoot(PRINTING_CLASS, true));
    window.addEventListener("afterprint", () => setClassOnRoot(PRINTING_CLASS, false));
  }

  // ---------- init ----------
  function init() {
    // Do nothing if no worksheets exist
    if (!document.querySelector(".esheets")) return;

    initTeacherMode();
    initTeacherHotkey();
    initTwoClickReset();
    initPrintHooks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

