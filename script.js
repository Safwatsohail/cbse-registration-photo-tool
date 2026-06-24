const photoInput = document.querySelector("#photoInput");
const dropzone = document.querySelector("#dropzone");
const editorScreen = document.querySelector("#editorScreen");
const closeEditor = document.querySelector("#closeEditor");
const photoForm = document.querySelector("#photoForm");
const studentName = document.querySelector("#studentName");
const photoDate = document.querySelector("#photoDate");
const gmailInput = document.querySelector("#gmailInput");
const downloadBtn = document.querySelector("#downloadBtn");
const emailStatus = document.querySelector("#emailStatus");
const statusText = document.querySelector("#statusText");
const fileMeta = document.querySelector("#fileMeta");
const canvas = document.querySelector("#outputCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const emailEndpoint = "https://formsubmit.co/ajax/safwat.technology@gmail.com";
const maxBytes = 40 * 1024;
const outputSize = 300;
let sourceImage = null;
let generatedBlob = null;

photoDate.valueAsDate = new Date();

photoInput.addEventListener("change", async () => {
  const [file] = photoInput.files;
  if (!file) return;
  await usePhotoFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("drag-over");
  });
});

dropzone.addEventListener("drop", async (event) => {
  const [file] = event.dataTransfer.files;
  if (file && file.type.startsWith("image/")) {
    photoInput.files = event.dataTransfer.files;
    await usePhotoFile(file);
  }
});

closeEditor.addEventListener("click", () => {
  editorScreen.classList.remove("active");
  editorScreen.setAttribute("aria-hidden", "true");
  document.body.classList.remove("editor-open");
});

[studentName, photoDate].forEach((control) => {
  control.addEventListener("input", () => sourceImage && renderOutput());
});

photoForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!generatedBlob) {
    emailStatus.textContent = "Upload a photo first.";
    return;
  }

  const email = gmailInput.value.trim();
  if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) {
    emailStatus.textContent = "Use a valid Gmail address ending in @gmail.com.";
    gmailInput.focus();
    return;
  }

  downloadBtn.disabled = true;
  emailStatus.textContent = "Saving Gmail address...";

  try {
    await sendEmailLead(email);
    emailStatus.textContent = "Saved. Download starting.";
    downloadImage();
  } catch (error) {
    emailStatus.textContent =
      "Email could not be saved yet. Confirm the FormSubmit activation email, then try again.";
  } finally {
    downloadBtn.disabled = false;
  }
});

async function usePhotoFile(file) {
  statusText.textContent = "Processing photo...";
  fileMeta.textContent = `${file.name} • ${formatBytes(file.size)}`;
  sourceImage = await loadImage(file);
  openEditor();
  await renderOutput();
}

function openEditor() {
  editorScreen.classList.add("active");
  editorScreen.setAttribute("aria-hidden", "false");
  document.body.classList.add("editor-open");
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

async function renderOutput() {
  if (!sourceImage) return;

  canvas.width = outputSize;
  canvas.height = outputSize;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputSize, outputSize);

  const labelHeight = 58;
  const padding = 12;
  const photoHeight = outputSize - labelHeight;
  const target = {
    x: padding,
    y: padding,
    w: outputSize - padding * 2,
    h: photoHeight - padding,
  };

  const crop = coverCrop(sourceImage.width, sourceImage.height, target.w, target.h);
  ctx.filter = "brightness(1.015) contrast(1.02) saturate(1.01)";
  ctx.drawImage(sourceImage, crop.x, crop.y, crop.w, crop.h, target.x, target.y, target.w, target.h);
  ctx.filter = "none";

  softenBackgroundEdges(outputSize, photoHeight);
  drawPhotoBorder(outputSize, photoHeight, padding);
  drawLabel(outputSize, labelHeight);
  ctx.restore();

  generatedBlob = await compressedJpeg(canvas, maxBytes);
  statusText.textContent = "Preview ready";
  fileMeta.textContent = `JPG • ${formatBytes(generatedBlob.size)} / 40 KB`;
  downloadBtn.disabled = false;
  emailStatus.textContent = "";
}

function coverCrop(imageWidth, imageHeight, targetWidth, targetHeight) {
  const imageRatio = imageWidth / imageHeight;
  const targetRatio = targetWidth / targetHeight;

  if (imageRatio > targetRatio) {
    const width = imageHeight * targetRatio;
    return { x: (imageWidth - width) / 2, y: 0, w: width, h: imageHeight };
  }

  const height = imageWidth / targetRatio;
  return { x: 0, y: (imageHeight - height) / 2, w: imageWidth, h: height };
}

