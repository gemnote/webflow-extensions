/***********************************************
 * Cart Dropdown Initialization on Page Load
 ***********************************************/
document.addEventListener("DOMContentLoaded", function () {
    const cartBlocks = document.querySelectorAll(".cart-icon");
    const mobileNavMenu = document.querySelector(".mobile-nav-menu"); // Mobile navbar container

    if (cartBlocks.length === 0) return; // Prevent errors if cart elements are missing

    cartBlocks.forEach((cartBlock) => {

        /***********************************************
         * Create and Insert Cart Dropdown
         ***********************************************/
        const cartDropdown = document.createElement("div");
        cartDropdown.classList.add("cart-dropdown");
        cartDropdown.innerHTML = `
            <div class="cart-header px-5">
              <h3 class="cart-title">Cart (0 items)</h3>
              <img class="cursor-pointer close-dropdown" src="https://www.gemnote.com/images/common/cross.svg">
            </div>
            <div class="cart-empty px-5">
              <h2>Your cart is empty.</h2>
              <p>Add items to your cart to get started!</p>
              <div style="display:flex; justify-content: center;">
                <a href="https://www.gemnote.com/lookbook" class="btn-start">explore our lookbook</a>
              </div>
            </div>
            <div class="cart-list px-5" style="display: none;">
              <ul class="cart-items"></ul>
            </div>
            <div class="cart-footer">
              <a href="https://www.gemnote.com/start-a-project" class="btn-start">start a project</a>
            </div>
        `;

        // Insert dropdown appropriately based on device (mobile or desktop)
        if (mobileNavMenu && mobileNavMenu.contains(cartBlock)) {
            // Mobile: insert after mobile nav menu
            mobileNavMenu.parentNode.insertBefore(cartDropdown, mobileNavMenu.nextSibling);
            cartDropdown.classList.add("mobile-cart-dropdown");
        } else {
            // Desktop: insert into the current nav container
            cartBlock.parentNode.appendChild(cartDropdown);
        }

        cartDropdown.style.display = "none";

        /***********************************************
         * Dropdown Toggle & Event Bindings
         ***********************************************/

        // Toggle dropdown on cart icon click
        cartBlock.addEventListener("click", function (event) {
            event.stopPropagation();
            mobileNavMenu.style.display = "none"; // Hide mobile menu if open
            closeOtherDropdowns(cartDropdown); // Close other dropdowns if open

            cartDropdown.style.display = cartDropdown.style.display === "flex" ? "none" : "flex";
            updateCartUI(cartDropdown);
        });

        // Close dropdown via close button
        cartDropdown.querySelector(".close-dropdown").addEventListener("click", function () {
            cartDropdown.style.display = "none";
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", function (event) {
            if (!cartBlock.contains(event.target) && !cartDropdown.contains(event.target)) {
                cartDropdown.style.display = "none";
            }
        });

        // Initialize dropdown with saved cart items
        updateCartUI(cartDropdown);
    });

    /***********************************************
     * Close All Other Cart Dropdowns
     ***********************************************/
    function closeOtherDropdowns(currentDropdown) {
        document.querySelectorAll(".cart-dropdown").forEach(dropdown => {
            if (dropdown !== currentDropdown) {
                dropdown.style.display = "none";
            }
        });
    }

    /***********************************************
     * Render Cart UI from Cookie
     ***********************************************/
    function updateCartUI(cartDropdown) {
        const cartCookie = getCookie("lookbook");
        const cartItems = cartCookie ? JSON.parse(decodeURIComponent(cartCookie)) : [];

        const cartTitle = cartDropdown.querySelector(".cart-title");
        const cartList = cartDropdown.querySelector(".cart-items");
        const cartEmpty = cartDropdown.querySelector(".cart-empty");
        const cartListSection = cartDropdown.querySelector(".cart-list");
        const cartFooter = cartDropdown.querySelector(".cart-footer");

        // Update title with item count
        cartTitle.textContent = `Cart (${cartItems.length} item${cartItems.length !== 1 ? "s" : ""})`;

        // Toggle between empty and list view
        if (cartItems.length === 0) {
            cartEmpty.style.display = "flex";
            cartListSection.style.display = "none";
            cartFooter.style.display = "none";
        } else {
            cartEmpty.style.display = "none";
            cartListSection.style.display = "block";
            cartFooter.style.display = "flex";

            // Populate cart items dynamically
            cartList.innerHTML = cartItems
                .map((item, index) => `
                    <li class="cart-item px-5" data-index="${index}">
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
        cartDropdown.querySelectorAll(".remove-button").forEach((btn) => {
            btn.addEventListener("click", function (event) {
                event.stopPropagation();
                removeFromCart(parseInt(this.dataset.index, 10), cartDropdown);
            });
        });
    }

    /***********************************************
     * Remove Item from Cart and Update UI
     ***********************************************/
    function removeFromCart(index, cartDropdown) {
        const cartCookie = getCookie("lookbook");
        let cartItems = cartCookie ? JSON.parse(cartCookie) : [];

        if (cartItems[index]) {
            cartItems.splice(index, 1); // Remove item
            setCookie("lookbook", JSON.stringify(cartItems), 7); // Update cookie
            updateCartUI(cartDropdown); // Re-render UI
        }

        // updateCartCounter(); // Refresh cart count (if any)
        updateButtonStyles();    // Sync styles with changes
        refreshButtonStyles();   // Optional additional UI refresh
    }
});
