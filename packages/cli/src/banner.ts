/** Dev server startup banner (stdout once per `avedon dev`). */

export function shouldPrintDevBanner(extraArgv: string[]): boolean {
  return !extraArgv.includes('--quiet') && !extraArgv.includes('-q')
}

function wantsColor(): boolean {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== '') return false
  if (process.env.FORCE_COLOR === '0') return false
  return Boolean(process.stdout.isTTY)
}

export function printDevBanner(): void {
  const color = wantsColor()
  const cyan = color ? '\x1b[36m' : ''
  const dim = color ? '\x1b[2m' : ''
  const reset = color ? '\x1b[0m' : ''

  console.log(
    [
      `${cyan}┌─     ─┐${reset}  ${cyan}avedon${reset}`,
      `${cyan}   ▲${reset}`,
      `${cyan}└─     ─┘${reset}  ${dim}dev server${reset}`,
    ].join('\n'),
  )
}