function softenBackgroundEdges(width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const samples = [];
  const stride = Math.max(4, Math.floor(width / 24));

  for (let x = 0; x < width; x += stride) {
    samples.push(pixelAt(data, width, x, 0), pixelAt(data, width, x, height - 1));
  }

  for (let y = 0; y < height; y += stride) {
    samples.push(pixelAt(data, width, 0, y), pixelAt(data, width, width - 1, y));
  }

  const bg = medianColor(samples);

  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const edgeDistance = Math.min(x, width - x, y, height - y);
    const edgeBlend = Math.max(0, 1 - edgeDistance / 56);
    if (edgeBlend <= 0) continue;

    const distance = colorDistance(data[index], data[index + 1], data[index + 2], bg);
    const isLikelyBackground = distance < 42 && data[index] + data[index + 1] + data[index + 2] > 360;
    if (isLikelyBackground) {
      const blend = edgeBlend * 0.72;
      data[index] = data[index] + (255 - data[index]) * blend;
      data[index + 1] = data[index + 1] + (255 - data[index + 1]) * blend;
      data[index + 2] = data[index + 2] + (255 - data[index + 2]) * blend;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function pixelAt(data, width, x, y) {
  const index = (y * width + x) * 4;
  return [data[index], data[index + 1], data[index + 2]];
}

function medianColor(samples) {
  return [0, 1, 2].map((channel) => {
    const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
}

function colorDistance(r, g, b, bg) {
  return Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
}

function drawPhotoBorder(size, photoHeight, padding) {
  ctx.strokeStyle = "#e5e5ea";
  ctx.lineWidth = 2;
  ctx.strokeRect(padding, padding, size - padding * 2, photoHeight - padding);
}

function drawLabel(size, labelHeight) {
  const y = size - labelHeight;
  const name = (studentName.value.trim() || "JOHN DOE").toUpperCase();
  const dateText = formatDisplayDate(photoDate.value);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, y, size, labelHeight);
  ctx.strokeStyle = "#e5e5ea";
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(size, y);
  ctx.stroke();

  ctx.fillStyle = "#1d1d1f";
  ctx.font = "700 17px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(truncateText(`NAME: ${name}`, size * 0.9), size / 2, y + 22);

  ctx.fillStyle = "#6e6e73";
  ctx.font = "700 13px Arial, sans-serif";
  ctx.fillText(truncateText(dateText, size * 0.9), size / 2, y + 42);
}

function formatDisplayDate(value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function truncateText(text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 3 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function canvasToBlob(sourceCanvas, quality) {
  return new Promise((resolve) => sourceCanvas.toBlob(resolve, "image/jpeg", quality));
}

async function compressedJpeg(sourceCanvas, byteLimit) {
  let quality = 0.84;
  let blob = await canvasToBlob(sourceCanvas, quality);

  while (blob && blob.size > byteLimit && quality > 0.18) {
    quality -= 0.06;
    blob = await canvasToBlob(sourceCanvas, quality);
  }

  let exportSize = sourceCanvas.width;
  while (blob && blob.size > byteLimit && exportSize > 180) {
    exportSize -= 30;
    const scaledCanvas = document.createElement("canvas");
    const scaledCtx = scaledCanvas.getContext("2d");
    scaledCanvas.width = exportSize;
    scaledCanvas.height = exportSize;
    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = "high";
    scaledCtx.drawImage(sourceCanvas, 0, 0, exportSize, exportSize);
    quality = 0.7;
    blob = await canvasToBlob(scaledCanvas, quality);

    while (blob && blob.size > byteLimit && quality > 0.18) {
      quality -= 0.06;
      blob = await canvasToBlob(scaledCanvas, quality);
    }
  }

  return blob;
}

async function sendEmailLead(email) {
  const body = new FormData();
  body.append("email", email);
  body.append("tool", "CBSE Registration");
  body.append("_subject", "New CBSE Registration Tool user");
  body.append("_captcha", "false");
  body.append("_template", "table");

  const response = await fetch(emailEndpoint, {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
  });

  if (!response.ok) {
    throw new Error("Email service rejected the request");
  }
}

function downloadImage() {
  const link = document.createElement("a");
  const safeName = (studentName.value.trim() || "cbse-registration-photo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  link.href = URL.createObjectURL(generatedBlob);
  link.download = `${safeName || "cbse-registration-photo"}.jpg`;
  document.body.append(link);
  link.click();
  link.remove();
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
