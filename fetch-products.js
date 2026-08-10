(function () {
    /*************************************
     * Parse URL Path Segments
     *************************************/
    const siteUrl = window.location.pathname.split("/").filter(Boolean);
    const subUrl = siteUrl[siteUrl.length - 2];

    /*************************************
     * Constants
     *************************************/
    const LOOKBOOK_URL = "https://merchos.gemnote.com/products/";
    // Mirror Pinia persist keys in frontend/src/stores/{wishlist,cart}.js
    const WISHLIST_STORAGE_KEY = "merch-wishlist";
    const CART_STORAGE_KEY = "merch-cart";

    /*************************************
     * Wishlist helpers (mirror Vue/Pinia store shape)
     * localStorage shape: { "wishlistItems": [...fullProductObjects] }
     * Dedup is by product.id
     *************************************/
    function readWishlistItems() {
        try {
            const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed?.wishlistItems) ? parsed.wishlistItems : [];
        } catch {
            return [];
        }
    }

    function writeWishlistItems(items) {
        localStorage.setItem(
            WISHLIST_STORAGE_KEY,
            JSON.stringify({ wishlistItems: items })
        );
    }

    function isProductInWishlist(productId) {
        return readWishlistItems().some((p) => p.id === productId);
    }

    function toggleProductInWishlist(product) {
        const items = readWishlistItems();
        const idx = items.findIndex((p) => p.id === product.id);
        if (idx >= 0) items.splice(idx, 1);
        else items.push(product);
        writeWishlistItems(items);
    }

    /*************************************
     * Counter display helper
     * Mirrors the Vue components: hide the badge at 0, show it as `flex`
     * above 0, and cap the label at "99+".
     *************************************/
    function applyCounter(el, count) {
        if (!el) return;
        const n = Number(count) || 0;
        el.textContent = n > 99 ? "99+" : String(n);
        el.style.display = n > 0 ? "flex" : "none";
        // The number sits inside a badge wrapper (e.g. .wishlist-nuber-block /
        // .cart-nuber-block) that carries the circle background — hide the whole
        // wrapper at 0 so no empty circle shows. Restore to the Webflow default
        // (blank, not forced flex) when shown.
        const wrap = el.closest('[class*="nuber-block"]');
        if (wrap) wrap.style.display = n > 0 ? "" : "none";
    }

    function updateWishlistCounters() {
        const count = readWishlistItems().length;
        applyCounter(document.getElementById("wishlist-counter"), count);
        applyCounter(document.getElementById("mobile-wishlist-counter"), count);
    }

    /*************************************
     * Cart helpers (mirror Vue/Pinia store shape)
     * localStorage shape: { "items": { [cartKey]: {...} }, ... }
     * NOTE: `items` is an OBJECT keyed by line, not an array. Count distinct
     * lines — matches the store's `uniqueProductCount` getter.
     *************************************/
    function readCartLineCount() {
        try {
            const raw = localStorage.getItem(CART_STORAGE_KEY);
            if (!raw) return 0;
            const parsed = JSON.parse(raw);
            const items = parsed?.items;
            return items && typeof items === "object" ? Object.keys(items).length : 0;
        } catch {
            return 0;
        }
    }

    function updateCartCounters() {
        const count = readCartLineCount();
        applyCounter(document.getElementById("cart-counter"), count);
        applyCounter(document.getElementById("mobile-cart-counter"), count);
    }

    function updateAllCounters() {
        updateWishlistCounters();
        updateCartCounters();
    }

    /*************************************
     * Inject Structured Data (JSON-LD) for SEO
     *************************************/
    function injectProductListSchema(products, collectionSlug) {
        const existing = document.getElementById("product-list-schema");
        if (existing) existing.remove();
        if (!Array.isArray(products) || products.length === 0) return;

        const schema = {
            "@context": "https://schema.org/",
            "@type": "ItemList",
            name: collectionSlug
                ? collectionSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : "Products",
            itemListElement: products.map((product, index) => {
                const brandName = product.brand?.name ?? "Gemnote";
                const productName = product.name ?? "";
                const imageUrl = product.preferred_image_url ?? product.thumbnail_url ?? "";
                const price = product.price ? String(product.price) : null;

                const item = {
                    "@type": "Product",
                    name: `${brandName} ${productName}`.trim(),
                    image: imageUrl,
                    brand: { "@type": "Brand", name: brandName },
                };

                if (price) {
                    item.offers = {
                        "@type": "AggregateOffer",
                        lowPrice: price,
                        priceCurrency: "USD",
                        availability: "https://schema.org/InStock",
                    };
                }

                return { "@type": "ListItem", position: index + 1, item };
            }),
        };

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "product-list-schema";
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
    }

    /*************************************
     * Update a card's heart icon based on current wishlist state
     *************************************/
    function updateCardFavoriteIcon(card, productId) {
        // The heart is a two-path SVG (outline + solid). `is-fav` on the button
        // drives which is shown; the hover cross-fade lives entirely in CSS.
        const favBtn = card.querySelector(".fav-icon-container-main button");
        if (!favBtn) return;
        favBtn.classList.toggle("is-fav", isProductInWishlist(productId));
    }

    /*************************************
     * Attach handlers to a card
     * - card click / Enter / Space → redirect to lookbook with ?product=<id>
     *   (the lookbook auto-opens the product modal from that param)
     * - heart button click → toggle wishlist (no redirect)
     *************************************/
    function attachCardHandlers(card, product) {
        const goToLookbook = () => {
            if (!product.id) return;
            const url = new URL(LOOKBOOK_URL);
            url.searchParams.set("product", product.id);
            window.location.href = url.toString();
        };

        const favBtn = card.querySelector(".fav-icon-container-main button");
        if (favBtn) {
            favBtn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                toggleProductInWishlist(product);
                updateCardFavoriteIcon(card, product.id);
                updateWishlistCounters();
            });
        }

        card.addEventListener("click", goToLookbook);
        card.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                goToLookbook();
            }
        });
    }

    /*************************************
     * Fetch and Render Products
     *************************************/
    const fetchAndRenderProducts = async () => {
        const lastSegment = siteUrl[siteUrl.length - 1];
        let collection_name = "";

        switch (lastSegment) {
            // Slugs whose Webflow URL differs from the backend collection slug
            case "event-giveaways":
                collection_name = "events-conference-giveaways";
                break;
            case "ecommerce-merchandise":
                collection_name = "e-commerce-merchandise";
                break;
            // Site root (no slug) shows the homepage collection
            case "":
            case undefined:
                collection_name = "homepage";
                break;
            // Any other page (e.g. "employee-swag") uses its URL slug directly
            // as the collection slug.
            default:
                collection_name = lastSegment;
        }

        const collectionSlug =
            collection_name.trim() !== ""
                ? collection_name
                : "";

        const endpoint = `https://merchos.gemnote.com/api/v1/products/?is_active=&has_variants=&can_be_customized=&min_price=&max_price=&brand_slug=&category_slug=&collection_slug=${collectionSlug}`;

        try {
            const res = await fetch(endpoint);
            const data = await res.json();

            const productsRoot = document.getElementById("products-root");
            if (!productsRoot) {
                console.warn("products-root not found in DOM.");
                return [];
            }

            productsRoot.innerHTML = "";

            const grid = document.createElement("div");
            grid.className = "lookbook-product-grid-main";

            const items = Array.isArray(data.results) ? data.results : [];

            items.forEach((product) => {
                const card = document.createElement("div");
                card.className = "lookbook-product-card-main card-wrapper cursor-pointer overflow-hidden";
                card.setAttribute("role", "button");
                card.setAttribute("tabindex", "0");
                if (product.id) card.dataset.productId = product.id;

                const imageUrl = product.thumbnail_url ?? product.preferred_image_url ?? "";
                const brandName = product.brand?.name ?? "Generic";
                const productName = product.name ?? "";
                const msrp = product.price ?? "";

                card.innerHTML = `
            <div class="card-image-container">
              <div class="hover-zoom hover-zoom--basic bg-white-smoke overflow-hidden">
                <img src="${imageUrl}" alt="${escapeHtml(brandName + " " + productName)}" class="w-full h-full object-cover" loading="lazy">
              </div>

              <div class="fav-icon-container-main">
                <button type="button" class="fav-btn relative cursor-pointer" aria-label="Toggle favorite">
                  <svg class="fav-heart" width="24" height="21" viewBox="0 0 23 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path class="fav-outline" d="M11.0615 20L9.7763 18.8447C7.84617 17.0936 6.25002 15.589 4.98785 14.3307C3.72568 13.0722 2.72549 11.9522 1.98728 10.9706C1.24907 9.98928 0.733356 9.09398 0.44013 8.28474C0.14671 7.47571 0 6.65473 0 5.82182C0 4.1694 0.557149 2.78594 1.67145 1.67144C2.78594 0.557148 4.1694 0 5.82182 0C6.83831 0 7.79891 0.237724 8.70363 0.713173C9.60834 1.18862 10.3943 1.87046 11.0615 2.75867C11.7286 1.87046 12.5146 1.18862 13.4193 0.713173C14.324 0.237724 15.2846 0 16.3011 0C17.9535 0 19.337 0.557148 20.4515 1.67144C21.5658 2.78594 22.1229 4.1694 22.1229 5.82182C22.1229 6.65473 21.9762 7.47571 21.6828 8.28474C21.3896 9.09398 20.8739 9.98928 20.1356 10.9706C19.3974 11.9522 18.3991 13.0722 17.1406 14.3307C15.8823 15.589 14.2843 17.0936 12.3466 18.8447L11.0615 20ZM11.0615 17.6401C12.9244 15.9638 14.4575 14.527 15.6607 13.3296C16.8639 12.1325 17.8148 11.0924 18.5134 10.2094C19.212 9.32646 19.6972 8.54236 19.9689 7.85713C20.2405 7.1721 20.3764 6.49366 20.3764 5.82182C20.3764 4.65746 19.9883 3.68715 19.212 2.91091C18.4358 2.13467 17.4655 1.74655 16.3011 1.74655C15.3816 1.74655 14.5319 2.00736 13.7517 2.529C12.9718 3.05083 12.3542 3.77671 11.8989 4.70665H10.224C9.76116 3.76915 9.14162 3.04142 8.36538 2.52347C7.58914 2.00552 6.74128 1.74655 5.82182 1.74655C4.66483 1.74655 3.69637 2.13467 2.91644 2.91091C2.13651 3.68715 1.74655 4.65746 1.74655 5.82182C1.74655 6.49366 1.88239 7.1721 2.15407 7.85713C2.42576 8.54236 2.91091 9.32646 3.60953 10.2094C4.30815 11.0924 5.25905 12.1306 6.46222 13.3241C7.6654 14.5176 9.19848 15.9563 11.0615 17.6401Z" fill="#22211F"></path>
                    <path class="fav-solid" d="M11.0615 20L9.7763 18.8447C7.84617 17.0936 6.25002 15.589 4.98785 14.3307C3.72568 13.0722 2.72549 11.9522 1.98728 10.9706C1.24907 9.98928 0.733356 9.09398 0.44013 8.28474C0.14671 7.47571 0 6.65473 0 5.82182C0 4.1694 0.557149 2.78594 1.67145 1.67144C2.78594 0.557148 4.1694 0 5.82182 0C6.83831 0 7.79891 0.237724 8.70363 0.713173C9.60834 1.18862 10.3943 1.87046 11.0615 2.75867C11.7286 1.87046 12.5146 1.18862 13.4193 0.713173C14.324 0.237724 15.2846 0 16.3011 0C17.9535 0 19.337 0.557148 20.4515 1.67144C21.5658 2.78594 22.1229 4.1694 22.1229 5.82182C22.1229 6.65473 21.9762 7.47571 21.6828 8.28474C21.3896 9.09398 20.8739 9.98928 20.1356 10.9706C19.3974 11.9522 18.3991 13.0722 17.1406 14.3307C15.8823 15.589 14.2843 17.0936 12.3466 18.8447L11.0615 20Z" fill="#22211F"></path>
                  </svg>
                </button>
              </div>

              <div class="card-cta-overlay">
                <button type="button" class="call-for-action light-btn card-cta-btn" aria-label="Add">
                  <svg class="card-cta-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                  </svg>
                  Add
                </button>
              </div>
            </div>

            <div class="flex flex-col mt-[8px] gap-[6px] w-full">
              <div>
                <p class="lookbook-product-name">${escapeHtml(productName)}</p>
                <p class="lookbook-product-brand">${escapeHtml(brandName)}</p>
              </div>
              <div class="lookbook-product-price-container" style="justify-content: space-between !important;">
                <div style="display: flex; align-items: baseline; gap: 4px;">
                  <p class="price w-max"><span class="price-from">From</span> $${escapeHtml(String(msrp))}</p>
                </div>
              </div>
            </div>
          `;

                grid.appendChild(card);
                attachCardHandlers(card, product);
                updateCardFavoriteIcon(card, product.id);
            });

            productsRoot.appendChild(grid);
            injectProductListSchema(items, collectionSlug);

            return document.querySelectorAll(".lookbook-product-card-main");
        } catch (err) {
            console.error("Failed to fetch products:", err);
            return [];
        }
    };

    /*************************************
     * Helpers
     *************************************/
    function escapeHtml(str) {
        if (typeof str !== "string") return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /*************************************
     * Initialize
     *************************************/
    updateAllCounters();
    window.addEventListener("pageshow", updateAllCounters);

    // Live-sync both navbar badges when wishlist/cart change in another tab
    // ON THIS SAME ORIGIN (storage events do not cross origins).
    window.addEventListener("storage", (ev) => {
        if (ev.key === WISHLIST_STORAGE_KEY) updateWishlistCounters();
        if (ev.key === CART_STORAGE_KEY) updateCartCounters();
    });

    if (subUrl !== "products-packaging") {
        fetchAndRenderProducts();
    }
})();