# @avedon/adapter-node

Production Node HTTP adapter. Writes `build/server.js` + static client assets (including SSG HTML). Run with `node build/server.js` or `avedon start`.

SSG routes with `revalidate` use stale-while-revalidate: the adapter serves on-disk HTML immediately and regenerates in the background when the TTL elapses.
