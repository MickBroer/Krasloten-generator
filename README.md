# Krasslut Studio — version 3

A browser-based scratch card generator in readable, plain JavaScript. No build step, external libraries, accounts or server uploads. The interface is English; code comments and `CODE-UITLEG.md` are in Dutch.

## Open or publish

Open `index.html` in a modern browser, keeping all program files together. For GitHub Pages, upload every `.html`, `.css` and `.js` file from this folder to the same published folder. There are now **ten program files**, including the new `geometry.js`:

`index.html`, `style.css`, `config.js`, `engine.js`, `model.js`, `files.js`, `geometry.js`, `render.js`, `export.js`, `app.js`.

In GitHub: **Settings → Pages → Deploy from a branch → main → / (root)**. Replace existing program files and add the new ones. If an old interface remains visible after deployment, refresh without cache.

## Generate a batch

1. Use the sample design or **Load front design**. Upload controls show the names of successfully loaded files, including after reopening a project.
2. Choose the **Number of winning icons** (1–12) and **Number of your icons** (1–24). Upload at least the sum of these counts in distinct icon files. The app shows how many you need. Larger groups are arranged in rows; icon and text sizes are capped to fit the initial grid.
3. In **Layout · all tickets**, position the original icons and prize labels. The layout is shared by the batch. Changing group counts for a new batch resets the positions to a suitable grid when you generate.
4. Set prize names, odds and overlap. If the prize named **Nude** has winners, upload at least one image using **Add nude images**. Alternatively set its odds to 0% when testing without images.
5. Use **Nude image area** to set the center, width and height of the photo area. **Position image area** lets you drag its frame. This is the area you choose for the own-icon part of the design, not the entire ticket.
6. Generate and browse the tickets with the arrows. The results section lists the original prizes for every ticket number; clicking a number opens that ticket. Filters show all tickets, winners, Nude winners or manually edited tickets.

## Winning rules

Each icon is unique within its group. Each matching own icon wins its attached prize. A particular prize can be won at most once per ticket.

Without overlap, a ticket wins at most one prize. With overlap, the maximum is the smaller of the two icon counts. For example, three winning icons and five own icons allow up to three different prizes.

The special prize named **Nude** (case-insensitive) always wins alone. It reserves a complete winning-ticket slot, but its image uses only the photo area you set. The other prize percentages must fit the remaining tickets. Impossible odds produce an explanation before generation.

Percentages are converted to whole numbers of tickets. The generator uses largest-remainder rounding, with a feasibility check for exclusive Nude winners. The actual percentages are displayed. Zero-odds prizes may appear as non-winning labels but never win.

## Nude images

A Nude-winning ticket gets exactly one image from the uploaded collection. Selection is random while spreading reuse across the collection. That choice is stored with the ticket and stays the same when browsing, exporting or reopening the project.

The selected image is fitted inside your photo area, preserving its proportions and showing the complete image without cropping. The original own icons and their prize texts are not drawn on that ticket. Winning icons remain visible. The area frame is an editor guide and is never printed.

Newly added or cleared images affect the next batch only. A current batch keeps its own image collection. These are regular local image uploads; no image is generated, analyzed or sent to a server by the app.

## Manual editing

Choose **Edit this ticket**:

- Change visible prize labels on ordinary tickets. For the built-in design, you can also edit the title, headings and footer.
- **Add image** adds an image only to this ticket. Select it and drag it to move it. Drag any of its four corner handles to resize it while preserving proportions; the opposite corner stays anchored until a size/position limit is reached. You can also use the width slider and position fields.
- **Add text** adds a movable text layer, including multiple lines. Change its size, color or font. **Bring to front** changes layer order.
- **Reset this ticket's edits** removes only this ticket's manual edits after confirmation.

Manual edits affect appearance, not the recorded outcome. The **Manually edited** badge is UI-only and never appears in a PNG. The private CSV includes a manual-edit flag. Uploaded background text is part of an image and cannot be edited as text; change the original artwork or add another layer.

Changing prize settings, group counts, icon files or nude images leaves the current batch intact until you generate again. Regeneration clears manual edits after confirmation. Shared layout, artwork, font styling and the nude image area apply to all tickets immediately.

## Fonts

The main **Font** selector changes the generated ticket texts and built-in sample design. Extra text layers have their own font selector. The back number has its own font selector too.

Choices are Arial, Verdana, Georgia, Times New Roman, Courier New, Trebuchet MS and System. These use local browser/system fonts with fallbacks; exact appearance can differ by operating system. No font files are uploaded or downloaded. Font choices are saved in the project and used for PNG export.

## Back tab

The **Back** tab has its own optional background upload and **Show number in series** checkbox. The number is formatted as `7 / 40`, using the same ticket number as the results list. Choose its position, size, color and font.

A back image is optional. Enabling numbering without one creates a white back with the number. With no back image and numbering off, there is no back to export. While viewing the Back tab, **This back · PNG** exports the selected back and **Download back sheet · PNG** exports the numbered back sheet. The results are shown in the UI and CSV, not automatically printed on either side.

## Saving and printing

**Save project** includes uploaded filenames, artwork, all image collections, current tickets, their assigned images, fonts, manual edits, the photo area and back settings. **Open project** restores them.

Older version-1 and version-2 projects remain readable and retain their original outcomes, including any old overlapping Nude wins. Those existing tickets are not silently re-generated. Generate a new batch to use the new exclusive image-prize rules. Version-3 projects require this version of the app.

PNG exports include artwork and edits but no guides or editing badges. Pixel dimensions are based on ticket width and resolution. Set the displayed physical dimensions explicitly in your print program; browser-generated PNGs can carry different default DPI metadata. Do not automatically fit to page.

Back sheets use the same positions as front sheets. Make a test print to check your duplex printer's alignment and paper orientation. PDF, automatic A4/A3 pagination, crop marks and printer-specific color profiles are not included. Exports are limited to 60 million pixels and 16,000 pixels per side; some browsers have lower limits.

## Verification

```sh
node engine.test.cjs
node model.test.cjs
node features.test.cjs
node editor.test.cjs
```

The suites cover 762 distribution scenarios, legacy project migration, manual-edit isolation, saved image choices, fonts, custom image areas, numbered backs, all four resize corners, and the actual editor pointer handlers using a DOM test double. Browser checks cover image upload/name persistence, 3/5 icon groups, three-prize and exclusive Nude wins, result navigation, photo-area export, numbered back export, fonts and project save/reopen.
