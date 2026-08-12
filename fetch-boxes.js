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
                    boxToggleWishlist(product);
                    boxSetButtonState(button, boxIsInWishlist(product.id));
                    boxUpdateWishlistCounters();
                });
            }

            wrapper.appendChild(block);
        });

        // Replace any existing content with the new product list
        productsRoot.innerHTML = "";
        productsRoot.appendChild(wrapper);

        // Reflect the shared wishlist count now that the page is populated.
        boxUpdateWishlistCounters();

        return document.querySelectorAll('.packages-block');
    } catch (err) {
        console.error("Failed to fetch products:", err);
        return [];
    }
};

/*************************************
 * Initialize
 *************************************/
// Keep both navbar badges in sync if the wishlist changes in another tab.
window.addEventListener("storage", (ev) => {
    if (ev.key === BOX_WISHLIST_KEY) boxUpdateWishlistCounters();
});
window.addEventListener("pageshow", boxUpdateWishlistCounters);

// Only fetch/render on the packaging page.
if (boxSubUrl === 'products-packaging') {
    fetchBoxProducts();
}
