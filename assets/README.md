# assets

Product photography used by the site.

| File | Used for |
|---|---|
| `hero-banner-1920/-1280(.webp), hero-banner-1600.jpg` | front-page hero banner, desktop (AI scene built from the green apple pack shot, 2K upscaled) |
| `hero-banner-m-768(.webp/.jpg)` | front-page hero banner, portrait crop for phones |
| `hero-trio(.webp/-550.webp/-550.png)` | former text-hero product image — kept for reuse (all three bags, transparent background) |
| `greenapple.jpg` | green apple flavor card + OG/social image |
| `greenapple-front/-bears/-macro(.jpg/.webp/-500.jpg)` | green apple product gallery |
| `strawberry.jpg` | strawberry flavor card |
| `pineapple.jpg` | pineapple flavor card |
| `flatlay(.jpg/.webp/-700.webp)` | product story — hand + spilled gummies flat-lay |

Shots are square 1000×1000 JPEGs (bag + spilled gummies on the flavor-color
background). To swap one, replace the file and keep the name — the site picks
it up automatically. If a file is removed, the site falls back to built-in
gummy-bear placeholder art in the right brand colors.

The header/footer logo is not an image: the "bitez" wordmark (white bubble
letters, dark green outline, action lines) is rendered in code with the
display font — see `.wordmark` in `src/tailwind.css`.
