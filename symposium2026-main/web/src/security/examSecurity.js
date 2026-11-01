
export function startSecurity(onViolation, options = {}) {
  const {
    lockOnTabSwitch = true,
    lockOnFullscreenExit = false,
  } = options;

  let active = true;
  let lastViolation = "";
  let lastViolationAt = 0;

  function detect(type) {
    if (!active) return;

    const now = Date.now();

    // Prevent duplicate events within 1.5 seconds.
    if (type === lastViolation && now - lastViolationAt < 1500) {
      return;
    }

    lastViolation = type;
    lastViolationAt = now;
    onViolation?.(type);
  }

  function onVisibilityChange() {
    if (
      document.visibilityState === "hidden" &&
      lockOnTabSwitch
    ) {
      detect("TAB_SWITCH");
    }
  }

  function onFullscreenChange() {
    if (
      lockOnFullscreenExit &&
      !document.fullscreenElement
    ) {
      detect("FULLSCREEN_EXIT");
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("fullscreenchange", onFullscreenChange);

  return function stopSecurity() {
    active = false;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
  };
}

export const GUARD_SCRIPT = "";
