---
phase: 2
plan: 02-01
subsystem: social-preview
tags:
  - metadata
  - preview-image
  - sharing
key-files:
  - public/index.html
  - public/social-preview.png
metrics:
  preview_width: 1200
  preview_height: 630
---

# Plan 02-01 Summary: Add social preview metadata and image

## One-liner

Added accurate Open Graph and Twitter metadata plus a committed social preview image for shareable home-page links.

## Completed Work

- Updated `public/index.html` with description, canonical path, Open Graph metadata, Twitter card metadata, and preview image dimensions.
- Set `og:title` and Twitter title to `Watch People Die Live`.
- Wrote social descriptions that frame the app as statistical and representative, not an individual death-record feed.
- Generated `public/social-preview.png` as a 1200x630 PNG using the app's dark globe/death-flash visual language.

## Commits

| Task                              | Commit       | Description                                                                                                        |
| --------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Social metadata and preview image | working tree | Changes are present but not committed because `commit_docs=false` and the repository already has uncommitted work. |

## Verification

Passed:

```bash
file public/social-preview.png
rg -n "og:title|og:description|og:image|twitter:card|summary_large_image|individual death records|identifiable" public/index.html
PORT=3003 npm start
curl http://localhost:3003/
curl http://localhost:3003/social-preview.png
```

HTTP smoke results:

| Route                 | Status |
| --------------------- | ------ |
| `/`                   | 200    |
| `/social-preview.png` | 200    |

## Deviations

- No absolute production URL was hard-coded; metadata uses app-served paths to avoid locking the preview to a specific deployment domain.
- No commit was created during execution.

## Self-Check

PASSED. Home-page metadata is present and avoids identifiable-person or exact-record claims, and the preview image is a valid 1200x630 PNG.
