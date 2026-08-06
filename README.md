# Toon Valley — Town Expansion

A lightweight, cel-shaded Three.js town prototype built as the foundation for a kid-friendly **toon-Sims-style game**. It is designed to scale carefully on phones, tablets, and older integrated-graphics laptops such as a 2019 Intel MacBook Air with 8 GB RAM.

## What is in this build

- Expanded road-grid town with a civic square and residential streets
- City Hall and clock tower
- General store, library, cafe, clinic, fire station, post office, school, toy shop, theater, apartments, and homes
- Sunshine Park, pond, playground, fountain, monument, benches, flowers, market stalls, street lamps, and a windmill
- Four enterable interiors: City Hall, General Store, Library, and Cafe
- Wandering toon residents
- Mountains, grasslands, trees, rocks, clouds, and trails around town

## Controls

### Desktop

- **WASD** — move
- **Mouse** — camera
- **Shift** — sprint
- **Space** — jump
- **E** — interact / enter / exit
- **Q** — cycle graphics quality
- **Esc** — release the mouse and pause

### Mobile / tablet

- **Left joystick** — move
- **Swipe on the right side** — camera
- **RUN**, **JUMP**, and **USE** buttons — actions

Landscape orientation gives the most comfortable view, but portrait layout is supported.

## Run locally on macOS

Double-click `run-mac.command`, or run:

```bash
cd /path/to/cel_village_game
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Three.js is loaded from a CDN, so the first page load requires an internet connection.

## Performance architecture

- Automatic Mobile / Low / Medium presets
- Mobile preset targets 30 FPS; Low targets 45 FPS
- Adaptive internal render resolution when frame rate drops
- Pixel-ratio caps for Retina displays
- Frame-rate caps to reduce heat and battery use
- Instanced trees, grass, rocks, flowers, street lamps, and road markings
- Shared low-poly geometries and materials
- No real-time shadows, physics engine, or post-processing
- Fog-limited view distance and frustum culling
- Static object matrices are frozen
- Distant NPC logic updates less frequently
- Interior geometry is disabled while outdoors
- One reusable interior light instead of several global point lights
- Rendering pauses when the tab is hidden
- Mobile HUD blur and motion effects are reduced

## Project files

- `index.html` — game shell, menus, and mobile controls
- `style.css` — responsive interface and touch layout
- `game.js` — rendering, world generation, movement, interactions, interiors, NPCs, and quality scaling
- `run-mac.command` — local macOS launcher
