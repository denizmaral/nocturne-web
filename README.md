# Nocturne Web

**Dark mode for every website, with colours that still look right.**

Nocturne Web is a browser extension for Zen Browser and Firefox. It shows bright websites in dark colours. It keeps their design: brand colours, buttons and photos stay as they were, light backgrounds become dark, and dark text becomes light.

It is the sibling of [Nocturne](https://github.com/denizmaral/Nocturne), which does the same for Apple Mail, and uses the same colour engine.

## How it is different

Many dark-mode extensions invert or shift every colour on the page, which makes brand colours, charts and illustrations look washed out or wrong. Nocturne Web changes a colour only when it needs to:

- **Light backgrounds become dark, and dark text becomes light.** Each colour keeps its hue and its amount of colour, so a pale yellow note becomes a dark amber note, not a grey one.
- **Colours that already work on dark stay unchanged.** A blue button with white text stays a blue button with white text.
- **Images, videos and multi-colour graphics are never touched.** Simple one-colour icons are recoloured so you can still see them.
- **The page's own styles stay intact.** Nocturne Web adds a dark copy of the page's colour rules next to them. Hover effects, responsive layouts and themes keep working, and turning it off restores the page instantly.
- **Readability check.** After darkening a page, it looks for text that became hard to read and fixes it.
- **Pages that are already dark are left alone.**
- **Fast.** Pages are dark from the first frame, with no white flash. Styles that web apps add while you use them are converted before they appear on screen.

## Installation (Zen Browser)

Nocturne Web isn't on Mozilla's add-on site yet, so it isn't signed by Mozilla. Zen lets you install unsigned extensions:

1. Download `nocturne-web-<version>.xpi` from the [latest release](../../releases/latest).
2. Open `about:config` and set `xpinstall.signatures.required` to `false`.
3. Open `about:addons`, click the gear icon, choose **Install Add-on From File…**, and select the downloaded file.
4. When asked, allow it to access data on all websites. It needs this to read and darken page styles.

**Just trying it out?** Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and select the `.xpi` file or `manifest.json`. A temporary add-on is removed when the browser restarts.

Regular Firefox only installs extensions signed by Mozilla, except in its Developer Edition and Nightly versions.

## Using it

- Click the moon icon in the toolbar to turn dark mode off or on for the current site, or for all sites.
- Press **Alt+Shift+D** to switch the current site off or on.
- If a page already looks dark, Nocturne Web leaves it alone. Use **Darken anyway** in the popup to change that.
- **Details** in the popup shows what Nocturne Web did on the page. Include these numbers when you report a problem.

## Privacy

- Nocturne Web works only inside your browser. It doesn't collect, store or send any personal data, and it contains no analytics or tracking.
- It reads the stylesheets of the pages you visit to build their dark version. Browsers don't let extensions read stylesheets from other domains directly, so it downloads those again by itself. These downloads go only to the address the page already loads, carry no cookies, and are accepted only if they are stylesheets.
- The only thing it stores is your settings (on/off, globally and per site), and only on your device.

## Known limitations

- Dark logos and text inside images on transparent backgrounds can be hard to see on a dark background.
- Parts of a page that sit on a background image keep their original colours, because Nocturne Web can't tell how light the image is.
- Colours drawn on a canvas aren't converted.
- The readability check doesn't yet look inside web components (shadow DOM), although their styles are darkened like the rest of the page.
- Browser pages such as `about:` pages and add-on stores can't be changed by any extension.

## Development

```sh
node tests/color-parity.test.js        # JS colour engine matches Nocturne for Mail (Swift)
python3 tests/run.py                   # end-to-end tests in headless Zen (needs: pip install selenium)
./scripts/build.sh                     # builds dist/nocturne-web-<version>.xpi
```

The end-to-end tests load each page in `tests/pages` twice, without and with the extension. Every piece of text must come out as the exact dark version of its original colours (`src/color.js`), stay readable, and images must stay untouched. One page checks that styles added from JavaScript turn dark before the next frame. The pages cover web components (open, closed, nested, late-defined and slotted), CSS variables (including channel-style variables like Tailwind's and shadcn/ui's), stylesheets from other domains, `@import`, `@layer`, nested CSS, inline styles, SVG, styles added later by scripts, and strict Content Security Policies.

## Disclaimer

Nocturne Web changes how websites look in your browser. It doesn't change the websites themselves, but what you see may differ from what the site's authors intended: colours, contrast or layout can occasionally be wrong, and some content may be harder to read than in the original. Before you rely on how a page looks, turn Nocturne Web off for that site and check the original. This applies especially to payment pages, contracts, security warnings and anything else where details matter.

Nocturne Web is provided **"as is", without warranty of any kind**, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and non-infringement. To the fullest extent permitted by applicable law, the author is not liable for any damages, data loss or other losses arising from the use of, or inability to use, Nocturne Web. You use it at your own risk. See [LICENSE](LICENSE) for the full terms.

## Trademarks

Nocturne Web is an independent project. It is not affiliated with, endorsed by or sponsored by the Zen Browser project, Mozilla or any website it is used on. Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries. All other trademarks are the property of their respective owners and are mentioned only to describe compatibility.

## License

[MIT](LICENSE) © 2026 Deniz Maral
