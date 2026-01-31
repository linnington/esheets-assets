
(() => {
  "use strict";

  const ESHEETS = (window.ESHEETS = window.ESHEETS || {});
  const ROOT = document.documentElement;
  const TEACHER_CLASS = "esheets-teacher";

  // Internal state
  let answersVisible = false;

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

  // ---------- answers ----------
  ESHEETS.setAllAnswersVisible = (visible, container = document) => {
    answersVisible = !!visible;
    container.querySelectorAll(".esheets .es-answer").forEach((el) => {
      el.classList.toggle("is-revealed", answersVisible);
    });
    syncAnswerToggleButtons();
    document.dispatchEvent(
      new CustomEvent("esheets:answers", { detail: { visible: answersVisible } })
    );
  };

  ESHEETS.toggleAnswers = () => {
    ESHEETS.setAllAnswersVisible(!answersVisible);
  };

  // ---------- teacher mode ----------
  ESHEETS.setTeacherMode = (on) => {
    addRootClass(TEACHER_CLASS, on);

    // If teacher mode turns off, hide answers and reset toggle UI
    if (!on) ESHEETS.setAllAnswersVisible(false);

    document.dispatchEvent(new CustomEvent("esheets:teacher", { detail: { on: !!on } }));
  };

  ESHEETS.toggleTeacherMode = () => ESHEETS.setTeacherMode(!ESHEETS.isTeacher());

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

  // ---------- two-click regenerate/reset ----------
  function initTwoClickReset() {
    const buttons = document.querySelectorAll("[data-esheets-reset]");
    buttons.forEach((btn) => {
      let armed = false;
      let timer = null;

      const timeout = Number(btn.getAttribute("data-reset-timeout")) || 4500;

      const originalText =
        btn.getAttribute("data-reset-original-text") ||
        btn.textContent ||
        "Generate new questions";

      const armedText =
        btn.getAttribute("data-reset-armed-text") ||
        "Are you sure? This will reset your score. Click again to reset.";

      // Ensure we store the original text
      btn.textContent = originalText;

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

  // ---------- teacher panel wiring ----------
  function initTeacherPanel() {
    document.querySelectorAll("[data-esheets-teacher]").forEach((panel) => {
      const sync = () => { panel.hidden = !ESHEETS.isTeacher(); };
      sync();
      document.addEventListener("esheets:teacher", sync);
    });

    document.querySelectorAll("[data-esheets-toggle-answers]").forEach((btn) => {
      btn.addEventListener("click", () => ESHEETS.toggleAnswers());
    });

    syncAnswerToggleButtons();
  }

  function syncAnswerToggleButtons() {
    document.querySelectorAll("[data-esheets-toggle-answers]").forEach((btn) => {
      const showText = btn.getAttribute("data-show-text") || "Reveal answers";
      const hideText = btn.getAttribute("data-hide-text") || "Hide answers";
      btn.textContent = answersVisible ? hideText : showText;
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
