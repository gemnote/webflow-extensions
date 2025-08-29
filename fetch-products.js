/*************************************
 * Parse URL Path Segments
 *************************************/
const siteUrl = window.location.pathname.split("/").filter(Boolean);
const subUrl = siteUrl[siteUrl.length - 2];

/*************************************
 * Fetch and Render Products (render using lookbook classes)
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
            collection_name = lastSegment || "homepage";
    }

    const collectionSlug =
        typeof collection_name === "string" && collection_name.trim() !== ""
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

        // Clear any previous content
        productsRoot.innerHTML = "";

        // Grid wrapper (uses your existing CSS class)
        const grid = document.createElement("div");
        grid.className = "lookbook-product-grid-main";

        // Ensure data.results exists (fallback to empty array)
        const items = Array.isArray(data.results) ? data.results : [];

        items.forEach((product) => {
            const card = document.createElement("div");
            card.className = "lookbook-product-card-main cursor-pointer overflow-hidden";
            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            // Save product id/slug if available
            if (product.id) card.dataset.productId = product.id;

            const imageUrl = product.image_url ?? product.image ?? "";
            const brandName = product.brand_name ?? "Generic";
            const productName = product.name ?? "";
            const msrp = product.msrp ?? "";

            card.innerHTML = `
        <!-- Image with hover zoom -->
        <div class="hover-zoom hover-zoom--basic bg-white-smoke">
          <img src="${imageUrl}" alt="${escapeHtml(brandName + ' ' + productName)}" loading="lazy">
        </div>

        <!-- Favourite Icon -->
        <div class="fav-icon-container-main">
          <button type="button" class="relative cursor-pointer" aria-label="Toggle favorite">
            <svg width="18" height="18" viewBox="0 0 28 24" xmlns="http://www.w3.org/2000/svg"
              class="transition-colors duration-300 fill-none hover:fill-[#22211F]">
              <path d="M25.1268 2.84009L25.246 2.95689C27.6228 5.40725 27.584 9.29727 25.1298 11.7008L14 22.6003L2.87019 11.7008L2.87018 11.7007C0.37659 9.25879 0.376619 5.28213 2.87019 2.84008C5.3754 0.386643 9.47246 0.386632 11.9777 2.84009L13.2988 4.13382L13.9985 4.81903L14.6982 4.13382L16.0192 2.84009C18.5244 0.386643 22.6215 0.386632 25.1268 2.84009Z"
                stroke="#22211F" stroke-width="2"></path>
            </svg>
          </button>
        </div>

        <!-- Product Info -->
        <div class="flex flex-col mt-[8px] gap-[6px]">
          <p class="lookbook-product-name">${escapeHtml(productName)}</p>
          <p class="lookbook-product-brand">${escapeHtml(brandName)}</p>
          <div class="lookbook-product-price-container">
            <p class="price">From $${escapeHtml(msrp)}</p>
            <p class="min-units">Min. 50 units</p>
          </div>
        </div>
      `;

            // Attach dataset for later access
            card.dataset.name = `${brandName} ${productName}`.trim();
            card.dataset.price = `${msrp}`;

            grid.appendChild(card);
        });

        productsRoot.appendChild(grid);

        // Return NodeList of created cards
        return document.querySelectorAll(".lookbook-product-card-main");
    } catch (err) {
        console.error("Failed to fetch products:", err);
        return [];
    } finally {
        if (typeof updateFavoritesIconStyles === "function") updateFavoritesIconStyles();
    }
};

const handleFillFavoritesIcon = (item) => {
    const nameEl = item.querySelector(".lookbook-product-name");
    const productName = nameEl ? nameEl.textContent.trim() : (item.dataset.name || "").trim();

    const wishlistCookie = getCookie('lookbook');
    const wishlistItems = wishlistCookie ? JSON.parse(wishlistCookie) : [];
    const isInWishlist = wishlistItems.some(w => w.text === productName);

    const heartSvg = item.querySelector('.fav-icon-container-main button svg');
    const heartPath = item.querySelector('.fav-icon-container-main button svg path');

    if (heartSvg && heartPath) {
        if (isInWishlist) {
            heartPath.style.fill = '#22211F';
            heartPath.style.stroke = '#22211F';
            heartSvg.classList.remove('fill-none');
            heartSvg.classList.add('is-fav');
        } else {
            heartPath.style.fill = 'none';
            heartPath.style.stroke = '#22211F';
            heartSvg.classList.add('fill-none');
            heartSvg.classList.remove('is-fav');
        }
    }
}

/*************************************
 * Setup Product Click Events
 *************************************/
const setupProductClickHandlers = async () => {
    const productItems = await fetchAndRenderProducts();

    if (productItems.length > 0) {
        productItems.forEach((item) => {
            // primary handler (for the whole card)
            const handler = () => {
                const productNameEl = item.querySelector(".lookbook-product-name");
                const priceEl = item.querySelector(".price");
                const imgEl = item.querySelector(".hover-zoom img");

                const productName = productNameEl ? productNameEl.textContent.trim() : (item.dataset.name || "");
                // extract numeric part of price if possible
                let productPrice = 0;
                if (priceEl) {
                    const match = priceEl.textContent.match(/[\d.,]+/);
                    productPrice = match ? parseFloat(match[0].replace(/,/g, "")) : 0;
                } else if (item.dataset.price) {
                    productPrice = parseFloat(item.dataset.price) || 0;
                }
                const productImage = imgEl ? imgEl.getAttribute("src") : "";

                const product = {
                    Name: productName,
                    Price: productPrice,
                    Image: productImage,
                };

                if (typeof saveToWishlist === "function") {
                    saveToWishlist(product);
                } else {
                    console.info("saveToWishlist not defined. Product payload:", product);
                }

                handleFillFavoritesIcon(item)

                if (typeof updateFavoritesIconStyles === "function") updateFavoritesIconStyles();
            };

            // click on the whole card
            item.addEventListener("click", handler);

            // favourite button inside the card (stops propagation, uses same handler)
            const favBtn = item.querySelector("button");
            if (favBtn) {
                favBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    handler();
                });
            }

            // keyboard accessibility: Enter key toggles wishlist when focused
            item.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    handler();
                }
            });
        });
    } else {
        console.log("No product items found.");
    }
};

/*************************************
 * Conditional Initialization
 *************************************/
if (subUrl !== "products-packaging") {
    // initialize
    setupProductClickHandlers();
}

/*************************************
 * Small helper
 *************************************/
// basic html escape for interpolated strings (avoid injecting raw HTML)
function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
