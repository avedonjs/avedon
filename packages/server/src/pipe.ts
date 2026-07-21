import type { ServerResponse } from 'node:http'
import { Readable } from 'node:stream'

/** Copy Web `Response` status/headers/body onto a Node `ServerResponse` (streaming). */
export async function pipeWebResponse(
  nodeRes: ServerResponse,
  response: Response,
): Promise<void> {
  nodeRes.statusCode = response.status
  response.headers.forEach((v, k) => {
    nodeRes.setHeader(k, v)
  })

  if (!response.body) {
    nodeRes.end()
    return
  }

  const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
  await new Promise<void>((resolve, reject) => {
    nodeStream.on('error', reject)
    nodeRes.on('error', reject)
    nodeRes.on('finish', () => resolve())
    nodeStream.pipe(nodeRes)
  })
}
