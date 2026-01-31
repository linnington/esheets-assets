/* esheets.js (suggested v1.1)
   Global helpers for esheets.io worksheets.
   Safe: does nothing if there is no .esheets container.
   No popups; uses in-page UI only.
*/
(() => {
  "use strict";

  const ESHEETS = (window.ESHEETS = window.ESHEETS || {});
  const ROOT = document.documentElement;
  const TEACHER_CLASS = "esheets-teacher";
  const PRINTING_CLASS = "esheets-printing";
  const LS_TEACHER_KEY = "esheets.teacher";

  // ---------- utils ----------
  const isTypingTarget = (t) =>
    !!t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.isContentEditable);

  const qsParam = (name) => {
    try {
      return new URL(window.location.href).searchParams.get(name);
    } catch {
      return null;
    }
  };

  const addRootClass = (cls, on) => ROOT.classList.toggle(cls, !!on);

  // ---------- teacher mode ----------
  const isTeacherFromUrl = () => {
    const v = qsParam("teacher");
    return v === "1" || v === "true" || v === "yes";
  };

  const loadTeacherPref = () => {
    try {
      return localStorage.getItem(LS_TEACHER_KEY) === "1";
    } catch {
      return false;
    }
  };

  const saveTeacherPref = (on) => {
    try {
      localStorage.setItem(LS_TEACHER_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  ESHEETS.isTeacher = () => ROOT.classList.contains(TEACHER_CLASS);

  ESHEETS.setTeacherMode = (on, { persist = true } = {}) => {
    addRootClass(TEACHER_CLASS, on);
    if (persist) saveTeacherPref(on);

    // Auto-reveal answers when turning ON; auto-hide when turning OFF
    ESHEETS.setAllAnswersVisible(on);

    document.dispatchEvent(new CustomEvent("esheets:teacher", { detail: { on: !!on } }));
  };

  ESHEETS.toggleTeacherMode = () => ESHEETS.setTeacherMode(!ESHEETS.isTeacher());

  // ---------- answers ----------
  ESHEETS.setAllAnswersVisible = (visible, container = document) => {
    container.querySelectorAll(".esheets .es-answer").forEach((el) => {
      el.classList.toggle("is-revealed", !!visible);
    });
    document.dispatchEvent(
      new CustomEvent("esheets:answers", { detail: { visible: !!visible } })
    );
  };

  // ---------- score ----------
  ESHEETS.setScore = (correct, total, container = document) => {
    const c = Number(correct);
    const t = Number(total);

    container.querySelectorAll('[data-esheets-score="correct"]').forEach((el) => {
      el.textContent = Number.isFinite(c) ? String(c) : "";
    });
    container.querySelectorAll('[data-esheets-score="total"]').forEach((el) => {
      el.textContent = Number.isFinite(t) ? String(t) : "";
    });

    document.dispatchEvent(new CustomEvent("esheets:score", { detail: { correct: c, total: t } }));
  };

  // ---------- two-click reset ----------
  // Use: <button data-esheets-reset>Reset</button>
  // Listen for: "esheets:reset" bubbling from the button
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
        if (!armed) {
          // Arm on first click
          e.preventDefault();
          e.stopPropagation();
          armed = true;
          btn.classList.add("is-armed");
          btn.textContent = armedText;
          timer = window.setTimeout(disarm, timeout);
          return;
        }

        // Confirm on second click
        disarm();
        btn.dispatchEvent(new CustomEvent("esheets:reset", { bubbles: true }));
      });

      // Click away disarms
      document.addEventListener("click", (evt) => {
        if (!armed) return;
        if (evt.target === btn || btn.contains(evt.target)) return;
        disarm();
      });
    });
  }

  // ---------- teacher panel wiring (optional) ----------
  // Use:
  //  <section class="es-teacher-panel" data-esheets-teacher hidden>...</section>
  // Reveal/hide buttons (optional):
  //  data-esheets-reveal / data-esheets-hide
  function initTeacherPanel() {
    document.querySelectorAll("[data-esheets-teacher]").forEach((panel) => {
      const sync = () => {
        panel.hidden = !ESHEETS.isTeacher();
      };
      sync();
      document.addEventListener("esheets:teacher", sync);
    });

    document.querySelectorAll("[data-esheets-reveal]").forEach((btn) => {
      btn.addEventListener("click", () => ESHEETS.setAllAnswersVisible(true));
    });
    document.querySelectorAll("[data-esheets-hide]").forEach((btn) => {
      btn.addEventListener("click", () => ESHEETS.setAllAnswersVisible(false));
    });
  }

  // ---------- print hooks ----------
  function initPrintHooks() {
    window.addEventListener("beforeprint", () => addRootClass(PRINTING_CLASS, true));
    window.addEventListener("afterprint", () => addRootClass(PRINTING_CLASS, false));
  }

  // ---------- init ----------
  function initTeacherMode() {
    const urlOn = isTeacherFromUrl();
    const storedOn = loadTeacherPref();
    const hasTeacherParam = qsParam("teacher") !== null;

    // URL wins if present; otherwise stored preference.
    const shouldOn = urlOn || (!hasTeacherParam && storedOn);
    ESHEETS.setTeacherMode(shouldOn, { persist: true });
  }

  function initHotkeys() {
    document.addEventListener("keydown", (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey && e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        ESHEETS.toggleTeacherMode();
      }
    });
  }

  function init() {
    if (!document.querySelector(".esheets")) return;

    initTeacherMode();
    initHotkeys();
    initTeacherPanel();
    initTwoClickReset();
    initPrintHooks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
