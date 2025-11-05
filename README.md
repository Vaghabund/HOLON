# HOLON

This is a minimal single-page site scaffold for the HOLON exhibition. I updated the layout to a hero → gallery → about → visit flow and used placeholder images and text so you can replace them later.

What I changed
- Added Google Fonts (Playfair Display for headings, Inter for body)
- Replaced horizontal-scrolling layout with a modern responsive single-page layout
- Added header/navigation with mobile toggle, hero, gallery grid, about and visit sections
- Kept font-size controls (A- / A+) and persisted the setting in localStorage

How to replace placeholders
- Replace images in `index.html` (src attributes for the <img> tags) with your assets. You can keep the same aspect ratios for best layout results.
- Replace the placeholder text in the hero/about/gallery figcaptions.

Files to edit
- `index.html` — page structure and placeholders
- `styles.css` — layout and typography rules
- `script.js` — mobile nav and font-size controls

Preview
- Open `index.html` in your browser (double-click the file or serve with a static server).

If you want, I can:
- Add a small admin JSON or markdown to drive image captions dynamically
- Wire up lightbox behavior for gallery images
- Export an assets folder and wire real images in

Kiosk mode changes (current)
- The site was changed to a kiosk-style, horizontal-only exhibition layout (no header, no footer, no nav).
- The page now contains a `.scroll-container` of full-screen `.panel` items that alternate image + text.
- Vertical scrolling is disabled; mouse wheel and touch gestures are mapped to horizontal navigation.

How to update panels
- Edit `index.html` and replace the placeholder <img> src attributes with your portrait images (recommended aspect ~2:3 or 600x900 placeholders).
- Edit the heading and paragraph text inside each `.panel .text` block.

Preview
- Serve the folder and open http://localhost:8000. The server you started earlier will serve the updated layout — refresh the page to see changes.

