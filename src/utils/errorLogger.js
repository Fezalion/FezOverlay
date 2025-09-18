// src/utils/errorLogger.js
// Global error logger for browser apps with server reporting

const errorLog = [];

export function logError(error, info) {
  const entry = {
    time: new Date().toISOString(),
    error: error?.stack || error?.toString() || String(error),
    info: info || null,
  };
  errorLog.push(entry);
  // Optionally, print to console
  console.error("[Logged Error]", entry);
  // Send to server if available
  try {
    fetch("/api/log-client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: entry.error,
        info: entry.info,
        userAgent: navigator.userAgent,
      }),
    });
  } catch (e) {}
}

export function getErrorLog() {
  return errorLog;
}

export function downloadErrorLog() {
  if (errorLog.length === 0) return;
  const blob = new Blob(
    [
      errorLog
        .map(
          (e) => `[${e.time}] ${e.error}${e.info ? `\nInfo: ${e.info}` : ""}`
        )
        .join("\n\n"),
    ],
    { type: "text/plain" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fezoverlay-error-log-${Date.now()}.log`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Attach global listeners (call once at app startup)
export function setupGlobalErrorLogger() {
  window.onerror = (msg, src, line, col, err) => {
    logError(err || msg, `at ${src}:${line}:${col}`);
  };
  window.onunhandledrejection = (event) => {
    logError(event.reason, "Unhandled Promise rejection");
  };
  window.onbeforeunload = () => {
    if (errorLog.length > 0) downloadErrorLog();
  };
}
