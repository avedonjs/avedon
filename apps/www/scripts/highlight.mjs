import { createHighlighter } from 'shiki'

/** @type {import('shiki').Highlighter | null} */
let highlighterPromise = null

const THEME = 'github-dark-high-contrast'

const LANG_ALIAS = {
  avedon: 'svelte',
  ave: 'svelte',
  ts: 'typescript',
  js: 'javascript',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
}

/**
 * @returns {Promise<import('shiki').Highlighter>}
 */
export async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEME],
      langs: [
        'typescript',
        'javascript',
        'bash',
        'json',
        'css',
        'html',
        'svelte',
        'markdown',
        'plaintext',
      ],
      langAlias: LANG_ALIAS,
    })
  }
  return highlighterPromise
}

/**
 * @param {string} lang
 */
function resolveLang(lang) {
  const raw = (lang || '').trim().toLowerCase()
  if (!raw) return 'plaintext'
  if (raw in LANG_ALIAS) return LANG_ALIAS[/** @type {keyof typeof LANG_ALIAS} */ (raw)]
  return raw
}

/**
 * Highlight a full `.ave` / `avedon` fence by section:
 * `<script>` → TypeScript, `<style>` → CSS, `<template>` → Svelte (control flow / mustaches).
 * Tag chrome stays HTML. Falls back to whole-file Svelte if parsing finds no sections.
 *
 * @param {import('shiki').Highlighter} highlighter
 * @param {string} code
 */
export function highlightAve(highlighter, code) {
  const re =
    /(<script\b[^>]*>)([\s\S]*?)(<\/script>)|(<style\b[^>]*>)([\s\S]*?)(<\/style>)|(<template\b[^>]*>)([\s\S]*?)(<\/template>)/gi

  /** @type {{ html: string }[]} */
  const parts = []
  let last = 0
  let matched = false
  let m

  while ((m = re.exec(code))) {
    matched = true
    if (m.index > last) {
      parts.push({
        html: highlighter.codeToHtml(code.slice(last, m.index), {
          lang: 'html',
          theme: THEME,
        }),
      })
    }

    if (m[1] != null) {
      parts.push({ html: highlighter.codeToHtml(m[1], { lang: 'html', theme: THEME }) })
      parts.push({
        html: highlighter.codeToHtml(m[2], { lang: 'typescript', theme: THEME }),
      })
      parts.push({ html: highlighter.codeToHtml(m[3], { lang: 'html', theme: THEME }) })
    } else if (m[4] != null) {
      parts.push({ html: highlighter.codeToHtml(m[4], { lang: 'html', theme: THEME }) })
      parts.push({ html: highlighter.codeToHtml(m[5], { lang: 'css', theme: THEME }) })
      parts.push({ html: highlighter.codeToHtml(m[6], { lang: 'html', theme: THEME }) })
    } else {
      parts.push({ html: highlighter.codeToHtml(m[7], { lang: 'html', theme: THEME }) })
      parts.push({
        html: highlighter.codeToHtml(m[8], { lang: 'svelte', theme: THEME }),
      })
      parts.push({ html: highlighter.codeToHtml(m[9], { lang: 'html', theme: THEME }) })
    }

    last = m.index + m[0].length
  }

  if (!matched) {
    return highlighter.codeToHtml(code, { lang: 'svelte', theme: THEME })
  }

  if (last < code.length) {
    parts.push({
      html: highlighter.codeToHtml(code.slice(last), { lang: 'html', theme: THEME }),
    })
  }

  return mergeShikiPres(parts.map((p) => p.html), 'avedon')
}

/**
 * Merge multiple Shiki `<pre>` blocks into one continuous code block.
 * @param {string[]} htmlParts
 * @param {string} lang
 */
function mergeShikiPres(htmlParts, lang) {
  /** @type {string[]} */
  const lines = []
  let preOpen = ''

  for (const html of htmlParts) {
    const open = html.match(/^<pre([^>]*)>/i)?.[0]
    if (open && !preOpen)
      preOpen = open.replace(/\sclass="[^"]*"/, ' class="shiki github-dark-high-contrast"')
    const codeMatch = html.match(/<code[^>]*>([\s\S]*)<\/code>/i)
    if (codeMatch) lines.push(codeMatch[1])
  }

  // Strip trailing empty line artifacts between sections when bodies end with newline
  const inner = lines.join('')
  const openTag =
    preOpen ||
    `<pre class="shiki github-dark-high-contrast" style="background-color:#0a0c10;color:#f0f3f6" tabindex="0">`
  return `${openTag}<code class="language-${lang}">${inner}</code></pre>`
}

/**
 * @param {import('shiki').Highlighter} highlighter
 * @param {string} code
 * @param {string} [lang]
 */
export function highlightCode(highlighter, code, lang) {
  const raw = (lang || '').trim().toLowerCase()
  if (raw === 'avedon' || raw === 'ave') {
    return highlightAve(highlighter, code)
  }

  const resolved = resolveLang(raw)
  try {
    return highlighter.codeToHtml(code, {
      lang: resolved,
      theme: THEME,
    })
  } catch {
    return highlighter.codeToHtml(code, {
      lang: 'plaintext',
      theme: THEME,
    })
  }
}
