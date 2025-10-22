/*************************************
 * Parse URL Path Segments
 *************************************/

// Extract current URL segments and determine second-to-last segment
const siteUrl = window.location.pathname.split("/").filter(Boolean);
const subUrl = siteUrl[siteUrl.length - 2];
const BASE_URL = 'https://merchos.gemnote.com'

/*************************************
 * Fetch and Render Products
 *************************************/

// Fetch product data from API and render them dynamically to the page
const fetchAndRenderProducts = async () => {
    const lastSegment = siteUrl[siteUrl.length - 1];
    let collection_name = "";

    // Map URL path to the correct collection slug
    switch (lastSegment) {
        case 'event-giveaways':
            collection_name = 'events-conference-giveaways';
            break;
        case 'ecommerce-merchandise':
            collection_name = 'e-commerce-merchandise';
            break;
        case '':
        case undefined:
            collection_name = 'homepage';
            break;
        default:
            collection_name = lastSegment || 'homepage';
    }

    const isValidCollection = typeof collection_name === 'string' && collection_name.trim() !== '';
    const collectionSlug = isValidCollection ? collection_name : '';

    // API endpoint to fetch products
    const endpoint = `${BASE_URL}/api/v1/products/?is_active=&has_variants=&can_be_customized=&min_price=&max_price=&brand_slug=&category_slug=&collection_slug=${collectionSlug}`;

    try {
        const res = await fetch(endpoint);
        const data = await res.json();

        // Get root element for product list
        const productsRoot = document.getElementById("products-root");

        // Create DOM structure for product grid
        const wrapper = document.createElement("div");
        wrapper.className = "home-product-wrap";

        const listWrapper = document.createElement("div");
        listWrapper.className = "home-product-list-wrapper w-dyn-list";

        const list = document.createElement("div");
        list.className = "homeproduct-list w-dyn-items w-row";

        // Generate each product item and append to the list
        data.results.forEach(product => {
            const item = document.createElement("div");
            item.className = "home-product-item w-dyn-item w-col w-col-3";
            item.setAttribute("role", "listitem");

            item.innerHTML = `
                <img src="${BASE_URL + product.thumbnail_url}" loading="lazy" alt="${product.name}" class="product-img">
                <div class="price-wrap-block">
                  <div class="price-wrap">
                    <div class="price-block">from $</div>
                    <div class="price-block">${product.price}</div>
                    <div class="price-block">USD</div>
                  </div>
                  <div class="unit-text">Min. 15 units</div>
                </div>
                <h2 class="product-heading">${product.brand.name ?? ''} ${product.name}</h2>
                <a href="#" class="add-button w-button">add to favorites</a>
            `;

            list.appendChild(item);
        });

        // Append the full product structure to the root element
        listWrapper.appendChild(list);
        wrapper.appendChild(listWrapper);
        productsRoot.appendChild(wrapper);

        return document.querySelectorAll('.home-product-item');
    } catch (err) {
        console.error("Failed to fetch products:", err);
        return [];
    } finally {
        updateButtonStyles(); // Update button styles based on wishlist
    }
};

/*************************************
 * Setup Product Click Events
 *************************************/

// Attach click handlers to product items for wishlist functionality
const setupProductClickHandlers = async () => {
    const productItems = await fetchAndRenderProducts();

    if (productItems.length > 0) {
        productItems.forEach((item) => {
            item.addEventListener('click', () => {
                const productName = item.querySelector('.product-heading').textContent;
                const priceBlocks = item.querySelectorAll('.price-block');
                const productPrice = parseFloat(priceBlocks[1].textContent.trim());
                const productImage = item.querySelector('.product-img').getAttribute('src');

                const product = {
                    Name: productName,
                    Price: productPrice,
                    Image: productImage,
                };

                saveToWishlist(product);       // Add or remove from wishlist
                updateButtonStyles();         // Refresh button style
            });
        });
    } else {
        console.log('No product items found.');
    }
};

/*************************************
 * Conditional Initialization
 *************************************/

// Only run for pages that are NOT "products-packaging"
if (subUrl !== 'products-packaging')
    setupProductClickHandlers();
