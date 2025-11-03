/***********************************************
 * Cart Dropdown (IndexedDB)
 * DB: gemnote-marketplace
 * Store: pinia (keyPath: "key")
 * Record key: "cart"
 * Value: localCartItems (ARRAY of items)
 ***********************************************/
(function () {
    // Boot no matter when this loads
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }

    function boot() {
        updateCartCounter().catch(() => {});

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

        // Delegation fallback: init on first click if added late
        document.addEventListener("click", (e) => {
            const trigger = e.target.closest?.(".cart-block");
            if (!trigger || trigger.__cartInit) return;
            initCartForBlock(trigger);
            trigger.click();
        });
    }


    /************** Counter Helper **************/
    async function updateCartCounter() {
        try {
            const state = await getCartState();
            const items = getItemsFromState(state);
            const cartCounter = document.getElementById("cart-counter");
            if (cartCounter) cartCounter.innerText = String(items.length || 0);
        } catch {}
    }

    /************** IndexedDB Helpers **************/
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

    // ✅ Ensures we resolve to the fn(store) VALUE, not a pending Promise
    async function withStore(mode, fn) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            const store = tx.objectStore(STORE_NAME);
            let value;
            Promise.resolve()
                .then(() => fn(store))
                .then((v) => { value = v; })
                .catch((err) => { try { tx.abort(); } catch {} reject(err); });
            tx.oncomplete = () => resolve(value);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }

    // Read localCartItems (array) or legacy shapes
    async function getCartState() {
        try {
            const record = await withStore("readonly", (store) => {
                return new Promise((resolve, reject) => {
                    const getReq = store.get(RECORD_KEY);
                    getReq.onsuccess = () => resolve(getReq.result || null);
                    getReq.onerror = () => reject(getReq.error);
                });
            });
            if (!record) return null;
            if (record.localCartItems) return record.localCartItems; // modern
            if (Array.isArray(record)) return record;                 // direct array dump
            // legacy nested
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
        if (Array.isArray(state)) return state; // modern array
        if (Array.isArray(state?.localCartItems)) return state.localCartItems;
        return state?.cart?.attributes?.cart_details_json?.product_details?.items ?? [];
    }

    function getItemQuantity(item) {
        if (Array.isArray(item?.size_qty)) {
            return item.size_qty.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
        }
        return Number(item?.quantity) || 0;
    }

    function getItemColor(item) {
        const sc = item?.selected_color;
        if (sc && (sc.value || sc.color_code)) return { value: sc.value || "", color_code: sc.color_code || "" };
        const color = item?.option_values?.Color;
        if (color && (color.value || color.color_code)) return { value: color.value || "", color_code: color.color_code || "" };
        return { value: "", color_code: "" };
    }

    function getItemImage(item) {
        const m = item?.images?.manifest;
        if (Array.isArray(m) && m.length) {
            return m[0]?.srcs?.thumb || m[0]?.srcs?.medium || m[0]?.srcs?.large || "";
        }
        return item?.manifest?.[0]?.thumb || item?.image || "";
    }

    /************** UI **************/
    function initCartForBlock(cartBlock) {
        if (cartBlock.__cartInit) return;
        cartBlock.__cartInit = true;

        const cartDropdown = document.createElement("div");
        cartDropdown.className = "cart-dropdown";
        cartDropdown.style.display = "none";
        cartDropdown.innerHTML = `
      <div class="cart-header cart-px-5">
        <h3 class="cart-title">Cart (0 items)</h3>
        <img class="cart-cursor-pointer close-dropdown" src="https://www.gemnote.com/images/common/cross.svg" alt="Close cart">
      </div>
      <div class="cart-empty cart-px-5">
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
      <div class="cart-list cart-px-5" style="display: none;">
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

        // === Anchor selection ===
        // Mobile: prefer .mobile-cart-block; Desktop: header/nav/site header; Fallback: offsetParent/parent/body
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const mobileAnchor = document.querySelector(".mobile-cart-block") || cartBlock.closest(".mobile-cart-block");
        const desktopAnchor = cartBlock.closest("header, nav, .navbar, .site-header, .cart-anchor") || cartBlock.offsetParent;
        const anchor = (isMobile && mobileAnchor) || desktopAnchor || cartBlock.parentNode || document.body;

        // Ensure positioned ancestor for absolute children
        if (anchor instanceof HTMLElement && getComputedStyle(anchor).position === "static") {
            anchor.style.position = "relative";
        }

        // Append dropdown to the chosen anchor (NOT to a tiny wrapper)
        anchor.appendChild(cartDropdown);

        // Toggle
        cartBlock.addEventListener("click", async function (event) {
            // Prevent navigation if the trigger is an <a>
            if (event.target.closest("a")) event.preventDefault();
            event.stopPropagation();

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

        // Initial paint
        updateCartUI(cartDropdown).catch(()=>{});
    }

    function closeOtherDropdowns(currentDropdown) {
        document.querySelectorAll(".cart-dropdown").forEach((dd) => {
            if (dd !== currentDropdown) dd.style.display = "none";
        });
    }

    /************** Render **************/
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

        cartList.innerHTML = items.map((item, index) => {
            const name = item?.name || item?.product_name || "Untitled";
            const brand = item?.brand_name || "";
            const { value: colorName, color_code } = getItemColor(item);
            const price = item?.unit_price ?? item?.price ?? 0;
            const img = getItemImage(item);
            const qty = getItemQuantity(item);

            return `
        <li class="cart-item cart-px-5" data-index="${index}">
          <div class="cart-list-container cart-gap-4 cart-mt-7">
            <div class="list-sub-container">
              <div class="cart-image-wrapper">
                <img class="object-cover cart-image-container" src="${img}" alt="${name}">
              </div>
              <div class="cart-flex cart-flex-col cart-justify-evenly cart-lg:gap-[3px] cart-gap-[2px]">
                <h3 class="cart-item-heading">${name}</h3>
                ${brand ? `<p class="cart-font-inter item-brand">${brand}</p>` : ""}
                <p class="cart-font-inter item-option">Color: ${colorName || ""}
                  <span class="color-swatch" style="background-color:${color_code || "transparent"}"></span>
                </p>
                <p class="item-option">Quantity: ${qty}</p>
                <p class="item-option">$ <strong>${Number(price) || 0}</strong></p>
              </div>
            </div>
            <p class="cart-font-inter cart-remove-button cart-cursor-pointer" data-index="${index}">remove</p>
          </div>
        </li>
      `;
        }).join("");

        // bind removes
        cartDropdown.querySelectorAll(".cart-remove-button").forEach((btn) => {
            btn.addEventListener("click", async function (event) {
                event.stopPropagation();
                const idx = parseInt(this.dataset.index, 10);
                const current = await getCartState();
                const currentItems = getItemsFromState(current);
                if (!Array.isArray(currentItems) || !currentItems[idx]) return;

                const next = currentItems.slice(0, idx).concat(currentItems.slice(idx + 1));
                await setCartState(next);
                await updateCartCounter();
                await updateCartUI(cartDropdown);
            });
        });
    }
})();
