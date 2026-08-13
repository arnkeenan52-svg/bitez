# assets

Product photography used by the site.

| File | Used for |
|---|---|
| `bag-cutout-560/-900(.webp), bag-cutout-560.png` | front-page hero — the green apple bag, background removed (cutout floats on the flat apple field) |
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
