(function () {
    const IFRAME_ORIGIN = 'https://nuxt.gemnote.com';
    const iframe = document.getElementById('gemnote-nav');
    const BASE_HEIGHT = '50%';

    const setHeight = (h) => {
        if (!iframe) return;
        iframe.style.height = typeof h === 'number' ? `${h}px` : h;
    };

    // optional: smooth it out
    iframe && (iframe.style.transition = 'height 200ms ease');

    setHeight(BASE_HEIGHT);

    window.addEventListener('message', (event) => {
        // only trust the nav iframe
        if (event.origin !== IFRAME_ORIGIN) return;
        if (!iframe || event.source !== iframe.contentWindow) return;

        const {type, height, state} = event.data || {};

        // Support the messages you’re seeing now
        if (type === 'NAVBAR_HEIGHT' && typeof height === 'number') {
            setHeight(height);
            return;
        }

        // Treat subscription modal as “overlay open”
        if (type === 'SUBSCRIPTION_HEIGHT') {
            // Option A: Force full screen
            setHeight('100%');
            return;

            // Option B: Use provided pixel height instead:
            // if (typeof height === 'number') setHeight(height);
        }

        // Back-compat if/when you add the overlay messages later
        if (type === 'gn-overlay') {
            setHeight(state === 'open' ? '100%' : BASE_HEIGHT);
        }
    });
})();
