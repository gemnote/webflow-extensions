/*************************************
 * Cookie Helpers
 *************************************/
const getWishlistCookie = (name) => {
    const cookieString = document.cookie;
    const cookies = cookieString.split('; ');
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split('=');
        if (cookieName === name) {
            return decodeURIComponent(cookieValue);
        }
    }
    return null;
};

const setWishlistCookie = (name, value, daysToExpire) => {
    const date = new Date();
    date.setTime(date.getTime() + daysToExpire * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/`;
};

/*************************************
 * Wishlist Counter
 *************************************/
const refreshWishlistCounter = () => {
    // Read the SHARED localStorage wishlist ("merch-wishlist") — the same store
    // the product grid and packages now use — not the legacy `lookbook` cookie.
    let wishlistItems = [];
    try {
        const parsed = JSON.parse(localStorage.getItem('merch-wishlist'));
        if (Array.isArray(parsed?.wishlistItems)) wishlistItems = parsed.wishlistItems;
    } catch (e) { /* keep empty */ }

    const wishlistCounter = document.getElementById('wishlist-counter');
    const wishlistMobileCounter = document.getElementById('mobile-wishlist-counter');

    // Hide the badge entirely at 0; show as flex above 0 (cap at "99+").
    const n = wishlistItems.length;
    [wishlistCounter, wishlistMobileCounter].forEach((el) => {
        if (!el) return;
        el.textContent = n > 99 ? '99+' : String(n);
        el.style.display = n > 0 ? 'flex' : 'none';
        // Hide the badge wrapper (.wishlist-nuber-block) too, so no empty
        // circle shows at 0.
        const wrap = el.closest('[class*="nuber-block"]');
        if (wrap) wrap.style.display = n > 0 ? '' : 'none';
    });
};

/*************************************
 * Save / Remove from Wishlist
 *************************************/
const toggleWishlistItem = (altProduct) => {
    const wishlistCookie = getWishlistCookie('lookbook');
    let wishlistItems = wishlistCookie ? JSON.parse(decodeURIComponent(wishlistCookie)) : [];

    const existingProductIndex = wishlistItems.findIndex((item) => item.text === altProduct.Name);

    if (existingProductIndex !== -1) {
        // Remove if already in wishlist (toggle behavior)
        wishlistItems.splice(existingProductIndex, 1);
    } else {
        wishlistItems.push({
            image: altProduct.Image,
            price: altProduct.Price,
            text: altProduct.Name,
        });
    }

    setWishlistCookie('lookbook', JSON.stringify(wishlistItems), 7);
    refreshWishlistCounter();
};

/*************************************
 * Update Button Styles
 *************************************/
const refreshButtonStyles = () => {
    const wishlistCookie = getWishlistCookie('lookbook');
    const wishlistItems = wishlistCookie ? JSON.parse(decodeURIComponent(wishlistCookie)) : [];

    // Select all product-list items
    const altProductLists = document.querySelectorAll('.packages-block');

    altProductLists.forEach((altItem) => {
        const altProductName = altItem.querySelector('.packages-heading')?.textContent;
        const altAddButton = altItem.querySelector('.add-button.w-button, .packages-button.w-button');

        if (!altProductName || !altAddButton) return;

        // Check if product is in the wishlist
        const isInWishlist = wishlistItems.some((wish) => wish.text === altProductName);

        // Clear any legacy inline styles from the old design (tiled background
        // image + hardcoded colors) so the CSS pill styling wins.
        altAddButton.style.backgroundColor = '';
        altAddButton.style.color = '';
        altAddButton.style.backgroundImage = '';

        // Toggle the "added" class (filled dark pill) and rebuild the label via
        // innerHTML so the arrow span is preserved.
        const arrow = ' <svg class="packages-btn-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="7" viewBox="0 0 14 7" fill="none" aria-hidden="true"><path d="M0 3.35352H13M10 6.35352L13 3.35352L10 0.353516" stroke="currentColor" stroke-linejoin="round"></path></svg>';
        if (isInWishlist) {
            altAddButton.classList.add('packages-button--added');
            altAddButton.innerHTML = 'Added to Favorites' + arrow;
        } else {
            altAddButton.classList.remove('packages-button--added');
            altAddButton.innerHTML = 'Add to Favorites' + arrow;
        }
    });
};

/*************************************
 * Set Up Click Handlers
 *************************************/
const altProductLists = document.querySelectorAll('.packages-block');

if (altProductLists.length > 0) {
    altProductLists.forEach((altItem) => {
        const altAddButton = altItem.querySelector('.add-button.w-button, .packages-button.w-button');
        
        if (altAddButton) {
            altAddButton.addEventListener('click', (e) => {
                e.preventDefault();

                const altProductName = altItem.querySelector('.packages-heading')?.textContent || '';
                const altPriceBlocks = altItem.querySelectorAll('.price-block');
                let altProductPrice = 0;

                if (altPriceBlocks.length > 1) {
                    altProductPrice = parseFloat(altPriceBlocks[1].textContent.trim()) || 0;
                }

                const altProductImage = altItem.querySelector('.packages-image')?.getAttribute('src') || '';

                const altProduct = {
                    Name: altProductName,
                    Price: altProductPrice,
                    Image: altProductImage,
                };

                toggleWishlistItem(altProduct);
                refreshButtonStyles();
            });
        }
    });
} else {
    console.log('No product items found.');
}

/*************************************
 * Initial Load
 *************************************/
refreshWishlistCounter();
refreshButtonStyles();
