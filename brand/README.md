# Klippin Brand Kit

Version 2 (2026-10-27): one shared core and two equal systems, tokens v3.0.0. Open **index.html** (the brand bible) or **asset_index.html** (the files).

Artwork and colours referenced in the Klippin brand bible (index.html). Files beginning `client_` belong to the enterprise Client system; `clipper_` belongs to the creator Clipper system. Files beginning `shared_` are identical across both systems and are included once.

Start by opening **asset_index.html** locally in a browser. It previews the assets and links to the SVG and PNG files. The two contact sheets provide quick visual overviews. Keep the folders together so the index links work.

## Contents

| Folder / file | Contents |
| --- | --- |
| `logos/` | Entertainment wordmark, accented entertainment wordmark, simple wordmark, monogram, standalone play triangle and default app tile, as SVG + PNG; all-white assets use the `shared_` prefix |
| `recipes/` | All six colour recipe examples for each system, illustrated with the monogram; standalone monograms also have dark-background versions |
| `app_tiles/` | Three recipe app tiles per system cropped to their outer stroke, as SVG + PNG |
| `icons/` | Square app-icon PNGs at 16, 32, 48, 64, 180, 192, 512 and 1024 px, an Apple touch icon and a multi-size favicon ICO for each system |
| `avatars/` | 1024 px square social avatars on each system's approved dark background, padded for circular cropping |
| `reference/` | Font reference and stylesheet, the design tokens (`klippin_tokens.css` / `.json`, the same files the UI kit uses) and web app manifests |
| `index.html` | The brand bible: brand, logo, colour, typography, shared core and the Product UI boundary |
| `asset_manifest.csv` | Inventory of the SVG / PNG artwork pairs and their intended treatments |

## Naming and treatments

| Suffix | Meaning |
| --- | --- |
| `_white` | White letters / K with the system's accent gradient details. The entirely white play triangle is included once as `shared_play_white`. |
| `_gradient` | Default gradient letters / K with solid accent details: Pearl to Ice Blue + Royal Blue for Client; Apricot to Orange + Coral Red for Clipper. The play asset uses the system's accent gradient. |
| `_dark` | Dark letters (Client #050B22, Clipper #0B0B0C) with the system's accent gradient details. For light backgrounds: email, documents, partner decks, store pages. |
| `_mono_black` | Entirely black artwork for the simple wordmark, plain entertainment wordmark and monogram, plus `shared_play_black`. One-colour use on light backgrounds and in print. Shared prefix. |
| `_mono_white` | Entirely white artwork for the simple wordmark, plain entertainment wordmark and monogram. These assets use the `shared_` prefix. The accented entertainment wordmark has no monochrome export. |
| `_on_dark` | Background baked into the PNG / SVG: Client #050B22, Clipper #0B0B0C. |
| `_recipe_…` | Treatment named after the guide's colour recipe. |

The entertainment wordmark has plus and sound-wave cutouts in its Ps. The **accented** variant adds coloured outlines to those symbols; its colours follow the triangle. The simple wordmark has ordinary Ps.

The standalone play asset is the triangle extracted from the original monogram, with the K removed. Its corner curves and proportions are preserved.

## SVG and PNG use

- SVGs contain vector paths and embedded gradient definitions. They have no font, stylesheet or external artwork dependencies.
- Wordmark PNGs are 2048 px wide. Monograms, play assets, tiles, recipe examples and avatars are 1024 px wide. Use SVGs for larger output.
- Logo PNGs have transparent backgrounds. Rounded app tiles have transparent corners. `_on_dark` recipes and social avatars have opaque backgrounds.
- Standalone exports are cropped close to the artwork. Add the clear space below when placing them. Recipe canvases retain the guide's demonstration spacing.
- Gradient letters are for dark backgrounds only. On light backgrounds use `_dark` or `_mono_black`.
- Gradient letters are intended for dark backgrounds. With white letters, the triangle and optional entertainment symbol accents use the system accent gradient. With gradient letters, those details remain solid.
- The wordmark is artwork: do not retype it, stretch it, swap colours between systems or apply gradients to both the lettering and triangle.
- PNGs are RGB screen assets. Print suppliers should use the SVG artwork and agree any CMYK conversion and physical reproduction requirements separately.

## Clear space and minimum size

X is the height of the K. These specifications are copied from the guide.

| Variant | Clear space | Minimum width |
| --- | --- | --- |
| Entertainment wordmark, plain or accented | 1X | 240 px / 64 mm |
| Simple wordmark | 1X | 120 px / 32 mm |
| Monogram | 0.5X | 16 px / 4 mm |
| App tile | 0.75X | 24 px / 6 mm |

Below 240 px, use the simple wordmark; below 120 px, use the monogram. The monogram can also be chosen by context at larger sizes. Pixel specifications are at 96 ppi. Reserve clear space around app tiles when placing them within a layout.

## Extra handoff assets

App icons use the guide's default app-tile treatment on an opaque square gradient canvas. The square canvas lets a platform apply its own mask; the guide's rounded version remains in `logos/` and `app_tiles/`. These are general-purpose sizes, rather than a platform-specific app-store submission kit.

Social avatars use the default white monogram with the accent triangle on the approved system dark background. The K occupies about 40% of the canvas width, providing the guide's 0.5X clear space and room for circular cropping.

Colours, gradients, fonts and type sizes come from `reference/klippin_tokens.css` and `.json`: one shared core plus a complete set per system (CSS scope `[data-system="client"]` or `[data-system="clipper"]`). These are generated from the UI kit's token file, so the brand and the product never drift. Use the logo SVGs in this kit for the exact approved logo appearance.

Font choices and loaded weights are documented in `reference/font_reference.md`. Font binaries are not included; the reference links to the Google Fonts family pages.

Web app manifests are included for each system in `reference/`. Their icon paths assume the folder structure in this pack. Adapt those paths when integrating with a website.

## Corner radius

Keep the curves and corners within the logo and play triangle as drawn. They are part of the artwork and should not be adjusted.

The rounded app tiles use the radius shown in the guide: 49.5 units on a 249-unit tile (about 20% of its width). This is the reference treatment for those assets. Keep it when using a rounded tile from this kit.

For platform app icons, use the square files in `icons/` and let the platform apply its own mask. Interface cards and other containers can use a radius appropriate to their context; the tile radius does not set a universal radius for every interface component.

Colour recipes are reference examples using the monogram. Wordmark exports are limited to the core treatments in `logos/`; the kit does not include additional wordmark recipe variations.
