import {isValidEmail} from "./helpers/email-verification";

const form = document.getElementById("email-form");
const subscriptionSuccessText = document.getElementById("subscription-text-success");
const subscriptionErrorText = document.getElementById("subscription-text-error"); // make sure this exists in your HTML
const emailSubscriptionInput = document.getElementById("email-subscription-input");
const submitBtn = form?.querySelector('input[type="submit"]');

// optional: helper to show/hide messages
const show = (el) => el && (el.style.display = "flex");
const hide = (el) => el && (el.style.display = "none");

const submitSubscription = async () => {
    // validate
    if (!isValidEmail(emailSubscriptionInput.value)) {
        show(subscriptionErrorText);
        return;
    }
    hide(subscriptionErrorText);

    // button loading state (uses Webflow's data-wait value if present)
    const originalBtnValue = submitBtn?.value;
    const waitText = submitBtn?.getAttribute("data-wait") || "Please wait...";
    if (submitBtn) submitBtn.value = waitText;
    if (submitBtn) submitBtn.disabled = true;

    try {
        const res = await fetch("https://nuxt.gemnote.com/api/subscribe", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email: emailSubscriptionInput.value}),
        });

        if (!res.ok) {
            // show a generic error if the server responded with an error
            show(subscriptionErrorText);
            return;
        }

        // success UI
        show(subscriptionSuccessText);
        setTimeout(() => hide(subscriptionSuccessText), 300);

        // optional: clear the field
        emailSubscriptionInput.value = "";
    } catch (err) {
        show(subscriptionErrorText);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.value = originalBtnValue || "subscribe";
        }
    }
};

// attach to the form submit
const attach = () => {
    if (!form) return;
    form.addEventListener("submit", (e) => {
        e.preventDefault(); // stop Webflow's default form POST
        submitSubscription();
    });
};

// be safe about timing in Webflow
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
} else {
    attach();
}