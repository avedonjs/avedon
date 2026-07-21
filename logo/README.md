# Avedon logo

Marka varlıkları — vektör birincil; raster export'lar `rsvg-convert` ile üretildi.

## Seçilen kavram

**A. Çerçeve / vinyet (crop işaretleri)** — dört köşede L-şekilli crop mark'lar; ortada geometrik **A** monogramı. Fotoğrafçı Richard Avedon'dan gelen "net çerçeve" metaforu; kamera/objektif klişesi yok.

Alternatif taslaklar: [`explorations/`](./explorations/) (füzyon noktası, stream çizgili monogram).

## Renkler

| Rol | Hex | Kullanım |
|-----|-----|----------|
| Accent | `#06B6D4` | Vurgu, link, OG şerit, dark-mode hero |
| Accent (koyu) | `#0891B2` | Hover, erişilebilir metin üzerinde accent |
| Metin / ikon (light) | `#0F172A` | Açık arka planda logo |
| Metin / ikon (dark) | `#FAFAFA` | Koyu arka planda logo |
| OG arka plan | `#09090B` | Sosyal kart |

Logolar **`currentColor`** kullanır; HTML/CSS'te `color` ile tek renk (siyah/beyaz) zorunluluğu karşılanır.

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `icon.svg` | Sadece ikon (kare, 32×32 viewBox) |
| `logo-horizontal.svg` | İkon + `avedon` wordmark |
| `wordmark.svg` | Sadece yazı |
| `favicon/favicon-16x16.png` | Favicon |
| `favicon/favicon-32x32.png` | Favicon / sekme |
| `favicon/apple-touch-icon.png` | 180×180 touch icon |
| `og-image.png` | 1200×630 Open Graph |
| `og-image.svg` | OG kaynak (yeniden export için) |

## Clear space

İkon etrafında minimum boşluk: **monogram yüksekliğinin %25'i** (32px viewBox'ta ~8px). Wordmark kullanımında ikon ile metin arası sabit **12px** (viewBox ölçeğinde).

## Minimum boyut

- İkon tek başına: **16×16 px** (favicon); daha küçük kullanmayın.
- Yatay lockup: genişlik **≥ 120 px**; aksi halde sadece ikon tercih edin.

## Yasak / kaçınılacak kullanımlar

- Gradyan, gölge, 3D efekt, kontur dışı deformasyon
- Crop mark'ları veya A'yı ayrı anlamlı markalar gibi bölerek kullanmak
- Accent dışında çok renkli palet
- Oran bozma (ikona yalnızca uniform scale)

## Terminal / CLI (opsiyonel)

Monokrom, düşük çözünürlük banner örneği:

```
 ┌──      ──┐
 │    ▲    │
 └──      ──┘
  avedon
```

Daha net ASCII için yalnızca wordmark: `avedon` (küçük harf, npm/GitHub ile uyumlu).

## PNG yeniden üretim

README header (GitHub light/dark):

```bash
sed 's/currentColor/#0F172A/g' logo/logo-horizontal.svg > /tmp/logo-horizontal-light.svg
sed 's/currentColor/#FAFAFA/g' logo/logo-horizontal.svg > /tmp/logo-horizontal-dark.svg
rsvg-convert -w 560 /tmp/logo-horizontal-light.svg -o logo/logo-horizontal-light.png
rsvg-convert -w 560 /tmp/logo-horizontal-dark.svg -b '#0F172A' -o logo/logo-horizontal-dark.png
```

Favicon / OG:

```bash
rsvg-convert -w 16 -h 16 logo/icon.svg -o logo/favicon/favicon-16x16.png
rsvg-convert -w 32 -h 32 logo/icon.svg -o logo/favicon/favicon-32x32.png
rsvg-convert -w 180 -h 180 logo/icon.svg -o logo/favicon/apple-touch-icon.png
rsvg-convert -w 1200 -h 630 logo/og-image.svg -o logo/og-image.png
```

## Tipografi (wordmark)

Geometrik grotesk sans: **Inter** / system UI yığını (SVG `<text>`). Kurulumda font yoksa sistem sans-serif devreye girer; pixel-perfect marka için wordmark'ı path'e dönüştürmek isteğe bağlıdır.

**Yazım:** küçük harf `avedon` (npm, GitHub org `avedonjs` ile uyumlu). Büyük `Avedon` metin bağlamında serbest.
