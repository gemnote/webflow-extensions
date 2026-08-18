/*************************************
 * Navbar cart + wishlist icon links
 *
 * The Webflow navbar renders both icons as plain <div>s (.cart-header-block /
 * .wishlist-block), so they aren't clickable. Wire them here rather than as
 * Webflow Link Blocks so the destination stays environment-agnostic.
 *
 * Paths are SAME-ORIGIN and relative on purpose — no host is hardcoded. merchOS
 * is served under the same domain as the Webflow site (that's also why the navbar
 * badges can read merchOS's `merch-cart` out of localStorage at all — localStorage
 * is per-origin), so production, staging and local all resolve correctly from
 * whatever host the page is already on.
 *
 * Targets mirror merchOS's own navbar (frontend/src/components/Navbar/index.vue):
 *   cart  → /products/checkout/
 *   heart → /products/favorites/
 *
 * Load this site-wide (Webflow → Project Settings → Custom Code → Footer) so the
 * icons work on every page, not just the ones that render a product grid.
 *************************************/
(function () {
    const CART_PATH = "/products/checkout/";
    const FAVORITES_PATH = "/products/favorites/";

    /**
     * Make a non-anchor block behave like a link: pointer cursor, focusable,
     * activatable by mouse, Enter and Space. `data-navLinked` keeps a second copy
     * of this script (or a re-run) from binding the same block twice.
     */
    function wire(el, path, label) {
        if (!el || el.dataset.navLinked === "1") return;
        el.dataset.navLinked = "1";

        // Leave a real anchor alone — Webflow already handles navigation for it.
        if (el.closest("a")) return;

        el.style.cursor = "pointer";
        el.setAttribute("role", "link");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", label);

        // Root-relative assignment: the browser resolves it against the current
        // origin, so the same build works on every domain we deploy to.
        const go = () => { window.location.href = path; };
        el.addEventListener("click", go);
        el.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                go();
            }
        });
    }

    function wireNavbarIcons() {
        // querySelectorAll, not getElementById: the desktop and mobile navbars are
        // separate copies of the same block, and both need wiring.
        document.querySelectorAll(".cart-header-block").forEach((el) => wire(el, CART_PATH, "Cart"));
        document.querySelectorAll(".wishlist-block").forEach((el) => wire(el, FAVORITES_PATH, "Favorites"));

        // Fallback for navbars whose wrapper classes differ: walk up from the
        // counter badge, which is keyed by a known id in both navbars.
        [
            ["cart-counter", CART_PATH, "Cart"],
            ["mobile-cart-counter", CART_PATH, "Cart"],
            ["wishlist-counter", FAVORITES_PATH, "Favorites"],
            ["mobile-wishlist-counter", FAVORITES_PATH, "Favorites"],
        ].forEach(([id, path, label]) => {
            const counter = document.getElementById(id);
            if (!counter) return;
            const block = counter.closest(".cart-header-block, .wishlist-block, .cart-block, .wishlist-header-block");
            if (block) wire(block, path, label);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", wireNavbarIcons);
    } else {
        wireNavbarIcons();
    }
})();
