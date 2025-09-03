const form = document.getElementById("email-form");
const submitBtn = form?.querySelector('input[type="submit"]');
const searchInput = document.getElementById("desktop-navbar-searchbar");


const submitSubscription = async () => {
    const originalBtnValue = submitBtn?.value;
    if (submitBtn) submitBtn.value = waitText;
    if (submitBtn) submitBtn.disabled = true;

    try {
        console.log(searchInput.value)
        searchInput.value = "";
    } catch (err) {
        console.log(err);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.value = originalBtnValue || "subscribe";
        }
    }
};

const attach = () => {
    if (!form) return;

    // capture: true runs before Webflow’s own listener
    form.addEventListener(
        "submit",
        (e) => {
            e.preventDefault();
            // block all other submit listeners (incl. Webflow’s)
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === "function") {
                e.stopImmediatePropagation();
            }
            submitSubscription();
        },
        { capture: true }
    );
};


// be safe about timing in Webflow
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
} else {
    attach();
}