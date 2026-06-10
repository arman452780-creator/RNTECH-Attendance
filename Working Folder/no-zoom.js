// no-zoom.js - Complete Android Zoom Prevention for RN-TECH
// Blocks pinch zoom, double-tap zoom, and all gesture scaling.
// Keeps normal scrolling fully intact.
(function () {
    'use strict';

    // ─── 1. VIEWPORT: Enforce no-scale at runtime ────────────────────────────
    // Some Android browsers ignore the HTML meta tag — enforce via JS too.
    var viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content',
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
    }

    // ─── 2. PINCH ZOOM: Block multi-touch scale gestures ────────────────────
    // Intercept touchmove events with 2+ fingers and cancel scaling.
    document.addEventListener('touchmove', function (e) {
        if (e.touches && e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    // ─── 3. DOUBLE-TAP ZOOM: Track and block rapid consecutive taps ──────────
    var lastTapTime = 0;
    var doubleTapDelay = 300; // ms threshold for double-tap detection

    document.addEventListener('touchend', function (e) {
        var now = Date.now();
        var timeSinceLast = now - lastTapTime;

        if (timeSinceLast < doubleTapDelay && timeSinceLast > 0) {
            // This is a double-tap — prevent the browser's zoom behavior
            e.preventDefault();
        }
        lastTapTime = now;
    }, { passive: false });

    // ─── 4. GESTURE EVENTS: Safari/iOS WebView specific ─────────────────────
    // gesturestart / gesturechange fire on pinch in WebKit-based WebViews
    document.addEventListener('gesturestart', function (e) {
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturechange', function (e) {
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('gestureend', function (e) {
        e.preventDefault();
    }, { passive: false });

    // ─── 5. WHEEL ZOOM (Ctrl+Scroll on desktop / Android Chrome trackpad) ───
    document.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
        }
    }, { passive: false });

    // ─── 6. KEYBOARD ZOOM (Ctrl +/- on desktop) ──────────────────────────────
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=')) {
            e.preventDefault();
        }
    });

    // ─── 7. CSS: Reinforce no touch-action scaling ───────────────────────────
    // Inject a style tag to lock touch-action to prevent browser-handled zoom
    var style = document.createElement('style');
    style.textContent = [
        '*, *::before, *::after {',
        '  touch-action: pan-x pan-y;', // Allow scroll, deny pinch-zoom
        '}',
        /* Inputs/textareas need special handling — allow their own touch */
        'input, textarea, select, button {',
        '  touch-action: manipulation;', // manipulation = tap + scroll, no zoom
        '}',
        /* Scrollable containers keep scroll working */
        '.ts-content, .dashboard-content, .timetable-content,',
        '.student-attendance-body, .history-container,',
        '[class*="-content"], [class*="-scroll"] {',
        '  touch-action: pan-y;',        // Vertical scroll only, no zoom
        '  -webkit-overflow-scrolling: touch;',
        '}',
        /* Horizontal scrollable containers keep scroll working */
        '.classes-scroll-row, .filter-panel, .tab-row, .horizontal-scroll, .class-tabs, [class*="-scroll-row"] {',
        '  touch-action: pan-x pan-y !important;',        // Allow both horizontal and vertical scrolling, no zoom
        '  -webkit-overflow-scrolling: touch;',
        '  transform: translate3d(0,0,0) !important;',     // Force GPU layer promotion
        '  -webkit-transform: translate3d(0,0,0) !important;',
        '  will-change: transform !important;',
        '}',
        /* Promote children of horizontal scroll rows to GPU to prevent repaint jank */
        '.classes-scroll-row *, .classes-row *, [class*="-scroll-row"] * {',
        '  backface-visibility: hidden !important;',
        '  -webkit-backface-visibility: hidden !important;',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // ─── 8. CAPACITOR / ANDROID WEBVIEW: Reinforce scale lock ───────────────
    // Android WebView respects user-scalable=no but only after this runs.
    // Re-apply the viewport content after DOM is ready to catch late renders.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            var vp = document.querySelector('meta[name="viewport"]');
            if (vp) {
                vp.setAttribute('content',
                    'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover'
                );
            }
        });
    }

})();
