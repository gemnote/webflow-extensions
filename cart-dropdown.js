<script>
/***********************************************
 * Cart Dropdown Initialization on Page Load
 * - Now uses IndexedDB:
 *   DB: gemnote-marketplace
 *   Store: pinia (keyPath: "key")
 *   Record key: "cart"
 *   Value field: localCartItems  (your original state)
 ***********************************************/
document.addEventListener("DOMContentLoaded", function () {
  const DB_NAME = "gemnote-marketplace";
  const STORE_NAME = "pinia";
  const RECORD_KEY = "cart";

  /************** IndexedDB Helpers **************/
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function withStore(mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const result = fn(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Read the whole record; we return just the localCartItems for compatibility
  async function getCartState() {
    try {
      const record = await withStore("readonly", (store) => {
        return new Promise((resolve, reject) => {
          const getReq = store.get(RECORD_KEY);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => reject(getReq.error);
        });
      });
      // record shape is { key: "cart", localCartItems: <your previous state object> }
      return record?.localCartItems ?? null;
    } catch {
      return null;
    }
  }

  // Persist your state under { key: "cart", localCartItems: state }
  async function setCartState(state) {
    try {
      await withStore("readwrite", (store) => {
        return new Promise((resolve, reject) => {
          const putReq = store.put({ key: RECORD_KEY, localCartItems: state });
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = () => reject(putReq.error);
        });
      });
    } catch {
      // swallow
    }
  }

  // OPTIONAL one-time migration from old "lookbook" cookie -> IndexedDB "pinia/cart"
  (async function migrateLookbookCookieOnce() {
    try {
      const existing = await getCartState();
      if (existing) return;
      const c = document.cookie.split("; ").find((r) => r.startsWith("lookbook="));
      if (!c) return;
      const val = decodeURIComponent(c.split("=")[1]);
      try {
        const parsed = JSON.parse(val); // ensure valid JSON
        await setCartState(parsed);
        document.cookie = "lookbook=; Max-Age=0; path=/"; // expire cookie
      } catch {
        // ignore invalid cookie
      }
    } catch {}
  })();

  /************** State helpers (unchanged API) **************/
  // Safely pluck items array from your schema
  function getItemsFromState(state) {
    return (
      state?.cart?.attributes?.cart_details_json?.product_details?.items ?? []
    );
  }

  // Safely write items array back into your schema
  function setItemsInState(state, newItems) {
    if (!state?.cart?.attributes?.cart_details_json?.product_details) return state;
    state.cart.attributes.cart_details_json.product_details.items = newItems;
    // Optionally bump updated_at to now (ISO)
    try {
      state.cart.attributes.updated_at = new Date().toISOString();
    } catch {}
    return state;
  }

  // Choose best image
  function pickImageForItem(item) {
    return item?.manifest?.[0].thumb;
  }

  // Total quantity for an item (sum size_qty if present)
  function getItemQuantity(item) {
    if (Array.isArray(item?.size_qty)) {
      return item.size_qty.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    }
    return Number(item?.quantity) || 0;
  }

  /************** DOM Mount Points **************/
  const cartBlocks = document.querySelectorAll(".cart-block");
  const mobileNavMenu = document.querySelector(".mobile-cart-block"); // Mobile navbar container
  if (cartBlocks.length === 0) return;

  cartBlocks.forEach((cartBlock) => {
    /***********************************************
     * Create and Insert Cart Dropdown
     ***********************************************/
    const cartDropdown = document.createElement("div");
    cartDropdown.classList.add("cart-dropdown");
    cartDropdown.innerHTML = `
      <div class="cart-header px-5">
        <h3 class="cart-title">Cart (0 items)</h3>
        <img class="cursor-pointer close-dropdown" src="https://www.gemnote.com/images/common/cross.svg" alt="Close cart">
      </div>
      <div class="cart-empty px-5">
        <h2>You have no products yet.</h2>
        <p>Add new products to the cart!</p>
        <div style="display:flex; justify-content: center;">
          <a href="https://www.gemnote.com/lookbook" class="call-for-action-dark w-inline-block">
            <div class="code-embed w-embed">
              <svg width="12" height="12" viewBox="0 0 12 12" class="call-for-action-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="6" fill="currentColor"></circle>
              </svg>
            </div>
            <div>explore our lookbook</div>
          </a>
        </div>
      </div>
      <div class="cart-list px-5" style="display: none;">
        <ul class="cart-items"></ul>
      </div>
      <div class="cart-footer">
        <a href="https://www.gemnote.com/start-a-project" class="call-for-action w-inline-block">
          <div class="code-embed w-embed">
            <svg width="12" height="12" viewBox="0 0 12 12" class="call-for-action-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <circle cx="6" cy="6" r="6" fill="currentColor"></circle>
            </svg>
          </div>
          <div>view cart</div>
        </a>
        <a href="https://www.gemnote.com/start-a-project" class="call-for-action-dark w-inline-block">
          <div class="code-embed w-embed">
            <svg width="12" height="12" viewBox="0 0 12 12" class="call-for-action-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <circle cx="6" cy="6" r="6" fill="currentColor"></circle>
            </svg>
          </div>
          <div>go to checkout</div>
        </a>
      </div>
    `;

    // Insert dropdown appropriately based on device (mobile or desktop)
    if (mobileNavMenu && mobileNavMenu.contains(cartBlock)) {
      mobileNavMenu.parentNode.insertBefore(cartDropdown, mobileNavMenu.nextSibling);
      cartDropdown.classList.add("mobile-cart-dropdown");
    } else {
      cartBlock.parentNode.appendChild(cartDropdown);
    }

    cartDropdown.style.display = "none";

    /***********************************************
     * Dropdown Toggle & Event Bindings
     ***********************************************/
    cartBlock.addEventListener("click", async function (event) {
      event.stopPropagation();
      if (mobileNavMenu) mobileNavMenu.style.display = "none"; // Hide mobile menu if open
      closeOtherDropdowns(cartDropdown);
      cartDropdown.style.display = cartDropdown.style.display === "flex" ? "none" : "flex";
      await updateCartUI(cartDropdown);
    });

    cartDropdown.querySelector(".close-dropdown").addEventListener("click", function () {
      cartDropdown.style.display = "none";
    });

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
    document.querySelectorAll(".cart-dropdown").forEach((dropdown) => {
      if (dropdown !== currentDropdown) dropdown.style.display = "none";
    });
  }

  /***********************************************
   * Render Cart UI from IndexedDB (pinia/cart)
   ***********************************************/
  async function updateCartUI(cartDropdown) {
    const state = await getCartState();
    const items = getItemsFromState(state);

    const cartTitle = cartDropdown.querySelector(".cart-title");
    const cartList = cartDropdown.querySelector(".cart-items");
    const cartEmpty = cartDropdown.querySelector(".cart-empty");
    const cartListSection = cartDropdown.querySelector(".cart-list");
    const cartFooter = cartDropdown.querySelector(".cart-footer");
    const cartCounter = document.getElementById('cart-counter');

    const distinctCount = items.length;
    if (cartCounter) cartCounter.innerText = distinctCount.toString() || '0';
    cartTitle.textContent = `Cart (${distinctCount} item${distinctCount !== 1 ? "s" : ""})`;

    if (distinctCount === 0) {
      cartEmpty.style.display = "flex";
      cartListSection.style.display = "none";
      cartFooter.style.display = "none";
      cartList.innerHTML = "";
      return;
    }

    cartEmpty.style.display = "none";
    cartListSection.style.display = "block";
    cartFooter.style.display = "flex";

    cartList.innerHTML = items
      .map((item, index) => {
        const name = item?.name ?? "Untitled";
        const brand = item?.brand_name ?? "";
        const options = item?.selected_color ?? [];
        const price = Number(item.unit_price) || 0;
        const img = item?.images?.manifest?.[0]?.srcs?.thumb || "";
        const qty = item?.quantity ?? 0;

        return `
          <li class="cart-item px-5" data-index="${index}">
            <div class="list-container gap-4 mt-7">
              <div class="list-sub-container">
                  <div class="image-wrapper">
                    <img class="object-cover image-container" src="${img}" alt="${name}">
                  </div>
                  <div class="flex flex-col justify-evenly lg:gap-[3px] gap-[2px]">
                    <h3 class="item-heading">${name}</h3>
                    ${brand ? `<p class="font-inter item-brand">${brand}</p>` : ""}
                    <p class="font-inter item-option">Color: ${options.value ?? "" }
                        <span class="color-swatch" style="background-color: ${options.color_code ?? "transparent"}"></span>
                    </p>
                    <p class="item-option">Quantity: ${qty}</p>
                    <p class="item-option">$ <strong>${price}</strong></p>
                  </div>
              </div>
              <p class="font-inter remove-button cursor-pointer" data-index="${index}">remove</p>
            </div>
          </li>
        `;
      })
      .join("");

    // Bind remove events
    cartDropdown.querySelectorAll(".remove-button").forEach((btn) => {
      btn.addEventListener("click", async function (event) {
        event.stopPropagation();
        await removeFromCart(parseInt(this.dataset.index, 10), cartDropdown);
      });
    });
  }

  /***********************************************
   * Remove Item from Cart and Update UI (IndexedDB)
   ***********************************************/
  async function removeFromCart(index, cartDropdown) {
    const state = await getCartState();
    if (!state) return;

    const items = getItemsFromState(state);
    if (!Array.isArray(items) || !items[index]) return;

    items.splice(index, 1);
    await setCartState(setItemsInState(state, items));
    await updateCartUI(cartDropdown);

    // optional UI sync hooks if they exist elsewhere
    if (typeof updateButtonStyles === "function") updateButtonStyles();
    if (typeof refreshButtonStyles === "function") refreshButtonStyles();
  }
});
</script>
