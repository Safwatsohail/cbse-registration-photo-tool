export const config = { runtime: "edge" };

const KEYS = [
  "M4Lfte67G7x7ihWqKJppPSS5",
  "orFQhwPgFPKGsuueHQMx2t1x",
];

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  const incomingForm = await req.formData();
  const imageFile = incomingForm.get("image_file");

  if (!imageFile) {
    return new Response("Missing image_file", { status: 400 });
  }

  let lastError = null;

  for (const apiKey of KEYS) {
    try {
      const form = new FormData();
      form.append("image_file", imageFile);
      form.append("size", "auto");
      form.append("bg_color", "ffffff");
      form.append("format", "jpg");

      const res = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": apiKey },
        body: form,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson?.errors?.[0]?.title || `remove.bg error ${res.status}`
        );
      }

      const resultBlob = await res.blob();
      return new Response(resultBlob, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      lastError = err;
    }
  }

  return new Response(
    JSON.stringify({ error: lastError?.message || "All keys failed" }),
    {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
