// ============================================================
// JOJO.STUDIO — photobooth.html capture logic
// ============================================================

const TOTAL_PHOTOS = 4;
const COUNTDOWN_SECONDS = 5;
const PHOTO_PAUSE_MS = 2500; // breathing room between photos
const CHEESE_HOLD_MS = 700; // how long "Cheese!" stays on screen after capture
const CHEESE_TO_SHUTTER_MS = 250; // pause between "Cheese!" appearing and shutter firing
const RING_CIRCUMFERENCE = 289; // 2π * r where r=46

// DOM
const video = document.getElementById("video");
const countdownCircle = document.getElementById("countdown-circle");
const countdownEl = document.getElementById("countdown");
const ringProgress = document.querySelector(".ring-progress");
const statusBanner = document.getElementById("status-banner");
const shutterFlash = document.getElementById("shutter-flash");
const dots = document.querySelectorAll(".progress-dots .dot");
const startGate = document.getElementById("start-gate");
const startCard = document.getElementById("start-card");
const tapToStartBtn = document.getElementById("tap-to-start-btn");

// Audio (preloaded for tighter sync)
const shutterSound = new Audio("shutter.mp3");
const countdownSound = new Audio("countdown.mp3");
[shutterSound, countdownSound].forEach((a) => {
    a.preload = "auto";
    a.load();
});

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

// Status messages — updated each photo
const STATUS_MESSAGES = [
    "Photo 1 of 4 — strike a pose!",
    "Photo 2 of 4 — looking good!",
    "Photo 3 of 4 — keep it going!",
    "Last one — make it count ✨"
];

// Friendly between-shot messages while the user resets their pose
const BETWEEN_MESSAGES = [
    "Nice! Switch it up for photo 2 ✨",
    "Love it! Pose 3 coming up ✨",
    "One more — bring it home ✨"
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

function showCountdown(value, isCheese = false) {
    countdownEl.textContent = value;
    countdownEl.classList.remove("tick", "cheese");
    void countdownEl.offsetWidth; // force reflow so the animation re-triggers
    countdownEl.classList.add(isCheese ? "cheese" : "tick");
    countdownCircle.classList.add("visible");
}

function hideCountdown() {
    countdownCircle.classList.remove("visible");
}

// Smooth continuous drain of the SVG ring over the given number of seconds.
function startRingDrain(seconds) {
    if (!ringProgress) return;
    // Reset to full instantly
    ringProgress.style.transition = "none";
    ringProgress.style.strokeDashoffset = "0";
    // Force reflow so the reset takes effect before we start the animation
    ringProgress.getBoundingClientRect();
    // Drain to empty over `seconds`
    ringProgress.style.transition = `stroke-dashoffset ${seconds}s linear`;
    ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
}

function resetRing() {
    if (!ringProgress) return;
    ringProgress.style.transition = "none";
    ringProgress.style.strokeDashoffset = "0";
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
    startRingDrain(COUNTDOWN_SECONDS);
    playSound(countdownSound);

    const interval = setInterval(() => {
        timeLeft--;

        if (timeLeft >= 1) {
            // 4, 3, 2, 1 — beep + visual snap
            showCountdown(timeLeft);
            playSound(countdownSound);
        } else {
            // timeLeft hit 0 — say "Cheese!" then capture
            clearInterval(interval);
            showCountdown("Cheese!", true);
            setTimeout(() => {
                triggerShutter();
                capturePhoto();
            }, CHEESE_TO_SHUTTER_MS);
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

    const isLast = capturedCount >= TOTAL_PHOTOS;

    // After "Cheese!" sits for a moment, hide it and update status
    setTimeout(() => {
        hideCountdown();
        resetRing();
        if (isLast) {
            setStatus("All done! ✨ Saving your strip...");
        } else {
            setStatus(BETWEEN_MESSAGES[capturedCount - 1]);
        }
    }, CHEESE_HOLD_MS);

    // Continue: either finish or start next countdown after the pause
    if (isLast) {
        setTimeout(finishSession, 1800);
    } else {
        setTimeout(capturePhotoWithCountdown, PHOTO_PAUSE_MS);
    }
}

function finishSession() {
    sessionStorage.setItem("capturedPhotos", JSON.stringify(capturedPhotos));
    setTimeout(() => {
        if (typeof redirectWithTransition === "function") {
            redirectWithTransition("download.html");
        } else {
            window.location.href = "download.html";
        }
    }, 400);
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