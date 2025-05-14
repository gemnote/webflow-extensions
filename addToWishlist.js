const getCookie = (name) => {
    const cookieString = document.cookie;
    const cookies = cookieString.split('; ');
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split('=');
        if (cookieName === name) {
            return decodeURIComponent(cookieValue);
        }
    }
    return null;
}

const setCookie = (name, value, daysToExpire) => {
    const date = new Date();
    date.setTime(date.getTime() + daysToExpire * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/`;
}

const updateWishlistCounter = () => {
    const wishlistCookie = getCookie('lookbook');
    const wishlistItems = wishlistCookie ? JSON.parse(wishlistCookie) : [];
    const wishlistCounter = document.getElementById('wishlist-counter');
    const wishlistMobileCounter = document.getElementById('mobile-wishlist-counter');

    if (wishlistCounter) {
        wishlistCounter.textContent = wishlistItems.length;
    }

    if (wishlistMobileCounter) {
        wishlistMobileCounter.textContent = wishlistItems.length;
    }
}

const saveToWishlist = (product) => {
    const wishlistCookie = getCookie('lookbook');
    let wishlistItems = wishlistCookie ? JSON.parse(wishlistCookie) : [];

    const existingProductIndex = wishlistItems.findIndex((item) => item.text === product.Name);

    if (existingProductIndex !== -1) {
        wishlistItems.splice(existingProductIndex, 1);
    } else {
        wishlistItems.push({ image: product.Image, price: product.Price, text: product.Name });
    }

    setCookie('lookbook', JSON.stringify(wishlistItems), 7);
    updateWishlistCounter();
}

const updateButtonStyles = () => {
    const wishlistCookie = getCookie('lookbook');
    const wishlistItems = wishlistCookie ? JSON.parse(wishlistCookie) : [];
    const productItems = document.querySelectorAll('.home-product-item, .product-item');

    productItems.forEach((item) => {
        const productName = item.querySelector('.product-heading').textContent;
        const addButton = item.querySelector('.add-button.w-button');

        const isInWishlist = wishlistItems.some((item) => item.text === productName);

        if (addButton) {
            if (isInWishlist) {
                addButton.style.backgroundColor = 'black';
                addButton.style.color = 'white';
                addButton.style.backgroundImage = 'url(https://cdn.prod.website-files.com/6718ab0c5f7e6e98b11c3a7c/673742d3be3c146f36db76bb_gray-round-icon.png)';
                addButton.textContent = 'added to favorites';
            } else {
                addButton.style.backgroundColor = '';
                addButton.style.color = '';
                addButton.style.backgroundImage = '';
                addButton.textContent = 'add to favorites';
            }
        }
    });
}

const productItems = document.querySelectorAll('.home-product-item, .product-item');

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

            saveToWishlist(product);
            updateButtonStyles();
        });
    });
} else {
    console.log('No product items found.');
}

updateWishlistCounter();
updateButtonStyles();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.querySelectorAll('.w-webflow-badge').forEach(badge => badge.remove());
    }, 300);
});