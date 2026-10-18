# Industrias Fibraspol — website

Fabricación y reparación de cavas isotérmicas en fibra de vidrio · Valencia, Carabobo.

`site/` is the built, ready-to-upload website (Spanish, mobile-first, passed automated browser QA on phone and desktop).

## Where the content comes from

Everything on the site comes from Fibraspol's own public profiles (Instagram `@cavasdefibra` and `linktr.ee/fibraspol`):

| Fact on the site | Source |
|---|---|
| "Fabricamos y reparamos cavas isotérmicas en fibra de vidrio" | Instagram bio |
| 23 años de experiencia | Instagram bio |
| Address: Av. Lisandro Alvarado, Zona Industrial La Florida, Transversal 93, Valencia, Carabobo | Instagram bio (the rest of the line, "Nro 123 A 200 Galpón Industrial F…", is cut off on Instagram, so it is left out) |
| Name "Industrias Fibraspol" and logo | Linktree page |
| Blue colours | sampled from the logo |

Nothing else is claimed: no prices, clients, materials specs or delivery times. The hero image is an **illustration** drawn for the site (`cava-illustration.svg`), not a photo.

## Missing — ask Fibraspol for these, then rebuild

1. **WhatsApp number.** This is the most important. It's in their Linktree "WhatsApp" button, which couldn't be reached from the build environment. Right now the quote form copies the request and opens their **Instagram** chat. With the number it opens WhatsApp with the request already written.
2. **Real photos:** finished cavas, the galpón, work in progress, 5–8 photos. Phone photos are fine; the build compresses them.
3. **Opening hours:** they have a "Horario" highlight on Instagram.
4. **Domain:** their current "Página Web" link, or a new one (e.g. `fibraspol.com`). It's needed for the WhatsApp link preview, the sitemap and Google.
5. Optional: Facebook URL, email, full address line, RIF.

## Updating the site

Edit `business.csv` (add `whatsapp`, more `photos` separated by `|`, `opening_hours` like `Mo-Fr 07:30-16:30`) and `site.json` (texts), then:

```bash
npm run agency -- import clients/fibraspol/business.csv
npm run agency -- run --id <id> --force          # first time only; <id> from `npm run agency -- list`
npm run agency -- build <id> --content clients/fibraspol/site.json --domain https://fibraspol.com
rm -rf clients/fibraspol/site && cp -r output/sites/industrias-fibraspol clients/fibraspol/site
```

## Publishing

Upload the `site/` folder to Cloudflare Pages (free). In the dashboard: Workers & Pages → Create → Pages → Upload assets. Or from the terminal: `npx wrangler pages deploy clients/fibraspol/site --project-name fibraspol`. Then connect the domain in the Pages project settings.
