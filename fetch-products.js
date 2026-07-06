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
        const heartSvg = card.querySelector(".fav-icon-container-main button svg");
        const heartPath = card.querySelector(".fav-icon-container-main button svg path");
        if (!heartSvg || !heartPath) return;

        if (isProductInWishlist(productId)) {
            heartPath.style.fill = "#22211F";
            heartPath.style.stroke = "#22211F";
            heartSvg.classList.remove("fill-none");
            heartSvg.classList.add("is-fav");
        } else {
            heartPath.style.fill = "none";
            heartPath.style.stroke = "#22211F";
            heartSvg.classList.add("fill-none");
            heartSvg.classList.remove("is-fav");
        }
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
            case "event-giveaways":
                collection_name = "events-conference-giveaways";
                break;
            case "ecommerce-merchandise":
                collection_name = "e-commerce-merchandise";
                break;
            case "":
            case undefined:
                collection_name = "homepage";
                break;
            default:
                collection_name = "homepage";
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
                card.className = "lookbook-product-card-main cursor-pointer overflow-hidden";
                card.setAttribute("role", "button");
                card.setAttribute("tabindex", "0");
                if (product.id) card.dataset.productId = product.id;

                const imageUrl = product.thumbnail_url ?? product.preferred_image_url ?? "";
                const brandName = product.brand?.name ?? "Generic";
                const productName = product.name ?? "";
                const msrp = product.price ?? "";

                card.innerHTML = `
            <div class="hover-zoom hover-zoom--basic bg-white-smoke">
              <img src="${imageUrl}" alt="${escapeHtml(brandName + " " + productName)}" loading="lazy">
            </div>

            <div class="fav-icon-container-main">
              <button type="button" class="relative cursor-pointer" aria-label="Toggle favorite">
                <svg width="18" height="18" viewBox="0 0 28 24" xmlns="http://www.w3.org/2000/svg"
                  class="transition-colors duration-300 fill-none hover:fill-[#22211F]">
                  <path d="M25.1268 2.84009L25.246 2.95689C27.6228 5.40725 27.584 9.29727 25.1298 11.7008L14 22.6003L2.87019 11.7008L2.87018 11.7007C0.37659 9.25879 0.376619 5.28213 2.87019 2.84008C5.3754 0.386643 9.47246 0.386632 11.9777 2.84009L13.2988 4.13382L13.9985 4.81903L14.6982 4.13382L16.0192 2.84009C18.5244 0.386643 22.6215 0.386632 25.1268 2.84009Z"
                    stroke="#22211F" stroke-width="2"></path>
                </svg>
              </button>
            </div>

            <div class="flex flex-col mt-[8px] gap-[6px]">
              <p class="lookbook-product-name">${escapeHtml(productName)}</p>
              <p class="lookbook-product-brand">${escapeHtml(brandName)}</p>
              <div class="lookbook-product-price-container">
                <p class="price">From $${escapeHtml(String(msrp))}</p>
                <p class="min-units">Min. 50 units</p>
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