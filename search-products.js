const searchForm = document.getElementById("email-form");
const searchSubmitBtn = searchForm?.querySelector('input[type="submit"]');
const searchInputs = [
    document.getElementById("desktop-navbar-searchbar"),
    document.getElementById("mobile-navbar-searchbar")
].filter(Boolean); // filters out nulls if one doesn't exist

const searchCloseIcon = document.getElementById("search-bar-close-icon");

let baseUrl = "https://nuxt.gemnote.com/lookbook?q=";

const debounce = (fn, delay) => {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
};

const handleSearchProducts = async (inputEl) => {
    const query = inputEl?.value?.trim();
    if (!query) return;

    const originalBtnValue = searchSubmitBtn?.value;
    if (searchSubmitBtn) {
        searchSubmitBtn.value = "Searching...";
        searchSubmitBtn.disabled = true;
    }

    try {
        window.location.href = `${baseUrl}${encodeURIComponent(query)}`;
        inputEl.value = "";
        toggleCloseIcon(inputEl);
    } catch (err) {
        console.error(err);
    } finally {
        if (searchSubmitBtn) {
            searchSubmitBtn.disabled = false;
            searchSubmitBtn.value = originalBtnValue || "Search";
        }
    }
};

const debouncedHandleSearchProducts = debounce(handleSearchProducts, 500);

const toggleCloseIcon = (inputEl) => {
    if (!searchCloseIcon) return;
    searchCloseIcon.style.display = inputEl.value.trim() ? "block" : "none";
};

const attachSearchForm = () => {
    if (!searchForm || searchInputs.length === 0) return;

    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        e.stopPropagation();
        searchInputs.forEach((inputEl) => handleSearchProducts(inputEl));
    });

    searchInputs.forEach((inputEl) => {
        inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleSearchProducts(inputEl);
            }
        });

        inputEl.addEventListener("input", () => {
            toggleCloseIcon(inputEl);
            debouncedHandleSearchProducts(inputEl);
        });
    });

    searchCloseIcon?.addEventListener("click", () => {
        searchInputs.forEach((inputEl) => {
            inputEl.value = "";
            toggleCloseIcon(inputEl);
        });
    });

    // Initially hide the close icon
    searchInputs.forEach((inputEl) => toggleCloseIcon(inputEl));
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachSearchForm);
} else {
    attachSearchForm();
}
