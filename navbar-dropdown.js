/***********************************************
 * Wishlist Dropdown Initialization on Page Load
 ***********************************************/
document.addEventListener("DOMContentLoaded", function () {
    const wishlistBlocks = document.querySelectorAll(".wishlist-block");
    const mobileNavMenu = document.querySelector(".mobile-nav-menu"); // Mobile navbar container

    if (wishlistBlocks.length === 0) return; // Prevent errors if wishlist elements are missing

    wishlistBlocks.forEach((wishlistBlock) => {

        /***********************************************
         * Create and Insert Wishlist Dropdown
         ***********************************************/
        const wishlistDropdown = document.createElement("div");
        wishlistDropdown.classList.add("wishlist-dropdown");
        wishlistDropdown.innerHTML = `
            <div class="favorites-header px-5">
              <h3 class="wishlist-title">Favorites (0 items)</h3>
              <img class="cursor-pointer close-dropdown" src="https://www.gemnote.com/images/common/cross.svg">
            </div>
            <div class="favorites-empty px-5">
              <h2>You have no favorites yet.</h2>
              <p>Add your favorite items to the wishlist!</p>
              <div style="display:flex; justify-content: center;">
                <a href="https://www.gemnote.com/lookbook" class="btn-start">explore our lookbook</a>
              </div>
            </div>
            <div class="favorites-list px-5" style="display: none;">
              <ul class="wishlist-items"></ul>
            </div>
            <div class="favorites-footer">
              <a href="https://www.gemnote.com/start-a-project" class="btn-start">start a project</a>
            </div>
        `;

        // Insert dropdown appropriately based on device (mobile or desktop)
        if (mobileNavMenu && mobileNavMenu.contains(wishlistBlock)) {
            // Mobile: insert after mobile nav menu
            mobileNavMenu.parentNode.insertBefore(wishlistDropdown, mobileNavMenu.nextSibling);
            wishlistDropdown.classList.add("mobile-wishlist-dropdown");
        } else {
            // Desktop: insert into the current nav container
            wishlistBlock.parentNode.appendChild(wishlistDropdown);
        }

        wishlistDropdown.style.display = "none";

        /***********************************************
         * Dropdown Toggle & Event Bindings
         ***********************************************/
        
        // Toggle dropdown on wishlist icon click
        wishlistBlock.addEventListener("click", function (event) {
            event.stopPropagation();
            mobileNavMenu.style.display = "none"; // Hide mobile menu if open
            closeOtherDropdowns(wishlistDropdown); // Close other dropdowns if open

            wishlistDropdown.style.display = wishlistDropdown.style.display === "flex" ? "none" : "flex";
            updateWishlistUI(wishlistDropdown);
        });

        // Close dropdown via close button
        wishlistDropdown.querySelector(".close-dropdown").addEventListener("click", function () {
            wishlistDropdown.style.display = "none";
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", function (event) {
            if (!wishlistBlock.contains(event.target) && !wishlistDropdown.contains(event.target)) {
                wishlistDropdown.style.display = "none";
            }
        });

        // Initialize dropdown with saved wishlist
        updateWishlistUI(wishlistDropdown);
    });

    /***********************************************
     * Close All Other Wishlist Dropdowns
     ***********************************************/
    function closeOtherDropdowns(currentDropdown) {
        document.querySelectorAll(".wishlist-dropdown").forEach(dropdown => {
            if (dropdown !== currentDropdown) {
                dropdown.style.display = "none";
            }
        });
    }

    /***********************************************
     * Render Wishlist UI from Cookie
     ***********************************************/
    function updateWishlistUI(wishlistDropdown) {
        const wishlistCookie = getCookie("lookbook");
        const wishlistItems = wishlistCookie ? JSON.parse(decodeURIComponent(wishlistCookie)) : [];

        const wishlistTitle = wishlistDropdown.querySelector(".wishlist-title");
        const wishlistList = wishlistDropdown.querySelector(".wishlist-items");
        const favoritesEmpty = wishlistDropdown.querySelector(".favorites-empty");
        const favoritesList = wishlistDropdown.querySelector(".favorites-list");
        const favoritesFooter = wishlistDropdown.querySelector(".favorites-footer");

        // Update title with item count
        wishlistTitle.textContent = `Favorites (${wishlistItems.length} item${wishlistItems.length !== 1 ? "s" : ""})`;

        // Toggle between empty and list view
        if (wishlistItems.length === 0) {
            favoritesEmpty.style.display = "flex";
            favoritesList.style.display = "none";
            favoritesFooter.style.display = "none";
        } else {
            favoritesEmpty.style.display = "none";
            favoritesList.style.display = "block";
            favoritesFooter.style.display = "flex";

            // Populate wishlist items dynamically
            wishlistList.innerHTML = wishlistItems
                .map((item, index) => `
                    <li class="favorite-item px-5" data-index="${index}">
                      <div class="list-container gap-4 justify-evenly mt-7">
                        <div class="image-wrapper">
                          <img class="object-cover image-container" src="${item.image}" alt="${item.text}">
                        </div>
                        <div class="flex flex-col justify-evenly lg:gap-[3px] gap-[2px]">
                          <h3 class="font-editorial item-heading">${item.text}</h3>
                          <p class="font-inter item-price">From $${item.price.toFixed(2)}</p>
                          <p class="font-inter remove-button cursor-pointer" data-index="${index}">remove</p>
                        </div>
                      </div>
                    </li>
                `).join("");
        }

        // Bind remove events for each item
        wishlistDropdown.querySelectorAll(".remove-button").forEach((btn) => {
            btn.addEventListener("click", function (event) {
                event.stopPropagation();
                removeFromWishlist(parseInt(this.dataset.index, 10), wishlistDropdown);
            });
        });
    }

    /***********************************************
     * Remove Item from Wishlist and Update UI
     ***********************************************/
    function removeFromWishlist(index, wishlistDropdown) {
        const wishlistCookie = getCookie("lookbook");
        let wishlistItems = wishlistCookie ? JSON.parse(wishlistCookie) : [];

        if (wishlistItems[index]) {
            wishlistItems.splice(index, 1); // Remove item
            setCookie("lookbook", JSON.stringify(wishlistItems), 7); // Update cookie
            updateWishlistUI(wishlistDropdown); // Re-render UI
        }

        updateWishlistCounter(); // Refresh wishlist count (if any)
        updateButtonStyles();    // Sync styles with changes
        refreshButtonStyles();   // Optional additional UI refresh
    }
});
