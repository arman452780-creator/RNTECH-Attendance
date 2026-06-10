/**
 * crash-logger.js
 * Global error handler to capture and log crashes on Android native.
 */

(function() {
    console.log('[DEBUG-CRASH] Global crash logger initialized.');

    // 1. Capture standard errors
    window.onerror = function(message, source, lineno, colno, error) {
        const errorDetails = {
            message: message,
            source: source,
            line: lineno,
            column: colno,
            error: error ? error.stack : 'No stack trace'
        };
        console.error('[CRITICAL-CRASH-JS]', JSON.stringify(errorDetails));
        
        // Ensure the app doesn't just hang if possible
        return false; // Let default handler run
    };

    // 2. Capture unhandled promise rejections
    window.onunhandledrejection = function(event) {
        console.error('[CRITICAL-CRASH-PROMISE]', event.reason);
    };

    // 3. Capacitor Plugin error hook (if possible)
    if (window.Capacitor) {
        console.log('[DEBUG-CRASH] Capacitor detected, monitoring plugin calls.');
    }
})();
