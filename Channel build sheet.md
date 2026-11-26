# Edit Lab channel build sheet

## Open the project

From the project folder, run `python3 -m http.server 8787 --bind 127.0.0.1 --directory public` and open http://127.0.0.1:8787/. There is no install or compilation step. The original v2 prototype, its scripts, and the Canva source layers are preserved under `reference/edit-lab-channel/`. Only `public/` needs to be served.

## From source art to channel

- Preserve the v2 10-second, 60 fps H.264 loop and the matching WebP layers together. Their positions and animation timing share a 2560 × 1440 design canvas. Changing Bear’s timing in only one place would break the handoff.
- The menu keeps one video playing across idle and preview. Selection retains the originating tile and expands the stage from its bounding rectangle. It also prepares the layers. Start reads the video time immediately before swapping to that scene.
- The transition owns the individual letter falls, cloud motion, and calibrated camera. The manifest locates the cyan iMac and its glass. The menu owns keyboard focus, pointer hit testing, dock, and navigation.
- Preview → Wii Menu continues the current loop. Start → channel → Wii Menu restores the layered scene at time zero and restarts the loop.
- On every screen size the opening page rests inside the treated glass. A downward wheel gesture, upward swipe, or the Enter page button expands that same page. The initiating gesture is absorbed before ordinary scrolling begins.
- With reduced motion, the menu uses a still frame, and channel navigation skips the fall and zoom.

## Drop in the future page

Replace the children of `#screen > .page` in `public/index.html`. Keep that container as the scrolling element. Add scoped content styles or a separate stylesheet. Its container width and the inherited `--screen-w` and `--screen-h` reflect the actual usable glass or expanded viewport. The opening currently uses Zach’s introduction and Batch Fades. The Enter page button is a sibling of the scroll container and remains part of the shell.

The shell manages the return control, glass alignment, and transition. Preserve the outer screen and final iMac image when replacing the page. The next channel can reuse the wall, navigation, and focus behavior; its artwork determines whether the Edit Lab choreography fits.

## Acceptance check

Open and close the preview without starting. Start during the bonk and after the logo exits. Check the seam between video and layers, the zoom landing, page scrolling, and both return paths. Repeat after resizing, using keyboard focus, and in phone portrait with reduced motion.
