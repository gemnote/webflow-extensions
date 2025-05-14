const boxSiteUrl = window.location.pathname.split("/").filter(Boolean);
const boxSubUrl = boxSiteUrl[boxSiteUrl.length - 2];

const fetchBoxProducts = async () => {
    const lastSegment = boxSiteUrl[boxSiteUrl.length - 1];

    let collection_name = "";

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
    const endpoint = `https://merchos.gemnote.com/api/v1/products/?is_active=&has_variants=&can_be_customized=&min_price=&max_price=&brand_slug=&category_slug=&collection_slug=${collectionSlug}`;

    try {
        const res = await fetch(endpoint);
        const data = await res.json();

        const productsRoot = document.getElementById("box-products-root");

        const wrapper = document.createElement("div");
        wrapper.className = `packages-wrap ${data.count > 3 ? "_4-grid" : ""}`;

        data.results.forEach(product => {
            const block = document.createElement("div");
            block.className = "packages-block";

            block.innerHTML = `
                <div class="packages-sub">Custom</div>
                <h2 class="packages-heading">${product.name}</h2>
                <img src="${product.image_url}" loading="lazy" alt="${product.name}" class="packages-image">
                <div style="display: none;" class="price-block">${product.msrp}</div>
                <p class="packages-pera">${product.description || ""}</p>
                <a href="#" class="packages-button w-button">add to favorites</a>
            `;

            wrapper.appendChild(block);
        });

        productsRoot.innerHTML = ""; // Clear previous content
        productsRoot.appendChild(wrapper);

        return document.querySelectorAll('.packages-block');
    } catch (err) {
        console.error("Failed to fetch products:", err);
        return [];
    } finally {
        refreshButtonStyles();
    }
};

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
                    refreshButtonStyles();
                });
            }
        });
    } else {
        console.log('No product items found.');
    }
};

if (boxSubUrl === 'products-packaging')
    setupBoxProductClickHandlers();
