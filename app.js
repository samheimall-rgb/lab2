
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const emptyState = document.getElementById("emptyState");
const sampleCanvas = document.getElementById("sampleCanvas");
const crosshair = document.getElementById("crosshair");
const colorSwatch = document.getElementById("colorSwatch");
const colorName = document.getElementById("colorName");
const hexValue = document.getElementById("hexValue");
const copyButton = document.getElementById("copyButton");
const statusMessage = document.getElementById("statusMessage");
const photoHint = document.getElementById("photoHint");
const cameraButton = document.getElementById("cameraButton");
const cameraArea = document.getElementById("cameraArea");
const cameraVideo = document.getElementById("cameraVideo");
const captureButton = document.getElementById("captureButton");
const closeCameraButton = document.getElementById("closeCameraButton");

const ctx = sampleCanvas.getContext("2d", {
  willReadFrequently: true
});

let currentStream = null;
let currentHex = "";
let objectUrl = null;


// =====================================
// PHOTO UPLOAD
// =====================================

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setStatus("Please choose an image file.");
    return;
  }

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }

  objectUrl = URL.createObjectURL(file);

  photoPreview.onload = () => {
    photoPreview.hidden = false;
    emptyState.hidden = true;
    crosshair.hidden = true;

    photoHint.textContent =
      "Tap or click the part of the photo whose color you want to identify.";

    setStatus("Photo ready. Tap a spot to sample its color.");

    resetResult();
  };

  photoPreview.onerror = () => {
    setStatus(
      "That image couldn't be opened. Please try another photo."
    );
  };

  photoPreview.src = objectUrl;

  stopCamera();
});


// =====================================
// SAMPLE A COLOR FROM THE PHOTO
// =====================================

photoPreview.addEventListener("click", (event) => {
  if (photoPreview.hidden || !photoPreview.naturalWidth) {
    return;
  }

  const rect = photoPreview.getBoundingClientRect();

  // Convert the clicked position into image coordinates.
  const x = Math.max(
    0,
    Math.min(
      photoPreview.naturalWidth - 1,
      Math.floor(
        (event.clientX - rect.left) *
        photoPreview.naturalWidth / rect.width
      )
    )
  );

  const y = Math.max(
    0,
    Math.min(
      photoPreview.naturalHeight - 1,
      Math.floor(
        (event.clientY - rect.top) *
        photoPreview.naturalHeight / rect.height
      )
    )
  );

  // Draw the image onto a hidden canvas.
  sampleCanvas.width = photoPreview.naturalWidth;
  sampleCanvas.height = photoPreview.naturalHeight;

  ctx.drawImage(photoPreview, 0, 0);

  // Average a 5-by-5 pixel area for a more stable sample.
  const radius = 2;

  const left = Math.max(0, x - radius);
  const top = Math.max(0, y - radius);

  const width = Math.min(
    photoPreview.naturalWidth - left,
    radius * 2 + 1
  );

  const height = Math.min(
    photoPreview.naturalHeight - top,
    radius * 2 + 1
  );

  const pixels = ctx.getImageData(
    left,
    top,
    width,
    height
  ).data;

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 10) continue;

    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];

    count++;
  }

  if (count === 0) {
    setStatus(
      "Couldn't sample that spot. Please try another area."
    );
    return;
  }

  // Calculate the average RGB values.
  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);

  showColor(r, g, b);

  // Position the crosshair over the selected spot.
  const wrapRect = document
    .getElementById("previewWrap")
    .getBoundingClientRect();

  crosshair.style.left =
    `${event.clientX - wrapRect.left}px`;

  crosshair.style.top =
    `${event.clientY - wrapRect.top}px`;

  crosshair.hidden = false;

  setStatus(
    `Sampled an average of ${count} nearby pixels.`
  );
});


// =====================================
// OPEN LIVE CAMERA
// =====================================

cameraButton.addEventListener("click", openCamera);

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus(
      "Live camera isn't available here. Try choosing or taking a photo instead."
    );

    return;
  }

  try {
    stopCamera();

    // Prefer the rear-facing camera on mobile devices.
    currentStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment"
          }
        },
        audio: false
      });

    cameraVideo.srcObject = currentStream;

    cameraArea.hidden = false;

    cameraButton.textContent = "Camera is open";

    setStatus(
      "Camera is on. Point it at an object and take a photo."
    );

    await cameraVideo.play();

  } catch (error) {
    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      setStatus(
        "Camera permission was denied. Allow camera access in your browser settings, or choose a photo."
      );

    } else if (error.name === "NotFoundError") {
      setStatus(
        "No camera was found. You can still choose a photo."
      );

    } else {
      setStatus(
        "Couldn't open the camera. Make sure the page uses HTTPS and try choosing a photo."
      );
    }
  }
}


// =====================================
// TAKE A PHOTO
// =====================================

