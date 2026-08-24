/*************************************
 * Parse URL Path Segments
 *************************************/

// Extract the current URL path segments and get the second-to-last segment
const boxSiteUrl = window.location.pathname.split("/").filter(Boolean);
const boxSubUrl = boxSiteUrl[boxSiteUrl.length - 2];
// Resolve the merchOS origin from the current environment so boxes target
// staging vs production with no manual edits. The Webflow site and the merchOS
// API are separate hosts, so window.location.origin can't be used directly
// (that host returns HTML, not JSON). Default to production. Uniquely named to
// avoid colliding with any global BASE_URL declared by another script.
const BOX_BASE_ORIGIN = (function () {
    const { origin, hostname } = window.location;
    if (/merchos\.gemnote\.com$/i.test(hostname)) return origin;
    const isStaging = /staging|\.webflow\.io$|localhost|127\.0\.0\.1|\.local$/i.test(hostname);
    return isStaging
        ? 'https://staging-merchos.gemnote.com'
        : 'https://merchos.gemnote.com';
})();
// Product permalink base — mirrors PRODUCT_URL_BASE in fetch-products.js.
// merchOS serves each product at /products/<slug>/ (app/lookbook/urls.py →
// `product_permalink`). That route is registered in trailing-slash form only,
// so always build the URL with one; without it every click eats an APPEND_SLASH
// 301. No query params — the slug is the whole address.
const BOX_PRODUCT_URL_BASE = `${BOX_BASE_ORIGIN}/products/`;

/*************************************
 * Wishlist store (SHARED with the product grid)
 * Boxes save to the SAME localStorage store as fetch-products.js — the Pinia
 * "merch-wishlist" key, shape { wishlistItems: [...fullProductObjects] }, dedup
 * by product.id — so packages show up on the favorites page alongside products.
 * (Previously boxes wrote to a separate `lookbook` cookie the favorites page
 * never read, so they never appeared.)
 * Box-scoped function names avoid colliding with other top-level scripts.
 *************************************/
const BOX_WISHLIST_KEY = "merch-wishlist";

function boxReadWishlist() {
    try {
        const raw = localStorage.getItem(BOX_WISHLIST_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.wishlistItems) ? parsed.wishlistItems : [];
    } catch {
        return [];
    }
}

function boxWriteWishlist(items) {
    localStorage.setItem(BOX_WISHLIST_KEY, JSON.stringify({ wishlistItems: items }));
}

function boxIsInWishlist(productId) {
    return boxReadWishlist().some((p) => p.id === productId);
}

function boxToggleWishlist(product) {
    const items = boxReadWishlist();
    const idx = items.findIndex((p) => p.id === product.id);
    if (idx >= 0) items.splice(idx, 1);
    else items.push(product);
    boxWriteWishlist(items);
}

/*************************************
 * Wishlist counter (localStorage-based, mirrors fetch-products.js)
 * Hide the badge (and its .wishlist-nuber-block wrapper) at 0; cap at "99+".
 *************************************/
function boxApplyCounter(el, count) {
    if (!el) return;
    const n = Number(count) || 0;
    el.textContent = n > 99 ? "99+" : String(n);
    el.style.display = n > 0 ? "flex" : "none";
    const wrap = el.closest('[class*="nuber-block"]');
    if (wrap) wrap.style.display = n > 0 ? "" : "none";
}

function boxUpdateWishlistCounters() {
    const count = boxReadWishlist().length;
    boxApplyCounter(document.getElementById("wishlist-counter"), count);
    boxApplyCounter(document.getElementById("mobile-wishlist-counter"), count);
}

/*************************************
 * Cart counter (localStorage-based, mirrors fetch-products.js)
 * The packaging page never writes the cart — merchOS does — but the navbar badge
 * lives on this page too, so it has to be painted from the shared store on
 * render. localStorage shape: { "items": { [cartKey]: {...} }, ... } — `items`
 * is an OBJECT keyed by line, so count distinct lines (the store's
 * `uniqueProductCount` getter).
 *************************************/
const BOX_CART_KEY = "merch-cart";

function boxReadCartLineCount() {
    try {
        const raw = localStorage.getItem(BOX_CART_KEY);
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        const items = parsed?.items;
        return items && typeof items === "object" ? Object.keys(items).length : 0;
    } catch {
        return 0;
    }
}

function boxUpdateCartCounters() {
    const count = boxReadCartLineCount();
    boxApplyCounter(document.getElementById("cart-counter"), count);
    boxApplyCounter(document.getElementById("mobile-cart-counter"), count);
}

function boxUpdateAllCounters() {
    boxUpdateWishlistCounters();
    boxUpdateCartCounters();
}

/*************************************
 * Favorites button label + state
 *************************************/
const BOX_ARROW = ' <svg class="packages-btn-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="7" viewBox="0 0 14 7" fill="none" aria-hidden="true"><path d="M0 3.35352H13M10 6.35352L13 3.35352L10 0.353516" stroke="currentColor" stroke-linejoin="round"></path></svg>';

