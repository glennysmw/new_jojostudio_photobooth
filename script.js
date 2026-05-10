// ============================================================
// JOJO.STUDIO — photobooth.html capture logic
// ============================================================

const TOTAL_PHOTOS = 4;
const COUNTDOWN_SECONDS = 5;

// DOM
const video = document.getElementById("video");
const countdownCircle = document.getElementById("countdown-circle");
const countdownEl = document.getElementById("countdown");
const statusBanner = document.getElementById("status-banner");
const shutterFlash = document.getElementById("shutter-flash");
const dots = document.querySelectorAll(".progress-dots .dot");
const startGate = document.getElementById("start-gate");
const startCard = document.getElementById("start-card");
const tapToStartBtn = document.getElementById("tap-to-start-btn");

// Audio
const shutterSound = new Audio("shutter.mp3");
const countdownSound = new Audio("countdown.mp3");

// State
const capturedPhotos = [];
let capturedCount = 0;

// Mobile-aware video constraints
const isMobile = window.innerWidth <= 600;
const videoConstraints = {
    video: {
        facingMode: "user",
        width: isMobile ? {
            ideal: 480
        } : {
            ideal: 640
        },
        height: isMobile ? {
            ideal: 640
        } : {
            ideal: 480
        }
    },
    audio: false
};

// Status messages — friendly, encouraging, photo-specific
const STATUS_MESSAGES = [
    "Photo 1 of 4 — strike a pose!",
    "Photo 2 of 4 — looking good!",
    "Photo 3 of 4 — keep it going!",
    "Last one — make it count ✨"
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function playSound(audio) {
    audio.currentTime = 0;
    const p = audio.play();
    if (p !== undefined) p.catch(() => {
        /* autoplay blocked, ignore */ });
}

function setStatus(text) {
    statusBanner.textContent = text;
}

function updateDots() {
    dots.forEach((dot, i) => {
        dot.classList.remove("filled", "current");
        if (i < capturedCount) dot.classList.add("filled");
        else if (i === capturedCount) dot.classList.add("current");
    });
}

function showCountdown(value) {
    countdownEl.textContent = value;
    // Re-trigger the tick animation by toggling the class
    countdownEl.classList.remove("tick");
    void countdownEl.offsetWidth; // force reflow
    countdownEl.classList.add("tick");
    countdownCircle.classList.add("visible");
}

function hideCountdown() {
    countdownCircle.classList.remove("visible");
}

function triggerShutter() {
    shutterFlash.classList.remove("flash");
    void shutterFlash.offsetWidth;
    shutterFlash.classList.add("flash");
    playSound(shutterSound);
}

// ------------------------------------------------------------
// Capture flow
// ------------------------------------------------------------

function capturePhotoWithCountdown() {
    if (capturedCount >= TOTAL_PHOTOS) {
        finishSession();
        return;
    }

    setStatus(STATUS_MESSAGES[capturedCount]);
    updateDots();

    let timeLeft = COUNTDOWN_SECONDS;
    showCountdown(timeLeft);
    playSound(countdownSound);

    const interval = setInterval(() => {
        timeLeft--;

        if (timeLeft >= 1) {
            showCountdown(timeLeft);
            playSound(countdownSound);
        }

        if (timeLeft === 1) {
            // Trigger shutter visual + sound at the moment of capture
            setTimeout(() => triggerShutter(), 300);
        }

        if (timeLeft <= 0) {
            clearInterval(interval);
            hideCountdown();
            capturePhoto();
        }
    }, 1000);
}

function capturePhoto() {
    const canvas = document.createElement("canvas");
    canvas.width = isMobile ? 480 : 640;
    canvas.height = isMobile ? 640 : 480;
    const ctx = canvas.getContext("2d");

    // Mirror to match the live preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    capturedPhotos.push(canvas.toDataURL("image/png"));
    capturedCount++;
    updateDots();

    // Brief pause between photos
    setTimeout(capturePhotoWithCountdown, 1100);
}

function finishSession() {
    setStatus("All done! ✨ Saving your strip...");
    sessionStorage.setItem("capturedPhotos", JSON.stringify(capturedPhotos));

    // Smooth fade-out before redirect
    setTimeout(() => {
        if (typeof redirectWithTransition === "function") {
            redirectWithTransition("download.html");
        } else {
            window.location.href = "download.html";
        }
    }, 700);
}

// ------------------------------------------------------------
// Tap-to-start gate
// ------------------------------------------------------------

async function startSession() {
    // Disable the button immediately to prevent double-tap
    tapToStartBtn.disabled = true;
    tapToStartBtn.innerHTML = 'Setting up... <span class="arrow">⋯</span>';

    // 1. Prime audio inside the user-gesture handler (required for iOS)
    [countdownSound, shutterSound].forEach((audio) => {
        audio.muted = true;
        const p = audio.play();
        if (p !== undefined) {
            p.then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;
            }).catch(() => {
                audio.muted = false;
            });
        }
    });

    // 2. Request camera (this is also inside the gesture)
    try {
        const stream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        video.srcObject = stream;

        // Wait for the video to actually be ready before starting
        await new Promise((resolve) => {
            if (video.readyState >= 2) {
                resolve();
            } else {
                video.onloadedmetadata = () => resolve();
            }
        });
        await video.play().catch(() => {});

        // 3. Hide the gate, kick off the countdown
        startGate.classList.add("hidden");
        setTimeout(() => capturePhotoWithCountdown(), 600);
    } catch (err) {
        console.error("Camera access error:", err);
        showCameraError(err);
    }
}

function showCameraError(err) {
    const isPermission =
        err && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
    startCard.innerHTML = `
        <p class="eyebrow">Hmm</p>
        <h2>${isPermission ? "Camera blocked 😢" : "Couldn't reach the camera"}</h2>
        <p class="subtle">
            ${isPermission
                ? "Allow camera access in your browser, then tap Try again."
                : "Make sure you have a camera connected, then tap Try again."}
        </p>
        <button class="primary-btn" id="retry-btn">Try again</button>
    `;
    document.getElementById("retry-btn").addEventListener("click", () => {
        // Reset the card and rebind
        startCard.innerHTML = `
            <p class="eyebrow">JOJO.STUDIO</p>
            <h2>Ready when you are 💕</h2>
            <p class="subtle">
                4 photos · 5-second countdown each.<br>
                Tap below to give the camera and audio permission.
            </p>
            <button class="primary-btn" id="tap-to-start-btn">
                Start shooting <span class="arrow">→</span>
            </button>
        `;
        document.getElementById("tap-to-start-btn").addEventListener("click", startSession);
    });
}

// Init
tapToStartBtn.addEventListener("click", startSession);
updateDots();