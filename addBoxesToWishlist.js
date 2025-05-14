/*************************************
 * Cookie Helpers (Renamed)
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
 * Wishlist Counter (Renamed)
 *************************************/
const refreshWishlistCounter = () => {
    const wishlistCookie = getWishlistCookie('lookbook');
    const wishlistItems = wishlistCookie ? JSON.parse(decodeURIComponent(wishlistCookie)) : [];

    const wishlistCounter = document.getElementById('wishlist-counter');
    const wishlistMobileCounter = document.getElementById('mobile-wishlist-counter');

    if (wishlistCounter) {
        wishlistCounter.textContent = wishlistItems.length;
    }
    if (wishlistMobileCounter) {
        wishlistMobileCounter.textContent = wishlistItems.length;
    }
};

/*************************************
 * Save / Remove from Wishlist (Renamed)
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
 * Update Button Styles (Renamed)
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

        if (isInWishlist) {
            altAddButton.style.backgroundColor = 'black';
            altAddButton.style.color = 'white';
            altAddButton.style.backgroundImage = 'url(https://cdn.prod.website-files.com/6718ab0c5f7e6e98b11c3a7c/673742d3be3c146f36db76bb_gray-round-icon.png)';
            altAddButton.textContent = 'added to favorites';
        } else {
            altAddButton.style.backgroundColor = '';
            altAddButton.style.color = '';
            altAddButton.style.backgroundImage = '';
            altAddButton.textContent = 'add to favorites';
        }
    });
};

/*************************************
 * Set Up Click Handlers (Renamed)
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
 * Initial Load (Renamed)
 *************************************/
refreshWishlistCounter();
refreshButtonStyles();
