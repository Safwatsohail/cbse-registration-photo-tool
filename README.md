# CBSE Registration

A free open-source static website that helps students prepare a clean CBSE registration photo in the browser.

## What it does

- Uploads a student photo locally in the browser.
- Fits it into a 300 x 300 square registration frame.
- Applies a clean white background pass and light image enhancement.
- Adds a clean label box with the student name on top and a date below.
- Exports a JPG under 40 KB by compressing and, when needed, slightly downscaling the download copy.
- Requires a Gmail address before download and sends it to `safwat.technology@gmail.com` using FormSubmit.

## Email setup

The page posts Gmail leads to:

```text
https://formsubmit.co/ajax/safwat.technology@gmail.com
```

On the first real submission, FormSubmit normally sends an activation email to `safwat.technology@gmail.com`. Open that email and confirm it once, then future Gmail submissions can arrive automatically.

## Run locally

Open `index.html` in a browser, or serve the folder with any static web server.
