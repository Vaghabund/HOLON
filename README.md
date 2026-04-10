# HOLON — Exhibition Viewer

Live demo: https://vaghabund.github.io/HOLON/

This repository contains a small two-route exhibition site intended for kiosk or table installations. The landing page lets visitors choose between a full-viewport PDF viewer and a side-by-side model comparison viewer.

## How to use

1. Place your PDF file and any comparison assets into the `assets/` folder at the project root.

2. Open `assets/config.json` and set the `pdfFile` plus the two `compareModels` entries to the filenames you uploaded. Example:

```json
{
	"pdfFile": "MyPresentation.pdf",
	"compareModels": [
		{ "label": "SPZ Output", "kind": "splat", "file": "MyScene.spz" },
		{ "label": "GLB Output", "kind": "glb", "file": "MyScene.glb" }
	]
}
```

3. Open `index.html` to choose between the PDF viewer and the model comparison viewer.

## Model comparison notes

- The left pane uses Spark for splat-compatible files such as `.ply`, `.spz`, `.splat`, or `.ksplat`.
- The right pane uses Three.js `GLTFLoader` for `.glb` or `.gltf` files.
- The viewer reads the first two `compareModels` entries from `assets/config.json`.

## Compress large splats

If a `.ply` file is too large for GitHub, convert it to `.spz` locally before committing.

1. Install dependencies:

```bash
npm install
```

2. Convert the splat:

```bash
npm run splat:compress -- ./assets/MyScene.ply --output ./assets/MyScene.spz
```

3. Point the left-side `compareModels` entry in `assets/config.json` at the generated `.spz` file.

Useful options:

```bash
npm run splat:compress -- ./assets/MyScene.ply --output ./assets/MyScene.spz
npm run splat:compress -- ./assets/MyScene.ply --max-sh 1 --filter-opacity 0.01
```

## Security & privacy — Important

This site is published via GitHub Pages and is publicly accessible by design. Do NOT upload confidential or private PDFs or splat assets to the `assets/` folder of this repository. Anything you place in `assets/` will be downloadable by anyone who can reach the site or the repository.

## Deployment (GitHub Pages)

The site is published from the `main` branch. To update the live site:

1. Commit your changes (including the assets in `assets/` and the updated `assets/config.json`).
2. Push to `main`.
3. Wait a minute for GitHub Pages to rebuild, then hard-refresh the published URL.
