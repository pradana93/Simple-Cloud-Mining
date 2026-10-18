# DESIGN.md

Direction and the reasons behind it. Written by the agent because none existed; the owner should replace this with their own brief where it disagrees.

## Product and read

Simple Cloud Mining is a self-serve crypto cloud-mining service. Two audiences share one UI: a buyer comparing hashrate plans, and a logged-in operator watching a rig console. The console is the anchor, so the whole product borrows its language.

## Identity motif: the hash rule

One idea, reused: a thin gold rule that every value sits on, with tabular monospace numbers aligned right. It shows up in the hero stat band, the plan list, the dashboard tiles, and the section dividers. Reference is an industrial control panel where each readout sits on a ruled line. Swap the logo and the ruled readouts still say "mining console", which is the point.

## Palette

- Core: gold `#f5b544` for brand, primary action, and live-hashrate values.
- Ground: ink `#070a10` (near-black) with `#0d1117` surfaces.
- Accent: emerald `#10b981`, reserved for realized earnings and success only.
- Everything else is the ink/slate neutral ramp.
- Removed: sky, violet, amber, and the 3-color ambient gradient. Too many accents, no meaning (antislop R-29).

## Type

- Display: `Chakra Petch`. Angular and mechanical, reads like machine labeling rather than a startup landing page.
- Body: `IBM Plex Sans`. Engineering heritage, holds up at 12 to 14px where most of this UI lives.
- Mono: `IBM Plex Mono` for hashes, addresses, and amounts, so digits stay columnar.
- Left Inter and Space Grotesk: both sit on the AI-default roster and neither carries the hardware character the product sells (antislop R-06).

## Dark is a decision

This is a 24/7 monitoring console. Operators watch it for long sessions, often at night next to a mining rig, so a dark ground is functional, not decorative (antislop R-21). No light theme is shipped because none is needed for this audience.

## Dials

- ENERGY: 2. Confident, not loud.
- RHYTHM: 2. Deliberate variation by section, not one centered stack after another.
- MOTION: 1. Near still. Motion only when it reports something (loading, a live counter), never a decorative loop.

## Icons

Lucide, chosen per meaning and noted inline where it is not obvious: `Pickaxe` for mining, `Wallet` for balance, `ArrowDownToLine` for withdrawal, `Link2` for chain links. No `Sparkles` as decoration.

## Logo

The mark is an agent-authored placeholder: a pick-and-rule monogram in a gold tile, plus an `app/icon.svg`. Replace it with the owner's real logo when available (antislop R-23).

## What we said no to

Decorative grid backgrounds, radial orb glows, glassmorphism on every surface, infinite marquee and pulse loops, large soft shadows on every card, and uppercase-tracked eyebrow pills above headlines.