captureButton.addEventListener("click", () => {
  if (
    !cameraVideo.videoWidth ||
    !cameraVideo.videoHeight
  ) {
    setStatus(
      "Please wait for the camera preview to appear."
    );

    return;
  }

  sampleCanvas.width = cameraVideo.videoWidth;
  sampleCanvas.height = cameraVideo.videoHeight;

  // Capture the current camera frame.
  ctx.drawImage(
    cameraVideo,
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height
  );

  const imageData =
    sampleCanvas.toDataURL("image/jpeg", 0.92);

  photoPreview.onload = () => {
    photoPreview.hidden = false;
    emptyState.hidden = true;
    crosshair.hidden = true;

    photoHint.textContent =
      "Tap or click the part of the photo whose color you want to identify.";

    resetResult();

    setStatus(
      "Photo captured. Tap a spot in the photo to identify its color."
    );
  };

  photoPreview.src = imageData;

  stopCamera();
});


// =====================================
// STOP CAMERA
// =====================================

closeCameraButton.addEventListener(
  "click",
  stopCamera
);

function stopCamera() {
  if (currentStream) {
    currentStream
      .getTracks()
      .forEach(track => track.stop());

    currentStream = null;
  }

  cameraVideo.srcObject = null;

  cameraArea.hidden = true;

  cameraButton.textContent = "Open live camera";
}


// =====================================
// DISPLAY COLOR RESULTS
// =====================================

function showColor(r, g, b) {
  // Convert RGB values into a HEX color code.
  currentHex =
    "#" +
    [r, g, b]
      .map(value =>
        value.toString(16).padStart(2, "0")
      )
      .join("")
      .toUpperCase();

  // Display the sampled color.
  colorSwatch.style.background = currentHex;

  colorSwatch.setAttribute(
    "aria-label",
    `Selected color ${currentHex}`
  );

  // Display the HEX code and color name.
  hexValue.textContent = currentHex;

  colorName.textContent =
    getColorName(r, g, b);

  copyButton.disabled = false;
}


// =====================================
// RESET RESULTS
// =====================================

function resetResult() {
  currentHex = "";

  colorSwatch.style.background = "";

  colorSwatch.setAttribute(
    "aria-label",
    "No color selected"
  );

  colorName.textContent = "No color yet";

  hexValue.textContent = "HEX —";

  copyButton.disabled = true;
}


// =====================================
// STATUS MESSAGES
// =====================================

function setStatus(message) {
  statusMessage.textContent = message;
}


// =====================================
// COPY HEX CODE
// =====================================

copyButton.addEventListener("click", async () => {
  if (!currentHex) return;

  try {
    await navigator.clipboard.writeText(currentHex);

    setStatus(
      `${currentHex} copied to clipboard.`
    );

  } catch {
    setStatus(
      `Color code: ${currentHex}. You can select and copy it manually.`
    );
  }
});


// =====================================
// EXPANDED COLOR NAME DETECTION
// =====================================
//
// This function uses hue, saturation, and
// lightness to classify colors into more
// detailed categories.
//
// It is rule-based, not AI. Color names
// are estimates rather than guarantees.
//

