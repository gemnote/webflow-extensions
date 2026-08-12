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

        // Create wrapper container for product cards
        const wrapper = document.createElement("div");
        wrapper.className = `packages-wrap ${data.count > 3 ? "_4-grid" : ""}`;

        // Generate product cards and append to wrapper
        data.results.forEach(product => {
            const block = document.createElement("div");
            block.className = "packages-block";

            block.innerHTML = `
                <div class="packages-sub">Custom</div>
                <h2 class="packages-heading">${product.name}</h2>
                <div class="packages-image-wrap">
                    <img src="${product.thumbnail_url}" loading="lazy" alt="${product.name}" class="packages-image">
                </div>
                <div style="display: none;" class="price-block">${product.price}</div>
                <p class="packages-pera">${product.description || ""}</p>
                <a href="#" class="packages-button w-button">Add to Favorites <span class="packages-btn-arrow" aria-hidden="true">&rarr;</span></a>
            `;

            wrapper.appendChild(block);
        });

        // Replace any existing content with the new product list
        productsRoot.innerHTML = "";
        productsRoot.appendChild(wrapper);

        return document.querySelectorAll('.packages-block');
    } catch (err) {
        console.error("Failed to fetch products:", err);
        return [];
    } finally {
        refreshButtonStyles(); // Ensure button styles are updated
    }
};

/*************************************
 * Setup Click Events on Box Products
 *************************************/

// Add click listeners to each product block to handle wishlist logic
const setupBoxProductClickHandlers = async () => {
    const productItems = await fetchBoxProducts();

    if (productItems.length > 0) {
        productItems.forEach((item) => {
            const button = item.querySelector('.packages-button');
            if (button) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();

                    const productName = item.querySelector('.packages-heading').textContent;
                    const productImage = item.querySelector('.packages-image').getAttribute('src');
                    const priceBlocks = item.querySelectorAll('.price-block');
                    const productPrice = parseFloat(priceBlocks[0].textContent.trim());

                    const product = {
                        Name: productName,
                        Price: productPrice,
                        Image: productImage,
                    };

                    saveToWishlist(product);
                    refreshButtonStyles(); // Update button appearance
                });
            }
        });
    } else {
        console.log('No product items found.');
    }
};

/*************************************
 * Conditional Initialization
 *************************************/

// Only run the product fetch and setup if URL matches expected pattern
if (boxSubUrl === 'products-packaging')
    setupBoxProductClickHandlers();
