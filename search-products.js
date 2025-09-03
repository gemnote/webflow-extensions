const searchForm = document.getElementById("email-form");
const searchSubmitBtn = searchForm?.querySelector('input[type="submit"]');
const searchBarInput = document.getElementById("desktop-navbar-searchbar");
const searchCloseIcon = document.getElementById("search-bar-close-icon");

const handleSearchProducts = async () => {
    const originalBtnValue = searchSubmitBtn?.value;
    if (searchSubmitBtn) {
        searchSubmitBtn.value = "Searching...";
        searchSubmitBtn.disabled = true;
    }

    try {
        console.log(searchBarInput.value);
        searchBarInput.value = "";
        toggleCloseIcon(); // hide close icon after clearing input
    } catch (err) {
        console.log(err);
    } finally {
        if (searchSubmitBtn) {
            searchSubmitBtn.disabled = false;
            searchSubmitBtn.value = originalBtnValue || "Search";
        }
    }
};

// Show/hide the close icon based on input value
const toggleCloseIcon = () => {
    if (!searchCloseIcon) return;
    searchCloseIcon.style.display = searchBarInput.value.trim() ? "block" : "none";
};

// Attach form logic
const attachSearchForm = () => {
    if (!searchForm) return;

    // Stop form submission completely
    searchForm.addEventListener(
        "submit",
        (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
            handleSearchProducts();
            return false;
        },
        { capture: true }
    );

    // Stop Enter key default behavior separately
    searchBarInput?.addEventListener(
        "keydown",
        (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopImmediatePropagation();
                e.stopPropagation();
                handleSearchProducts();
                return false;
            }
        },
        { capture: true }
    );

    // Watch for input changes to show/hide close button
    searchBarInput?.addEventListener("input", toggleCloseIcon);

    // Handle close icon click to clear input and hide icon
    searchCloseIcon?.addEventListener("click", () => {
        searchBarInput.value = "";
        toggleCloseIcon();
        searchBarInput.focus();
    });

    // Initially hide the close icon
    toggleCloseIcon();
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachSearchForm);
} else {
    attachSearchForm();
}
