const searchForm = document.getElementById("email-form");
const searchSubmitBtn = searchForm?.querySelector('input[type="submit"]');
const searchBarInput = document.getElementById("desktop-navbar-searchbar");

const handleSearchProducts = async () => {
    const originalBtnValue = searchSubmitBtn?.value;
    if (searchSubmitBtn) {
        searchSubmitBtn.value = "Searching...";
        searchSubmitBtn.disabled = true;
    }

    try {
        console.log(searchBarInput.value);
        searchBarInput.value = "";
    } catch (err) {
        console.log(err);
    } finally {
        if (searchSubmitBtn) {
            searchSubmitBtn.disabled = false;
            searchSubmitBtn.value = originalBtnValue || "Search";
        }
    }
};

const attachSearchForm = () => {
    if (!searchForm) return;
    searchForm.addEventListener(
        "submit",
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
            handleSearchProducts();
        },
        { capture: true }
    );
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachSearchForm);
} else {
    attachSearchForm();
}
