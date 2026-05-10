// ============================================================
// JOJO.STUDIO — download.html: photo strip composition
// ============================================================

const finalCanvas = document.getElementById("finalCanvas");
const ctx = finalCanvas.getContext("2d");
const downloadBtn = document.getElementById("download-btn");
const colorButtons = document.querySelectorAll(".color-btn");

let selectedFrameColor = "img/nude.jpg";

let capturedPhotos = JSON.parse(sessionStorage.getItem("capturedPhotos")) || [];

if (capturedPhotos.length === 0) {
    console.error("No photos found in sessionStorage.");
}

// Higher-resolution canvas for crisper downloads
const canvasWidth = 400;
const imageHeight = 270;
const spacing = 16;
const framePadding = 16;
const logoSpace = 120;

finalCanvas.width = canvasWidth;
finalCanvas.height = framePadding + (imageHeight + spacing) * capturedPhotos.length + logoSpace;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
    });
}

// ------------------------------------------------------------
// Drawing
// ------------------------------------------------------------

async function drawCollage() {
    try {
        const results = await Promise.all([
            loadImage(selectedFrameColor),
            ...capturedPhotos.map((p) => loadImage(p)),
            loadImage("img2/LogoPrint.png")
        ]);

        const background = results[0];
        const logo = results[results.length - 1];
        const photos = results.slice(1, -1);

        ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
        ctx.drawImage(background, 0, 0, finalCanvas.width, finalCanvas.height);

        photos.forEach((img, index) => {
            const x = framePadding;
            const y = framePadding + index * (imageHeight + spacing);
            ctx.drawImage(img, x, y, canvasWidth - 2 * framePadding, imageHeight);
        });

        drawLogo(logo);
    } catch (err) {
        console.error(err);
    }
}

function drawLogo(logo) {
    const logoWidth = 160;
    const logoHeight = 40;
    const logoX = (canvasWidth - logoWidth) / 2;
    const logoY = finalCanvas.height - logoSpace + 50;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
}

// ------------------------------------------------------------
// Frame selection
// ------------------------------------------------------------

function selectFrame(button) {
    colorButtons.forEach((b) => b.classList.remove("selected"));
    button.classList.add("selected");
    selectedFrameColor = button.getAttribute("data-color");
    drawCollage();
}

colorButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
        selectFrame(event.currentTarget);
    });
});

// Mark the default frame as selected on load
const defaultBtn = document.querySelector(`.color-btn[data-color="${selectedFrameColor}"]`);
if (defaultBtn) defaultBtn.classList.add("selected");

// ------------------------------------------------------------
// Download
// ------------------------------------------------------------

const ORIGINAL_DOWNLOAD_HTML = downloadBtn.innerHTML;

downloadBtn.addEventListener("click", () => {
    if (downloadBtn.classList.contains("downloading")) return;

    downloadBtn.classList.add("downloading");
    downloadBtn.innerHTML = "Saving...";

    // Tiny delay so the user sees the feedback
    setTimeout(() => {
        const link = document.createElement("a");
        link.href = finalCanvas.toDataURL("image/png");
        link.download = `jojostudio-strip-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        downloadBtn.innerHTML = "Saved! ✨";

        setTimeout(() => {
            downloadBtn.classList.remove("downloading");
            downloadBtn.innerHTML = ORIGINAL_DOWNLOAD_HTML;
        }, 1400);
    }, 200);
});

// ------------------------------------------------------------
// Initial render
// ------------------------------------------------------------

drawCollage();