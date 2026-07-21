export type Post = {
  id: string
  title: string
  body: string
  likes: number
}

const posts: Record<string, Post> = {
  '1': { id: '1', title: 'Hello avedon', body: 'First post from the fake db.', likes: 3 },
  '2': { id: '2', title: 'Signals', body: 'Fine-grained reactivity demo.', likes: 7 },
}

export const db = {
  post: {
    find(id: string): Post | null {
      return posts[id] ?? null
    },
    incrementLikes(id: string): Post | null {
      const p = posts[id]
      if (!p) return null
      p.likes += 1
      return p
    },
  },
}