function boxSetButtonState(button, isFav) {
    if (!button) return;
    button.classList.toggle("packages-button--added", isFav);
    button.innerHTML = (isFav ? "Added to Favorites" : "Add to Favorites") + BOX_ARROW;
    // Clear any legacy inline styles from the old cookie-based design.
    button.style.backgroundColor = "";
    button.style.color = "";
    button.style.backgroundImage = "";
}

/*************************************
 * Fetch and Render Box Products
 *************************************/

// Fetch product data based on URL, then render them into the DOM
const fetchBoxProducts = async () => {
    const lastSegment = boxSiteUrl[boxSiteUrl.length - 1];
    let collection_name = "";

    // Determine the collection name based on URL
    switch (lastSegment) {
        case 'luxury-rigid-boxes':
            collection_name = 'rigid-boxes';
            break;
        case 'corrugated-shipping-boxes':
            collection_name = 'corrugated-shipping-boxes';
            break;
        case '':
        case undefined:
            collection_name = '';
            break;
        default:
            collection_name = lastSegment || '';
    }

    const isValidCollection = typeof collection_name === 'string' && collection_name.trim() !== '';
    const collectionSlug = isValidCollection ? collection_name : '';

    // API endpoint for fetching products by collection slug
    const endpoint = `${BOX_BASE_ORIGIN}/api/v1/products/?is_active=&has_variants=&can_be_customized=&min_price=&max_price=&brand_slug=&category_slug=&collection_slug=${collectionSlug}`;

    try {
        const res = await fetch(endpoint);
        const data = await res.json();

        const productsRoot = document.getElementById("box-products-root");
        if (!productsRoot) return [];

        // Create wrapper container for product cards
        const wrapper = document.createElement("div");
        wrapper.className = `packages-wrap ${data.count > 3 ? "_4-grid" : ""}`;

        const items = Array.isArray(data.results) ? data.results : [];

        // Generate product cards, wire up favorites, and append to wrapper
        items.forEach(product => {
            const block = document.createElement("div");
            block.className = "packages-block";
            // Whole card is the link target (same pattern as the product grid),
            // so it needs to read and behave as one control.
            if (product.slug) {
                block.setAttribute("role", "button");
                block.setAttribute("tabindex", "0");
                block.style.cursor = "pointer";
            }

            const fav = boxIsInWishlist(product.id);

            block.innerHTML = `
                <div class="packages-sub">Custom</div>
                <h2 class="packages-heading">${product.name}</h2>
                <div class="packages-image-wrap">
                    <img src="${product.thumbnail_url}" loading="lazy" alt="${product.name}" class="packages-image">
                </div>
                <div style="display: none;" class="price-block">${product.price}</div>
                <p class="packages-pera">${product.description || ""}</p>
                <a href="#" class="packages-button w-button${fav ? " packages-button--added" : ""}">${fav ? "Added to Favorites" : "Add to Favorites"}${BOX_ARROW}</a>
            `;

            // Toggle this product in the SHARED wishlist (full object, by id).
            const button = block.querySelector(".packages-button");
            if (button) {
                button.addEventListener("click", (e) => {
                    e.preventDefault();
                    // Keep the favorites CTA from also triggering the card's
                    // navigation below.
                    e.stopPropagation();
                    boxToggleWishlist(product);
                    boxSetButtonState(button, boxIsInWishlist(product.id));
                    boxUpdateWishlistCounters();
                });
            }

            // Card click / Enter / Space → the product permalink.
            const goToProduct = () => {
                // A product with no slug has no addressable page — bail rather
                // than send the visitor to a 404.
                if (!product.slug) return;
                window.location.href = BOX_PRODUCT_URL_BASE + encodeURIComponent(product.slug) + "/";
            };

            block.addEventListener("click", (e) => {
                // Guard by target, not just on the stopPropagation above:
                // add-boxes-to-wishlist.js binds the same CTA and only calls
                // preventDefault(), so its clicks still bubble to here.
                if (e.target.closest(".packages-button, a, button")) return;
                goToProduct();
            });
            block.addEventListener("keydown", (e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                if (e.target.closest(".packages-button, a, button")) return;
                e.preventDefault();
                goToProduct();
            });

            wrapper.appendChild(block);
        });

        // Replace any existing content with the new product list
        productsRoot.innerHTML = "";
        productsRoot.appendChild(wrapper);

        // Reflect the shared wishlist + cart counts now that the page is populated.
        boxUpdateAllCounters();

        return document.querySelectorAll('.packages-block');
    } catch (err) {
        console.error("Failed to fetch products:", err);
        return [];
    }
};

/*************************************
 * Initialize
 *************************************/
// Paint both navbar badges on every page that loads this script, not just the
// packaging page — the render path below only runs on /products-packaging.
boxUpdateAllCounters();

// Keep both navbar badges in sync if the wishlist or cart changes in another tab
// ON THIS SAME ORIGIN (storage events do not cross origins).
window.addEventListener("storage", (ev) => {
    if (ev.key === BOX_WISHLIST_KEY) boxUpdateWishlistCounters();
    if (ev.key === BOX_CART_KEY) boxUpdateCartCounters();
});
window.addEventListener("pageshow", boxUpdateAllCounters);

// Only fetch/render on the packaging page.
if (boxSubUrl === 'products-packaging') {
    fetchBoxProducts();
}
