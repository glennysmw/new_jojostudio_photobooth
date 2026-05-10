// Smooth fade-out before navigation. Used across all pages.
function redirectWithTransition(url) {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        backgroundColor: "#2D2D44",
        opacity: "0",
        transition: "opacity 320ms cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: "9999",
        pointerEvents: "none"
    });
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = "1";
    });

    setTimeout(() => {
        window.location.href = url;
    }, 350);
}