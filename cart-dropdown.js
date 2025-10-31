(function () {
  // Boot now or on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  function boot() {
    document.querySelectorAll(".cart-block").forEach(initCartForBlock);

    // Observe late-added triggers (SPA/Vue/Webflow)
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches?.(".cart-block")) initCartForBlock(node);
          node.querySelectorAll?.(".cart-block").forEach(initCartForBlock);
        });
      });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Delegation fallback
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest?.(".cart-block");
      if (!trigger || trigger.__cartInit) return;
      initCartForBlock(trigger);
      trigger.click();
    });
  }

  /************ IndexedDB helpers ************/
  const DB_NAME = "gemnote-marketplace";
  const STORE_NAME = "pinia";
  const RECORD_KEY = "cart";

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

  // ✅ FIXED: resolves to the inner value returned by fn(store), not the Promise itself
  async function withStore(mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let value;
      // capture the result of fn(store) once fulfilled
      Promise.resolve()
        .then(() => fn(store))
        .then((v) => { value = v; })
        .catch((err) => { try { tx.abort(); } catch {} reject(err); });
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Supports both {localCartItems: state} and direct dump on the cart record
  async function getCartState() {
    try {
      const record = await withStore("readonly", (store) => {
        return new Promise((resolve, reject) => {
          const req = store.get(RECORD_KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      });
      if (!record) return null;
      if (record.localCartItems) return record.localCartItems;

      // fallback: treat remaining fields (except key) as the dump
      const clone = { ...record };
      delete clone.key;
      return Object.keys(clone).length ? clone : null;
    } catch {
      return null;
    }
  }

  async function setCartState(state) {
    try {
      await withStore("readwrite", (store) => {
        return new Promise((resolve, reject) => {
          const putReq = store.put({ key: RECORD_KEY, localCartItems: state });
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = () => reject(putReq.error);
        });
      });
    } catch {}
  }

  // Optional cookie → IDB migration
  (async function migrateLookbookCookieOnce() {
    try {
      const existing = await getCartState();
      if (existing) return;
      const c = document.cookie.split("; ").find((r) => r.startsWith("lookbook="));
      if (!c) return;
      const val = decodeURIComponent(c.split("=")[1]);
      try {
        const parsed = JSON.parse(val);
        await setCartState(parsed);
        document.cookie = "lookbook=; Max-Age=0; path=/";
      } catch {}
    } catch {}
  })();

  /************ State helpers ************/
  function getItemsFromState(state) {
    return state?.cart?.attributes?.cart_details_json?.product_details?.items ?? [];
  }

  function setItemsInState(state, newItems) {
    if (!state?.cart?.attributes?.cart_details_json?.product_details) return state;
    state.cart.attributes.cart_details_json.product_details.items = newItems;
    try {
      state.cart.attributes.updated_at = new Date().toISOString();
    } catch {}
    return state;
  }

  function pickImageForItem(item) {
    return item?.manifest?.[0]?.thumb;
  }

  function getItemQuantity(item) {
    if (Array.isArray(item?.size_qty)) {
      return item.size_qty.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    }
    return Number(item?.quantity) || 0;
  }

  /************ UI wiring ************/
  function initCartForBlock(cartBlock) {
    if (!cartBlock || cartBlock.__cartInit) return;
    cartBlock.__cartInit = true;

    const cartDropdown = document.createElement("div");
    cartDropdown.className = "cart-dropdown";
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

    // Anchor selection (desktop vs mobile)
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const mobileAnchor =
      document.querySelector(".mobile-cart-block") ||
      cartBlock.closest(".mobile-cart-block");
    const desktopAnchor =
      cartBlock.closest("header, nav, .navbar, .site-header, .cart-anchor") ||
      cartBlock.offsetParent;
    const anchor =
      (isMobile && mobileAnchor) || desktopAnchor || cartBlock.parentNode || document.body;

    if (anchor instanceof HTMLElement && getComputedStyle(anchor).position === "static") {
      anchor.style.position = "relative";
    }

    anchor.appendChild(cartDropdown);

    // Toggle
    cartBlock.addEventListener("click", async function (e) {
      if (e.target.closest("a")) e.preventDefault();
      e.stopPropagation();

      closeOtherDropdowns(cartDropdown);
      cartDropdown.style.display = (cartDropdown.style.display === "none") ? "flex" : "none";
      await updateCartUI(cartDropdown);
    });

    // Close button
    cartDropdown.querySelector(".close-dropdown").addEventListener("click", function () {
      cartDropdown.style.display = "none";
    });

    // Click-away close
    document.addEventListener("click", function (event) {
      if (!cartBlock.contains(event.target) && !cartDropdown.contains(event.target)) {
        cartDropdown.style.display = "none";
      }
    });

    // Initial render
    updateCartUI(cartDropdown).catch(()=>{});
  }

  function closeOtherDropdowns(currentDropdown) {
    document.querySelectorAll(".cart-dropdown").forEach((dropdown) => {
      if (dropdown !== currentDropdown) dropdown.style.display = "none";
    });
  }

  /************ Render Cart UI ************/
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
    if (cartCounter) cartCounter.innerText = distinctCount.toString() || "0";
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

    cartList.innerHTML = items.map((item, index) => {
      const name = item?.name ?? "Untitled";
      const brand = item?.brand_name ?? "";
      const options = item?.selected_color ?? {};
      const price = Number(item?.unit_price) || 0;
      const img = item?.images?.manifest?.[0]?.srcs?.thumb || pickImageForItem(item) || "";
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
    }).join("");

    // Bind remove buttons
    cartDropdown.querySelectorAll(".remove-button").forEach((btn) => {
      btn.addEventListener("click", async function (event) {
        event.stopPropagation();
        const idx = parseInt(this.dataset.index, 10);
        const current = await getCartState();
        if (!current) return;
        const existing = getItemsFromState(current);
        if (!Array.isArray(existing)) return;
        const updated = setItemsInState(current, existing.filter((_, i) => i !== idx));
        await setCartState(updated);
        await updateCartUI(cartDropdown);
      });
    });
  }
})();
