# HOLON — Exhibition Viewer

Live demo: https://vaghabund.github.io/HOLON/

This repository contains a small two-route exhibition site intended for kiosk or table installations. The landing page lets visitors choose between a full-viewport PDF viewer and a simple Spark-based gaussian splat viewer.

## How to use

1. Place your PDF file and gaussian splat file into the `assets/` folder at the project root.

2. Open `assets/config.json` and set the `pdfFile` and `splatFile` properties to the filenames you uploaded. Example:

```json
{
	"pdfFile": "MyPresentation.pdf",
	"splatFile": "MyScene.ply"
}
```

3. Open `index.html` to choose between the PDF viewer and the GS viewer.

## Gaussian splat viewer notes

- The first implementation is configured for Spark via browser ES modules from a CDN.
- The GS viewer reads `splatFile` from `assets/config.json` and currently expects a Spark-supported format such as `.ply`, `.spz`, `.splat`, or `.ksplat`.
- The default repository asset is `assets/Intrabeam_GS.ply`.

## Compress large splats

If a `.ply` file is too large for GitHub, convert it to `.spz` locally before committing.

1. Install dependencies:

```bash
npm install
```

2. Convert the splat:

```bash
npm run splat:compress -- ./assets/Intrabeam_GS.ply
```

3. Point `assets/config.json` at the generated `.spz` file.

Useful options:

```bash
npm run splat:compress -- ./assets/Intrabeam_GS.ply --output ./assets/Intrabeam_GS.spz
npm run splat:compress -- ./assets/Intrabeam_GS.ply --max-sh 1 --filter-opacity 0.01
```

## Security & privacy — Important

This site is published via GitHub Pages and is publicly accessible by design. Do NOT upload confidential or private PDFs or splat assets to the `assets/` folder of this repository. Anything you place in `assets/` will be downloadable by anyone who can reach the site or the repository.

## Deployment (GitHub Pages)

The site is published from the `main` branch. To update the live site:

1. Commit your changes (including the assets in `assets/` and the updated `assets/config.json`).
2. Push to `main`.
3. Wait a minute for GitHub Pages to rebuild, then hard-refresh the published URL.
