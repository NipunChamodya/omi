# OMI browser artwork manifest

| Asset | Use | Source and ownership | Dimensions and format | Compression and priority |
| --- | --- | --- | --- | --- |
| [Player portraits](../../apps/web/src/art/player-portraits.svg) | Four fallback portraits for lobby, gameplay and account display | Original OMI continuation artwork | 256 × 64 SVG strip; four 64 × 64 frames | Fingerprinted locally, requested for illustrated default avatars |
| [Hardwood trick board](../../apps/web/src/art/trick-board.svg) | Central play surface and drop target | Original project artwork authored in this migration | 240 × 210 viewBox, SVG | Vite fingerprinted asset, loaded when gameplay styles are used |
| [Felt inlay](../../apps/web/src/art/table-inlay.svg) | Perimeter, weave and suit watermark | Existing OMI project artwork | 720 × 480 viewBox, SVG | Vite fingerprinted asset, gameplay |
| [Tropical island](../../apps/web/src/art/tropical-island.svg) | Illustrated island backdrop for menus and lobby | Existing OMI project artwork | Responsive SVG | Vite fingerprinted asset, menu and lobby |
| [Card guide](../../apps/web/src/art/card-guide.svg) and [OMI mark](../../apps/web/src/art/omi-mark.svg) | Brand and starting screens | Existing OMI project artwork | Responsive SVG | Vite fingerprinted assets, boot and menu |
| [Court illustrations](../../apps/web/src/components/TropicalCourt.tsx) | Illustrated J/Q/K for tropical mode | Existing OMI project artwork | 48 × 76 viewBox embedded SVG | Shipped in code, used when a tropical court is visible |
| [Card texture generator](../../apps/web/src/rendering/cardTexture.ts) | Pixi local hand and public trick sprites | Original layout derived from OMI’s existing pips and courts | 200 × 280 SVG rasterized by the browser | Lazy, in-memory GPU textures keyed by face and theme, disposed with the scene |
| [Theme backs](../../apps/web/src/themes/artwork) | Opponents’ face-down cards and design settings | Existing OMI project artwork | Responsive SVG | Loaded by active theme |
| [Game audio assets](../../apps/web/src/audio/assets/README.md) | Opening and music cues, shuffle, deal, play and results | Existing assets with provenance in the audio directory | MP3 | Browser audio loaded through existing preferences and cue system |

The supplied screenshots under [design references](../design/references) are review inputs. The shipped hardwood illustration, card visuals and existing project artwork are separate assets. Full-screen results illustrations and new music remain open.
