/***********************************************
 * Cart Drawer
 *
 * Port of merchOS's frontend/src/components/Lookbook/CartDrawer.vue to plain
 * JS for Webflow. Markup, class names and the pricing/meta helpers mirror the
 * Vue component so the two stay easy to diff.
 *
 * merchOS is served from /products/ on this same origin, so its Pinia cart —
 * persisted to localStorage under `merch-cart` — is the drawer's source of
 * truth. That makes this a real mirror: the same lines, quantities, colours,
 * decoration and totals the merchOS cart and checkout show.
 *
 * Not the `lookbook` favourites cookie, which is a different feature (the
 * hearts on lookbook cards) and holds no configured lines.
 *
 * Replaces cart-dropdown.js / cart-dropdown.css. Load this pair instead of
 * that pair; loading both would open two carts from the same click.
 ***********************************************/
(function () {
    "use strict";

    /***********************************************
     * Config — set window.GEMNOTE_CART_DRAWER before this script to override
     ***********************************************/
    const config = Object.assign({
        // merchOS's persisted Pinia cart store.
        merchCartKey: "merch-cart",
        triggerSelector: ".cart-block",
        // Elements whose text is set to the number of lines in the cart.
        // The lookbook's #wishlist-counter is deliberately not in here: it
        // counts favourites, which is a separate list.
        counterSelector: "#cart-counter, #mobile-cart-counter",

        title: "Your cart",
        emptyText: "Your cart is empty.",
        note: "Logo and decoration included. You'll split sizes and approve final proofs next.",
        ctaLabel: "Go to checkout",

        // Deliberately relative: merchOS runs on this origin, which is also
        // where the cart being linked to lives.
        checkoutPath: "/products/checkout/",
        // /products/<slug>/ is merchOS's product permalink.
        productPath: "/products/",

        zIndex: 9999,
    }, window.GEMNOTE_CART_DRAWER || {});

    /***********************************************
     * Reading and Writing the merchOS Cart
     ***********************************************/
    const readCart = () => {
        try {
            const raw = localStorage.getItem(config.merchCartKey);
            const parsed = raw ? JSON.parse(raw) : null;
            if (!parsed || typeof parsed !== "object") return { items: {}, productSizes: {} };
            return {
                items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
                productSizes: parsed.productSizes && typeof parsed.productSizes === "object"
                    ? parsed.productSizes
                    : {},
                _migrated: parsed._migrated,
            };
        } catch (err) {
            // Private mode, blocked storage, or a shape change on the merchOS
            // side. An empty cart is the safe reading.
            console.warn("cart-drawer: could not read the merchOS cart", err);
            return { items: {}, productSizes: {} };
        }
    };

    const writeCart = (cart) => {
        try {
            localStorage.setItem(config.merchCartKey, JSON.stringify(cart));
            return true;
        } catch (err) {
            console.warn("cart-drawer: could not write the merchOS cart", err);
            return false;
        }
    };

    /** merchOS's `cartItems` getter: the store keys lines, the UI lists them. */
    const cartItems = (cart) => Object.values(cart.items);

    /***********************************************
     * Formatting — ported from the Vue component and utils/helpers
     ***********************************************/
    const escapeHtml = (value) =>
        String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return "N/A";
        const num = typeof amount === "number" ? amount : parseFloat(amount);
        if (isNaN(num)) return "N/A";
        return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
    };

    /* Mirrors Checkout.vue's effectiveUnitPrice, minus the server quote it has
     * no access to: the line's stored unit price (which already includes
     * decoration) before the catalog price. */
    const unitPrice = (item) => {
        const stored = parseFloat(item.unitPrice);
        if (!isNaN(stored) && stored > 0) return stored;
        return parseFloat(item.product && item.product.price) || 0;
    };

    const lineTotal = (item) => unitPrice(item) * (item.qty || 0);

    /** utils/helpers.js getBestImageUrl, for the fields a cart line keeps. */
    const getBestImageUrl = (variant, baseUrl) => {
        if (!variant) return null;
        const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
        const candidates = [
            ...toArray(variant.managed_image_urls),
            ...toArray(variant.managed_image_url),
            ...toArray(variant.preferred_image_url),
            ...toArray(variant.external_image_urls),
            ...toArray(variant.external_image_url),
            ...toArray(variant.thumbnail_url),
        ]
            .flat()
            .map((s) => (typeof s === "string" ? s.trim() : s))
            .filter(Boolean);

        if (!candidates.length) return null;
        const first = candidates[0];
        if (/^(?:[a-z]+:)?\/\//i.test(first)) return first;

        if (!baseUrl) return first;
        const b = baseUrl.endsWith("/");
        const p = first.startsWith("/");
        if (b && p) return baseUrl + first.slice(1);
        if (!b && !p) return baseUrl + "/" + first;
        return baseUrl + first;
    };

    /* The branded mockup is the point of the cart, so it wins when there is
     * one — unlike the checkout row, which deliberately skips mockup URLs. */
    const itemImage = (item) => {
        if (item.mockupImageUrl) return item.mockupImageUrl;
        return getBestImageUrl(item.product || {}, window.location.origin) || null;
    };

    const colorLabel = (item) =>
        (item.selectedColor && item.selectedColor.value) || item.selectedColor || "";

    const metaLine = (item) =>
        [colorLabel(item), item.printingMethod, `Qty ${item.qty}`]
            .filter(Boolean)
            .join(" · ");

    const brandName = (item) =>
        (item.product && item.product.brand && item.product.brand.name) ||
        (item.product && item.product.brand_name) ||
        "";

    /* merchOS's editItem opens the product modal on this line. Reached here by
     * URL, with `?edit=` handing ProductDetailsModal the cart key to hydrate
     * from.
     *
     * The slug gives the canonical permalink, /products/<slug>/. Lines saved
     * before the cart store started keeping the slug have only an id, which
     * has no route of its own — /products/<id>/ is a 404 — so those fall back
     * to the legacy `?product=` query the modal still honours, which resolves
     * the id server-side and then rewrites the address to the canonical slug. */
    const editHref = (item) => {
        const product = item.product || {};
        if (!item.key) return null;

        const edit = "edit=" + encodeURIComponent(item.key);

        if (product.slug) {
            return config.productPath + encodeURIComponent(product.slug) + "/?" + edit;
        }
        if (product.id) {
            return config.productPath + "?product=" + encodeURIComponent(product.id) + "&" + edit;
        }
        return null;
    };

    /***********************************************
     * Icons — lifted from the Vue component and its CircularCrossButton
     ***********************************************/
    const CROSS_ICON = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="cross-icon" aria-hidden="true">
          <path class="icon-disc" d="M12.0017 21.5C10.6877 21.5 9.45267 21.2507 8.2965 20.752C7.14033 20.2533 6.13467 19.5766 5.2795 18.7218C4.42433 17.8669 3.74725 16.8617 3.24825 15.706C2.74942 14.5503 2.5 13.3156 2.5 12.0017C2.5 10.6877 2.74933 9.45267 3.248 8.2965C3.74667 7.14033 4.42342 6.13467 5.27825 5.2795C6.13308 4.42433 7.13833 3.74725 8.294 3.24825C9.44967 2.74942 10.6844 2.5 11.9983 2.5C13.3123 2.5 14.5473 2.74933 15.7035 3.248C16.8597 3.74667 17.8653 4.42342 18.7205 5.27825C19.5757 6.13308 20.2528 7.13833 20.7518 8.294C21.2506 9.44967 21.5 10.6844 21.5 11.9983C21.5 13.3123 21.2507 14.5473 20.752 15.7035C20.2533 16.8597 19.5766 17.8653 18.7218 18.7205C17.8669 19.5757 16.8617 20.2528 15.706 20.7518C14.5503 21.2506 13.3156 21.5 12.0017 21.5Z" fill="#22211F"/>
          <path class="icon-glyph" d="M8.4 16.6538L12 13.0538L15.6 16.6538L16.6538 15.6L13.0538 12L16.6538 8.4L15.6 7.34625L12 10.9462L8.4 7.34625L7.34625 8.4L10.9462 12L7.34625 15.6L8.4 16.6538ZM12.0017 21.5C10.6877 21.5 9.45267 21.2507 8.2965 20.752C7.14033 20.2533 6.13467 19.5766 5.2795 18.7218C4.42433 17.8669 3.74725 16.8617 3.24825 15.706C2.74942 14.5503 2.5 13.3156 2.5 12.0017C2.5 10.6877 2.74933 9.45267 3.248 8.2965C3.74667 7.14033 4.42342 6.13467 5.27825 5.2795C6.13308 4.42433 7.13833 3.74725 8.294 3.24825C9.44967 2.74942 10.6844 2.5 11.9983 2.5C13.3123 2.5 14.5473 2.74933 15.7035 3.248C16.8597 3.74667 17.8653 4.42342 18.7205 5.27825C19.5757 6.13308 20.2528 7.13833 20.7518 8.294C21.2506 9.44967 21.5 10.6844 21.5 11.9983C21.5 13.3123 21.2507 14.5473 20.752 15.7035C20.2533 16.8597 19.5766 17.8653 18.7218 18.7205C17.8669 19.5757 16.8617 20.2528 15.706 20.7518C14.5503 21.2506 13.3156 21.5 12.0017 21.5ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20Z" fill="#22211F"/>
          <path class="icon-x" d="M8.4 16.6538L12 13.0538L15.6 16.6538L16.6538 15.6L13.0538 12L16.6538 8.4L15.6 7.34625L12 10.9462L8.4 7.34625L7.34625 8.4L10.9462 12L7.34625 15.6L8.4 16.6538Z" fill="#fff"/>
        </svg>`;

    const EDIT_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5.18548 20.4401C4.73522 20.4401 4.35411 20.2841 4.04215 19.9721C3.7302 19.6602 3.57422 19.2791 3.57422 18.8288V6.89911C3.57422 6.44886 3.7302 6.06775 4.04215 5.75579C4.35411 5.44383 4.73522 5.28785 5.18548 5.28785H12.9004L11.5634 6.62481H5.18548C5.11685 6.62481 5.05401 6.65341 4.99697 6.7106C4.93977 6.76765 4.91118 6.83048 4.91118 6.89911V18.8288C4.91118 18.8974 4.93977 18.9603 4.99697 19.0173C5.05401 19.0745 5.11685 19.1031 5.18548 19.1031H17.1152C17.1838 19.1031 17.2466 19.0745 17.3037 19.0173C17.3609 18.9603 17.3895 18.8974 17.3895 18.8288V12.3942L18.7264 11.0573V18.8288C18.7264 19.2791 18.5704 19.6602 18.2585 19.9721C17.9465 20.2841 17.5654 20.4401 17.1152 20.4401H5.18548ZM8.92206 15.0922V12.0326L16.9971 3.9578C17.1352 3.8195 17.2872 3.71864 17.453 3.6552C17.6186 3.59177 17.7871 3.56006 17.9586 3.56006C18.1334 3.56006 18.3013 3.59177 18.4624 3.6552C18.6236 3.71864 18.7704 3.81661 18.9029 3.94911L20.0222 5.06503C20.1513 5.20333 20.2504 5.35589 20.3196 5.52271C20.3887 5.68954 20.4232 5.85866 20.4232 6.03009C20.4232 6.20152 20.3938 6.36775 20.335 6.52878C20.2762 6.68995 20.1776 6.83962 20.0393 6.97777L11.9387 15.0922H8.92206ZM10.259 13.7553H11.3698L16.9249 8.19997L16.3696 7.64469L15.7749 7.07225L10.259 12.5881V13.7553Z" fill="#22211F"/>
        </svg>`;

    const TRASH_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7.30775 20.5C6.80908 20.5 6.38308 20.3234 6.02975 19.9702C5.67658 19.6169 5.5 19.1909 5.5 18.6922V5.99998H4.5V4.49998H9V3.61548H15V4.49998H19.5V5.99998H18.5V18.6922C18.5 19.1974 18.325 19.625 17.975 19.975C17.625 20.325 17.1974 20.5 16.6923 20.5H7.30775ZM17 5.99998H7V18.6922C7 18.7821 7.02883 18.8558 7.0865 18.9135C7.14417 18.9711 7.21792 19 7.30775 19H16.6923C16.7692 19 16.8398 18.9679 16.9038 18.9037C16.9679 18.8397 17 18.7692 17 18.6922V5.99998ZM9.404 17H10.9037V7.99998H9.404V17ZM13.0962 17H14.596V7.99998H13.0962V17Z" fill="#22211F"/>
        </svg>`;

    const ARROW_ICON = `
        <svg class="cart-drawer-cta-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="7" viewBox="0 0 14 7" fill="none" aria-hidden="true">
          <path d="M0 3.35355H13M10 6.35355L13 3.35355L10 0.353546" stroke="currentColor" stroke-linejoin="round"/>
        </svg>`;

    /***********************************************
     * Build the Drawer — one instance for the whole page, appended to <body>,
     * which is what the component's <Teleport to="body"> does in merchOS.
     ***********************************************/
    const overlay = document.createElement("div");
    overlay.className = "cart-drawer-overlay";
    overlay.style.display = "none";
    overlay.style.zIndex = String(config.zIndex);
    overlay.innerHTML = `
        <aside class="cart-drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(config.title)}">
          <header class="cart-drawer-head">
            <h2 class="cart-drawer-title">${escapeHtml(config.title)}</h2>
            <button type="button" class="cart-drawer-close" aria-label="Close cart">${CROSS_ICON}</button>
          </header>

          <div class="cart-drawer-body"></div>

          <footer class="cart-drawer-foot">
            <div class="cart-drawer-subtotal">
              <span class="cart-drawer-subtotal-label">Subtotal</span>
              <span class="cart-drawer-subtotal-value"></span>
            </div>
            <p class="cart-drawer-note">${escapeHtml(config.note)}</p>
            <a class="cart-drawer-cta" href="${escapeHtml(config.checkoutPath)}">${escapeHtml(config.ctaLabel)}${ARROW_ICON}</a>
          </footer>
        </aside>
    `;

    const body = overlay.querySelector(".cart-drawer-body");
    const subtotalValue = overlay.querySelector(".cart-drawer-subtotal-value");
    const cta = overlay.querySelector(".cart-drawer-cta");

    // Webflow serves these scripts deferred, so DOMContentLoaded has usually
    // fired by the time this runs and a plain listener would never call back.
    const ready = (fn) => {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
        else fn();
    };

    ready(() => document.body.appendChild(overlay));

    /***********************************************
     * Render
     ***********************************************/
    const lineHtml = (item) => {
        const name = (item.product && item.product.name) || "";
        const brand = brandName(item);
        const meta = metaLine(item);
        const image = itemImage(item);
        const href = editHref(item);

        return `
          <article class="cd-line" data-key="${escapeHtml(item.key)}">
            <div class="cd-line-thumb">
              ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy">` : ""}
            </div>
            <div class="cd-line-main">
              <div class="cd-line-top">
                <h3 class="cd-line-name">${escapeHtml(name)}</h3>
                <span class="cd-line-price">${escapeHtml(formatCurrency(lineTotal(item)))}</span>
              </div>
              ${brand ? `<p class="cd-line-brand">${escapeHtml(brand)}</p>` : ""}
              <p class="cd-line-meta">${escapeHtml(meta)}</p>
              <div class="cd-line-actions">
                ${href ? `<a class="cd-line-action" href="${escapeHtml(href)}" title="Edit" aria-label="${escapeHtml("Edit " + name)}">${EDIT_ICON}</a>` : ""}
                <button type="button" class="cd-line-action cd-line-remove" title="Remove" aria-label="${escapeHtml("Remove " + name)}" data-key="${escapeHtml(item.key)}">
                  ${TRASH_ICON}
                </button>
              </div>
            </div>
          </article>`;
    };

    const syncCounters = (count) => {
        if (!config.counterSelector) return;
        document.querySelectorAll(config.counterSelector).forEach((el) => {
            el.textContent = String(count);
        });
    };

    const render = () => {
        const items = cartItems(readCart());

        body.innerHTML = items.length
            ? items.map(lineHtml).join("")
            : `<p class="cart-drawer-empty">${escapeHtml(config.emptyText)}</p>`;

        const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
        subtotalValue.textContent = formatCurrency(subtotal);

        // merchOS disables the checkout CTA on an empty cart.
        cta.classList.toggle("is-disabled", !items.length);
        cta.setAttribute("aria-disabled", items.length ? "false" : "true");

        syncCounters(items.length);
    };

    /***********************************************
     * Remove a Line
     * Mirrors cartStore.removeFromCart: the line and its size breakdown both
     * go. The mockup-polling watch it also clears has no counterpart here.
     ***********************************************/
    const removeLine = (key) => {
        const cart = readCart();
        if (!cart.items[key]) return;

        delete cart.items[key];
        delete cart.productSizes[key];
        if (!writeCart(cart)) return;

        render();
        document.dispatchEvent(new CustomEvent("gemnote:cart-updated", {
            detail: { items: cartItems(cart) },
        }));
    };

    /***********************************************
     * Open / Close
     ***********************************************/
    let isOpen = false;
    let hideTimer = null;
    let previousOverflow = "";

    const open = () => {
        if (isOpen) return;
        isOpen = true;
        clearTimeout(hideTimer);

        render();
        overlay.style.display = "flex";
        // Force a reflow so the transition starts from the closed state
        // instead of being skipped along with the display change.
        void overlay.offsetWidth;
        overlay.classList.add("is-open");

        // The page behind must not scroll while the drawer is over it.
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", onKeydown);
    };

    const close = () => {
        if (!isOpen) return;
        isOpen = false;

        overlay.classList.remove("is-open");
        document.body.style.overflow = previousOverflow;
        document.removeEventListener("keydown", onKeydown);

        // Matches the 0.26s slide; without it the drawer would vanish rather
        // than slide out.
        hideTimer = setTimeout(() => {
            if (!isOpen) overlay.style.display = "none";
        }, 300);
    };

    const toggle = () => (isOpen ? close() : open());

    function onKeydown(event) {
        if (event.key === "Escape") close();
    }

    /***********************************************
     * Event Bindings
     ***********************************************/
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close(); // @click.self
    });

    overlay.querySelector(".cart-drawer-close").addEventListener("click", close);

    body.addEventListener("click", (event) => {
        const button = event.target.closest(".cd-line-remove");
        if (!button) return;
        event.stopPropagation();
        removeLine(button.dataset.key);
    });

    cta.addEventListener("click", (event) => {
        if (cta.classList.contains("is-disabled")) event.preventDefault();
    });

    document.addEventListener("gemnote:cart-updated", () => {
        if (isOpen) render();
    });

    // merchOS running in another tab writes the same key; keep an open drawer
    // and the counters in step with it.
    window.addEventListener("storage", (event) => {
        if (event.key && event.key !== config.merchCartKey) return;
        if (isOpen) render();
        else syncCounters(cartItems(readCart()).length);
    });

    ready(() => {
        syncCounters(cartItems(readCart()).length);

        const triggers = document.querySelectorAll(config.triggerSelector);
        if (!triggers.length) return;

        const mobileNavMenu = document.querySelector(".mobile-nav-menu");

        triggers.forEach((trigger) => {
            trigger.addEventListener("click", (event) => {
                event.stopPropagation();
                if (mobileNavMenu) mobileNavMenu.style.display = "none";
                toggle();
            });
        });
    });

    /***********************************************
     * Public API — for Webflow embeds that need to drive the drawer directly
     ***********************************************/
    window.GemnoteCartDrawer = { open, close, toggle, refresh: render };
})();
