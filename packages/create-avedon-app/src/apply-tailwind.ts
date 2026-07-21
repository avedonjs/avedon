import fs from 'node:fs'
import path from 'node:path'

const POSTCSS_CONFIG = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
`

const APP_CSS = `@import "tailwindcss";

@theme {
  --color-bg: #09090B;
  --color-fg: #FAFAFA;
  --color-muted: #A1A1AA;
  --color-accent: #06B6D4;
  --color-accent-deep: #0891B2;
  --color-line: rgba(250, 250, 250, 0.12);
  --font-sans: 'Syne', sans-serif;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
}

.stage-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: min(70vw, 36rem);
  height: min(70vw, 36rem);
  background: radial-gradient(circle, rgba(6, 182, 212, 0.16), transparent 68%);
  pointer-events: none;
  z-index: -1;
  will-change: transform;
  animation: drift 18s ease-in-out infinite alternate;
}

.stage-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(250, 250, 250, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(250, 250, 250, 0.03) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at 30% 20%, #000 20%, transparent 70%);
  pointer-events: none;
  z-index: -1;
}

.brand {
  animation: rise 0.7s ease both;
}

.headline {
  animation: rise 0.7s ease 0.06s both;
}

.support {
  animation: rise 0.7s ease 0.12s both;
}

.demo {
  animation: rise 0.7s ease 0.18s both;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(0.6rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes drift {
  0% {
    transform: translate(8%, -18%) scale(1);
  }
  33% {
    transform: translate(-55%, 35%) scale(1.08);
  }
  66% {
    transform: translate(-15%, 70%) scale(0.92);
  }
  100% {
    transform: translate(-70%, -5%) scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .brand,
  .headline,
  .support,
  .demo {
    animation: none;
  }

  .stage-glow {
    animation: none;
    transform: translate(8%, -18%);
  }
}
`

const HOME_AVE = `<script lang="ts">
  import { signal } from '@avedon/runtime'

  export let title

  const count = signal(0)

  function inc() {
    count.set(count.get() + 1)
  }

  function reset() {
    count.set(0)
  }
</script>

<script lang="ts" server>
  export async function load() {
    return { title: 'avedon' }
  }
</script>

<template>
  <main class="relative isolate mx-auto flex min-h-screen w-[min(100%,56rem)] flex-col justify-center gap-7 overflow-visible p-[clamp(1.5rem,4vw,3rem)]">
    <div class="stage-glow" aria-hidden="true"></div>
    <div class="stage-grid" aria-hidden="true"></div>
    <p class="brand m-0 pr-[0.06em] text-[clamp(3.5rem,12vw,7rem)] font-extrabold leading-none tracking-[-0.04em]">{title}</p>
    <h1 class="headline m-0 max-w-[18ch] text-[clamp(1.35rem,3.5vw,2rem)] font-bold leading-[1.15] tracking-[-0.03em]">
      Full-stack TypeScript, one .ave file.
    </h1>
    <p class="support m-0 max-w-xl text-[1.05rem] font-normal leading-normal text-muted">
      Edit src/pages/Home.ave and save — the dev server reloads with your changes.
    </p>
    <section class="demo mt-1 max-w-xs rounded-[0.4rem] border border-line px-5 py-[1.1rem]">
      <p class="mb-3 text-[0.85rem] font-medium text-muted">Live signal — this runs in the browser.</p>
      <div class="flex items-baseline justify-between gap-4">
        <span class="text-[2.5rem] font-extrabold tracking-[-0.04em] text-accent tabular-nums">{count}</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
            on:click={inc}
          >
            Increment
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
            on:click={reset}
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
`

export function applyTailwind(appDir: string): void {
  const pkgPath = path.join(appDir, 'package.json')
  const raw = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    devDependencies?: Record<string, string>
    [key: string]: unknown
  }
  const devDependencies = raw.devDependencies ?? {}
  devDependencies.tailwindcss = '^4.1.11'
  devDependencies['@tailwindcss/postcss'] = '^4.1.11'
  devDependencies.postcss = '^8.5.6'
  fs.writeFileSync(
    pkgPath,
    `${JSON.stringify({ ...raw, devDependencies }, null, 2)}\n`,
  )

  fs.writeFileSync(path.join(appDir, 'postcss.config.js'), POSTCSS_CONFIG)
  fs.writeFileSync(path.join(appDir, 'src/app.css'), APP_CSS)
  fs.writeFileSync(path.join(appDir, 'src/pages/Home.ave'), HOME_AVE)

  const clientPath = path.join(appDir, 'src/client.ts')
  const client = fs.readFileSync(clientPath, 'utf8')
  if (!client.includes('./app.css')) {
    fs.writeFileSync(clientPath, `import './app.css'\n${client}`)
  }
}
