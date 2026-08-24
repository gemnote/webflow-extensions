/*************************************
 * Navbar cart + wishlist + market icon links
 *
 * The Webflow navbar renders these icons as plain <div>s (.cart-header-block /
 * .wishlist-block / .user-header-block), so they aren't clickable. Wire them here
 * rather than as Webflow Link Blocks so the destination stays
 * environment-agnostic.
 *
 * The cart and wishlist paths are SAME-ORIGIN and relative on purpose — no host is
 * hardcoded. merchOS is served under the same domain as the Webflow site (that's
 * also why the navbar badges can read merchOS's `merch-cart` out of localStorage at
 * all — localStorage is per-origin), so production, staging and local all resolve
 * from whatever host the page is already on.
 *
 * The market icon is the one exception: it points at the store's own login host,
 * which is a DIFFERENT origin from the Webflow site, so it has to be absolute.
 *
 * Targets mirror merchOS's own navbar (frontend/src/components/Navbar/index.vue):
 *   cart   → /products/checkout/
 *   heart  → /products/favorites/
 *   market → http://store.gemnote.com/auth/login
 *
 * DELEGATION, not per-element listeners. The desktop and mobile navbars are
 * separate copies of the same blocks, and the mobile one is frequently revealed
 * or cloned by Webflow after DOMContentLoaded — listeners bound up front never
 * reach those nodes (and a clone carries any "already wired" marker with it while
 * dropping the listeners, so the marker lies). One listener on the document
 * catches every copy, whenever it appears.
 *
 * Load site-wide (Webflow → Project Settings → Custom Code → Footer).
 *************************************/
(function () {
    const CART_PATH = "/products/checkout/";
    const FAVORITES_PATH = "/products/favorites/";
    // Absolute, cross-origin: the store login lives on its own host.
    const MARKET_URL = "http://store.gemnote.com/auth/login";

    // Explicit class list first — cheapest and covers the known navbars. Both the
    // desktop and mobile copies use these same classes.
    const CART_SEL = ".cart-header-block, .cart-block";
    const FAVORITES_SEL = ".wishlist-block, .wishlist-header-block";
    const MARKET_SEL = ".user-header-block";

    // Fallback for a navbar whose wrapper classes differ: the counter badges carry
    // known ids, so walk up from one to the icon block that contains it.
    const COUNTER_IDS = [
        ["cart-counter", CART_PATH],
        ["mobile-cart-counter", CART_PATH],
        ["wishlist-counter", FAVORITES_PATH],
        ["mobile-wishlist-counter", FAVORITES_PATH],
    ];

    /**
     * Which page, if any, does this event target belong to? Resolved live on every
     * interaction rather than cached, so nodes added or replaced after load work
     * with no re-initialisation.
     */
    function destinationFor(target) {
        if (!target || typeof target.closest !== "function") return null;

        if (target.closest(CART_SEL)) return CART_PATH;
        if (target.closest(FAVORITES_SEL)) return FAVORITES_PATH;
        if (target.closest(MARKET_SEL)) return MARKET_URL;

        for (const [id, path] of COUNTER_IDS) {
            const counter = document.getElementById(id);
            if (!counter) continue;
            // Climb a few levels from the badge to the icon block (the element that
            // also holds the icon <img>/<svg>), then test containment.
            let node = counter.parentElement;
            for (let hop = 0; node && hop < 4; hop++, node = node.parentElement) {
                if (!node.querySelector("img, svg")) continue;
                if (node.contains(target)) return path;
                break;
            }
        }
        return null;
    }

    function navigate(path) {
        // Root-relative paths resolve against the current origin, so the same build
        // works on every domain we deploy to; the market URL is already absolute and
        // passes through unchanged.
        window.location.href = path;
    }

    /**
     * Capture phase, so this runs before any Webflow interaction on the same block
     * can swallow the event.
     */
    document.addEventListener("click", (ev) => {
        const path = destinationFor(ev.target);
        if (!path) return;

        // If Webflow already wrapped the icon in a real link, let that link win.
        // An empty or placeholder href is not a real link — take over instead.
        const anchor = ev.target.closest("a");
        const href = anchor && anchor.getAttribute("href");
        if (href && href !== "#" && !/^javascript:/i.test(href)) return;

        ev.preventDefault();
        navigate(path);
    }, true);

    document.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const path = destinationFor(ev.target);
        if (!path) return;
        ev.preventDefault();
        navigate(path);
    }, true);

    // iOS Safari does not reliably fire `click` on non-interactive elements such as
    // a bare <div>. Treat a tap that barely moved as a click; anything further is a
    // scroll and must be ignored.
    let touchStart = null;
    document.addEventListener("touchstart", (ev) => {
        const t = ev.touches && ev.touches[0];
        touchStart = t ? { x: t.clientX, y: t.clientY, target: ev.target } : null;
    }, { capture: true, passive: true });

    document.addEventListener("touchend", (ev) => {
        const start = touchStart;
        touchStart = null;
        if (!start) return;

        const t = ev.changedTouches && ev.changedTouches[0];
        if (!t) return;
        if (Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) return;

        const path = destinationFor(start.target);
        if (!path) return;

        const anchor = start.target.closest && start.target.closest("a");
        const href = anchor && anchor.getAttribute("href");
        if (href && href !== "#" && !/^javascript:/i.test(href)) return;

        ev.preventDefault();
        navigate(path);
    }, true);

    /**
     * Cosmetic only — the pointer cursor, focus stop and screen-reader label. The
     * click handling above does not depend on this having run, which is the whole
     * point of delegating. Re-run on pageshow to pick up a restored page.
     */
    function decorate() {
        document.querySelectorAll(`${CART_SEL}, ${FAVORITES_SEL}, ${MARKET_SEL}`).forEach((el) => {
            if (el.closest("a")) return;
            el.style.cursor = "pointer";
            el.setAttribute("role", "link");
            el.setAttribute("tabindex", "0");
            if (!el.getAttribute("aria-label")) {
                let label = "Favorites";
                if (el.matches(CART_SEL)) label = "Cart";
                else if (el.matches(MARKET_SEL)) label = "Sign in";
                el.setAttribute("aria-label", label);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", decorate);
    } else {
        decorate();
    }
    window.addEventListener("pageshow", decorate);
})();