function getColorName(r, g, b) {
  // Normalize RGB values to a 0-1 range.
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);

  const delta = max - min;

  const lightness = (max + min) / 2;

  const saturation =
    delta === 0
      ? 0
      : delta / (1 - Math.abs(2 * lightness - 1));


  // -------------------------------------
  // BLACK, WHITE, AND GRAY
  // -------------------------------------

  if (max < 0.075) {
    return "Black";
  }

  if (
    lightness > 0.965 &&
    saturation < 0.16
  ) {
    return "White";
  }

  if (saturation < 0.075) {
    if (lightness < 0.20) return "Charcoal";
    if (lightness < 0.36) return "Dark gray";
    if (lightness < 0.62) return "Gray";
    if (lightness < 0.82) return "Light gray";

    return "Silver / very light gray";
  }


  // -------------------------------------
  // CALCULATE HUE
  // -------------------------------------

  let hue;

  if (delta === 0) {
    hue = 0;

  } else if (max === rn) {
    hue = 60 * (((gn - bn) / delta) % 6);

  } else if (max === gn) {
    hue = 60 * ((bn - rn) / delta + 2);

  } else {
    hue = 60 * ((rn - gn) / delta + 4);
  }

  if (hue < 0) {
    hue += 360;
  }


  // -------------------------------------
  // BROWN, TAN, BEIGE, CREAM, AND IVORY
  // -------------------------------------

  if (
    hue >= 15 &&
    hue < 50 &&
    lightness < 0.48 &&
    saturation < 0.72
  ) {
    if (lightness < 0.22) return "Dark brown";
    if (lightness < 0.34) return "Brown";

    return "Chestnut brown";
  }

  if (
    hue >= 15 &&
    hue < 52 &&
    lightness > 0.48 &&
    saturation < 0.58
  ) {
    if (lightness > 0.88) return "Ivory";
    if (lightness > 0.75) return "Cream";
    if (lightness > 0.62) return "Beige";

    return "Tan";
  }


  // -------------------------------------
  // LIGHTNESS DESCRIPTORS
  // -------------------------------------

  let lightBand = "";

  if (lightness < 0.20) {
    lightBand = "Very dark ";
  } else if (lightness < 0.34) {
    lightBand = "Dark ";
  } else if (lightness > 0.84) {
    lightBand = "Very light ";
  } else if (lightness > 0.70) {
    lightBand = "Light ";
  }


  // -------------------------------------
  // MORE DETAILED HUE CATEGORIES
  // -------------------------------------

  let hueName;

  if (hue < 8 || hue >= 352) {
    hueName = "Red";
  } else if (hue < 17) {
    hueName = "Scarlet";
  } else if (hue < 27) {
    hueName = "Vermilion";
  } else if (hue < 38) {
    hueName = "Orange";
  } else if (hue < 47) {
    hueName = "Amber";
  } else if (hue < 57) {
    hueName = "Golden yellow";
  } else if (hue < 68) {
    hueName = "Yellow";
  } else if (hue < 78) {
    hueName = "Lime";
  } else if (hue < 92) {
    hueName = "Yellow-green";
  } else if (hue < 112) {
    hueName = "Leaf green";
  } else if (hue < 137) {
    hueName = "Green";
  } else if (hue < 154) {
    hueName = "Emerald";
  } else if (hue < 169) {
    hueName = "Sea green";
  } else if (hue < 183) {
    hueName = "Turquoise";
  } else if (hue < 195) {
    hueName = "Cyan";
  } else if (hue < 207) {
    hueName = "Sky blue";
  } else if (hue < 220) {
    hueName = "Azure";
  } else if (hue < 238) {
    hueName = "Blue";
  } else if (hue < 252) {
    hueName = "Royal blue";
  } else if (hue < 267) {
    hueName = "Indigo";
  } else if (hue < 281) {
    hueName = "Violet";
  } else if (hue < 296) {
    hueName = "Purple";
  } else if (hue < 312) {
    hueName = "Magenta";
  } else if (hue < 328) {
    hueName = "Fuchsia";
  } else if (hue < 342) {
    hueName = "Rose";
  } else {
    hueName = "Crimson";
  }


  // -------------------------------------
  // RECOGNIZE PINKS AND ROSE SHADES
  // -------------------------------------

  if (
    (hue < 17 || hue >= 342) &&
    lightness > 0.72
  ) {
    if (hue < 8 || hue >= 352) {
      return saturation < 0.48
        ? "Blush pink"
        : "Pink";
    }

    if (hue < 17) {
      return "Coral pink";
    }

    return "Dusty rose";
  }


  // -------------------------------------
  // PEACH AND PALE YELLOW
  // -------------------------------------

  if (
    hue >= 27 &&
    hue < 57 &&
    lightness > 0.72 &&
    saturation < 0.72
  ) {
    return lightness > 0.88
      ? "Pale peach"
      : "Peach";
  }

  if (
    hue >= 47 &&
    hue < 78 &&
    lightness > 0.78 &&
    saturation < 0.70
  ) {
    return lightness > 0.91
      ? "Pale yellow"
      : "Butter yellow";
  }


  // -------------------------------------
  // GREEN SHADES
  // -------------------------------------

  if (
    hue >= 78 &&
    hue < 169 &&
    lightness > 0.72
  ) {
    if (saturation < 0.42) {
      return "Sage green";
    }

    return lightness > 0.88
      ? "Mint green"
      : "Light green";
  }


  // -------------------------------------
  // AQUA, BLUE, AND PURPLE SHADES
  // -------------------------------------

  if (
    hue >= 169 &&
    hue < 195 &&
    lightness > 0.72
  ) {
    return "Aqua";
  }

  if (
    hue >= 195 &&
    hue < 238 &&
    lightness > 0.75
  ) {
    return "Powder blue";
  }

  if (
    hue >= 252 &&
    hue < 296 &&
    lightness > 0.72
  ) {
    return "Lavender";
  }

  if (
    hue >= 296 &&
    hue < 342 &&
    lightness > 0.72
  ) {
    return "Orchid pink";
  }


  // -------------------------------------
  // VERY VIVID COLORS
  // -------------------------------------

  if (
    saturation > 0.82 &&
    lightness > 0.35 &&
    lightness < 0.72
  ) {
    if (hueName === "Blue") return "Vivid blue";
    if (hueName === "Green") return "Vivid green";
    if (hueName === "Red") return "Vivid red";
    if (hueName === "Orange") return "Bright orange";
    if (hueName === "Purple") return "Vivid purple";
  }


  // -------------------------------------
  // FINAL COLOR NAME
  // -------------------------------------

  return lightBand + hueName;
}


// =====================================
// CLEAN UP WHEN THE PAGE CLOSES
// =====================================

window.addEventListener("beforeunload", () => {
  stopCamera();

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
});
