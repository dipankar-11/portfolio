KYRO by Dipankar Das — portfolio site
Open index.html in a browser. Edit the profile, work, certificate and contact details directly in index.html.
Build animation (finishes with the cursors flocking around your mouse until Go live): balanced pool of 16 active cursor workers. Cursors appear only while performing build tasks and fade out between tasks; idle decorative cursors are hidden. Scroll advances the build. Sound starts after first scroll/click/key: typing clicks, tool sounds and a soft ambient music bed (generated live, fades out when the build finishes; mute with the speaker button or the M key). ?swarm=off disables auto-run.
Replace portrait.svg with your own cutout photo (keep the filename, or update the <img> in index.html).

Cursor: the entrance keeps its EXPLORE text reveal (intro.js). On the website, morphing-cursor.js draws a red circle; text under it is redrawn in black, and over small boxes/rectangles (buttons, pills, tags, stat boxes, contact email box, social links) the circle morphs into that box's shape. Tune size/limits in CONFIG at the top of morphing-cursor.js.

Favicon: favicon.svg (red background, black K) plus favicon.ico, favicon-32.png and apple-touch-icon.png; the ?v=3 in index.html forces browsers to drop the old cached icon.

Build animation: after the entrance screen slides up, swarm-rebuild.js (the real Swarm Rebuild effect, unmodified) blanks the page and a swarm of multiplayer cursors rebuilds it with typing/click sounds and soft music; swarm.js is the small loader that starts it and switches Tour (auto-scroll) on. Press M to mute, Esc to skip, or use the bar at the bottom (Go live / Replay). Your red morphing cursor is paused during the build and returns on the live site. ?swarm=off disables the auto-run; the 'Watch the build' button replays it.
