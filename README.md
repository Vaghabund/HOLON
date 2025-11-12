# HOLON — PDF Kiosk Viewer

Live demo: https://vaghabund.github.io/HOLON/

This repository contains a simple full-viewport PDF viewer intended for kiosk/table installations. It renders a single PDF (from the `assets/` folder) as paged slides and provides keyboard, wheel, arrow, dot and touch-swipe navigation.

## How to use

1. Place your PDF file into the `assets/` folder at the project root. There should only be one active PDF at a time.

2. Open `assets/config.json` and set the `pdfFile` property to the filename of the PDF you uploaded. Example:

```json
{
	"pdfFile": "MyPresentation.pdf"
}
```

## Security & privacy — Important

This site is published via GitHub Pages and is publicly accessible by design. Do NOT upload confidential or private PDFs to the `assets/` folder of this repository. Anything you place in `assets/` (including PDFs) will be downloadable by anyone who can reach the site or the repository.

## Deployment (GitHub Pages)

The site is published from the `main` branch. To update the live site:

1. Commit your changes (including the PDF in `assets/` and the updated `assets/config.json`).
2. Push to `main`.
3. Wait a minute for GitHub Pages to rebuild, then hard-refresh the published URL.
