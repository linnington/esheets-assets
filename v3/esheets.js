/* esheets.js (v1.2 draft)
   Global helpers for esheets.io worksheets.
   - Teacher mode ONLY via ?teacher=1 OR Ctrl+Alt+R (no localStorage persistence)
   - No popups; in-page UI only.
*/
(() => {
  "use strict";

  const ESHEETS = (window.ESHEETS = window.ESHEETS || {});
  const ROOT = document.documentElement;
  const TEACHER_CLASS = "esheets-teacher";

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

  const isTeacherFromUrl = () => {
    const v = qsParam("teacher");
    return v === "1" || v === "true" || v === "yes";
  };

  ESHEETS.isTeacher = () => ROOT.classList.contains(TEACHER_CLASS);

  ESHEETS.setTeacherMode = (on) => {
    addRootClass(TEACHER_CLASS, on);
    ESHEETS.setAllAnswersVisible(on);
    document.dispatchEvent(new CustomEvent("esheets:teacher", { detail: { on: !!on } }));
  };

  ESHEETS.toggleTeacherMode = () => ESHEETS.setTeacherMode(!ESHEETS.isTeacher());

  ESHEETS.setAllAnswersVisible = (visible, container = document) => {
    container.querySelectorAll(".esheets .es-answer").forEach((el) => {
      el.classList.toggle("is-revealed", !!visible);
    });
    document.dispatchEvent(
      new CustomEvent("esheets:answers", { detail: { visible: !!visible } })
    );
  };

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

  function initTwoClickReset() {
    const buttons = document.querySelectorAll("[data-esheets-reset]");
    buttons.forEach((btn) => {
      let armed = false;
      let timer = null;

      const timeout = Number(btn.getAttribute("data-reset-timeout")) || 4000;
      const armedText = btn.getAttribute("data-reset-armed-text") || "Click again to confirm";
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
          e.preventDefault();
          e.stopPropagation();
          armed = true;
          btn.classList.add("is-armed");
          btn.textContent = armedText;
          timer = window.setTimeout(disarm, timeout);
          return;
        }

        disarm();
        btn.dispatchEvent(new CustomEvent("esheets:reset", { bubbles: true }));
      });

      document.addEventListener("click", (evt) => {
        if (!armed) return;
        if (evt.target === btn || btn.contains(evt.target)) return;
        disarm();
      });
    });
  }

  function initTeacherPanel() {
    document.querySelectorAll("[data-esheets-teacher]").forEach((panel) => {
      const sync = () => { panel.hidden = !ESHEETS.isTeacher(); };
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

  function initHotkeys() {
    document.addEventListener("keydown", (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey && e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        ESHEETS.toggleTeacherMode();
      }
    });
  }

  function initTeacherMode() {
    ESHEETS.setTeacherMode(isTeacherFromUrl());
  }

  function init() {
    if (!document.querySelector(".esheets")) return;
    initTeacherMode();
    initHotkeys();
    initTeacherPanel();
    initTwoClickReset();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
