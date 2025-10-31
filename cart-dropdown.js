/***********************************************
 * Cart Dropdown (IndexedDB)
 * DB: gemnote-marketplace
 * Store: pinia (keyPath: "key")
 * Record key: "cart"
 * Value: localCartItems (ARRAY of items)
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
      const out = fn(store);
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Returns the value we should render against (localCartItems array if present)
  async function getCartState() {
    try {
      const record = await withStore("readonly", (store) => {
        return new Promise((resolve, reject) => {
          const getReq = store.get(RECORD_KEY);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => reject(getReq.error);
        });
      });
      // Prefer the modern structure: { key: "cart", localCartItems: [...] }
      if (record?.localCartItems) return record.localCartItems;
      // Fallback: sometimes entire array was stored directly as value
      if (Array.isArray(record)) return record;
      // Legacy fallback: old nested schema
      return record?.cart?.attributes?.cart_details_json?.product_details?.items ?? null;
    } catch {
      return null;
    }
  }

  async function setCartState(nextItemsArray) {
    try {
      await withStore("readwrite", (store) => {
        return new Promise((resolve, reject) => {
          const putReq = store.put({ key: RECORD_KEY, localCartItems: nextItemsArray });
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = () => reject(putReq.error);
        });
      });
    } catch {}
  }

  /************** Shape Helpers **************/
  function getItemsFromState(state) {
    if (!state) return [];
    // If state is already the array (from modern structure), use it
    if (Array.isArray(state)) return state;
    // If it’s an object with localCartItems
    if (Array.isArray(state.localCartItems)) return state.localCartItems;
    // Legacy fallback
    return state?.cart?.attributes?.cart_details_json?.product_details?.items ?? [];
  }

  function getItemQuantity(item) {
    if (Array.isArray(item?.size_qty)) {
      return item.size_qty.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    }
    return Number(item?.quantity) || 0;
  }

  function getItemColor(item) {
    // Could be item.selected_color or variants/option_values.Color
    const sc = item?.selected_color;
    if (sc && (sc.value || sc.color_code)) return { value: sc.value || "", color_code: sc.color_code || "" };
    const color = item?.option_values?.Color;
    if (color && (color.value || color.color_code)) return { value: color.value || "", color_code: color.color_code || "" };
    return { value: "", color_code: "" };
  }

  function getItemImage(item) {
    // Prefer images.manifest[0].srcs.thumb like your data
    const m = item?.images?.manifest;
    if (Array.isArray(m) && m.length > 0) {
      return m[0]?.srcs?.thumb || m[0]?.srcs?.medium || m[0]?.srcs?.large || "";
    }
    return "";
  }

  function getItemPrice(item) {
    const p = item?.unit_price ?? item?.price;
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  }

  /************** DOM Mount Points **************/
  const cartBlocks = document.querySelectorAll(".cart-block");
  const mobileNavMenu = document.querySelector(".mobile-cart-block");
  if (cartBlocks.length === 0) return;

  cartBlocks.forEach((cartBlock) => {
    // Ensure the anchor parent can position the dropdown correctly
    if (!cartBlock.classList.contains("cart-block-wrapper")) {
      const wrapper = document.createElement("div");
      wrapper.className = "cart-block-wrapper";
      wrapper.style.position = "relative";
      cartBlock.parentNode.insertBefore(wrapper, cartBlock);
      wrapper.appendChild(cartBlock);
    }

    const cartDropdown = document.createElement("div");
    cartDropdown.classList.add("cart-dropdown");
    cartDropdown.style.display = "none";
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

    // Attach dropdown right under the wrapper (which is relative)
    const wrapper = cartBlock.parentElement;
    wrapper.appendChild(cartDropdown);

    /************** Toggle & Events **************/
    cartBlock.addEventListener("click", async function (event) {
      event.stopPropagation();
      if (mobileNavMenu) mobileNavMenu.style.display = "none";
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

    // Initial paint
    updateCartUI(cartDropdown);
  });

  function closeOtherDropdowns(currentDropdown) {
    document.querySelectorAll(".cart-dropdown").forEach((dd) => {
      if (dd !== currentDropdown) dd.style.display = "none";
    });
  }

  /************** UI Render **************/
  async function updateCartUI(cartDropdown) {
    const state = await getCartState();
    const items = getItemsFromState(state);

    const cartTitle = cartDropdown.querySelector(".cart-title");
    const cartList = cartDropdown.querySelector(".cart-items");
    const cartEmpty = cartDropdown.querySelector(".cart-empty");
    const cartListSection = cartDropdown.querySelector(".cart-list");
    const cartFooter = cartDropdown.querySelector(".cart-footer");
    const cartCounter = document.getElementById("cart-counter");

    const distinctCount = items.length;
    if (cartCounter) cartCounter.innerText = String(distinctCount || 0);
    cartTitle.textContent = `Cart (${distinctCount} item${distinctCount !== 1 ? "s" : ""})`;

    if (!distinctCount) {
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
        const name = item?.name || item?.product_name || "Untitled";
        const brand = item?.brand_name || "";
        const { value: colorName, color_code } = getItemColor(item);
        const price = getItemPrice(item);
        const img = getItemImage(item);
        const qty = getItemQuantity(item);

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
                  <p class="font-inter item-option">Color: ${colorName || ""}
                    <span class="color-swatch" style="background-color:${color_code || "transparent"}"></span>
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

    // bind removes
    cartDropdown.querySelectorAll(".remove-button").forEach((btn) => {
      btn.addEventListener("click", async function (event) {
        event.stopPropagation();
        await removeFromCart(parseInt(this.dataset.index, 10), cartDropdown);
      });
    });
  }

  /************** Remove **************/
  async function removeFromCart(index, cartDropdown) {
    const state = await getCartState();
    const items = getItemsFromState(state);
    if (!Array.isArray(items) || !items[index]) return;

    // create new array and persist
    const next = items.slice();
    next.splice(index, 1);
    await setCartState(next);
    await updateCartUI(cartDropdown);

    if (typeof updateButtonStyles === "function") updateButtonStyles();
    if (typeof refreshButtonStyles === "function") refreshButtonStyles();
  }

  // Debug helper you can paste in console to inspect current record
  window.__dumpPiniaCart = function () {
    indexedDB.open("gemnote-marketplace", 1).onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction("pinia", "readonly");
      tx.objectStore("pinia").get("cart").onsuccess = ({ target }) => {
        console.log("cart record:", target.result);
        console.log("localCartItems:", target.result?.localCartItems);
        console.log("first derived item:", Array.isArray(target.result?.localCartItems) ? target.result.localCartItems[0] : null);
      };
    };
  };
});
