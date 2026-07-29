import { createFileRoute, Link } from '@tanstack/react-router';
import { Container } from '#site/components/container';
import { getAllPosts } from '#site/lib/blog';
import { seo } from '#site/lib/seo';

export const Route = createFileRoute('/blog/')({
  head: () => ({
    ...seo({
      lang: 'fr',
      title: 'Blog',
      description: 'Notes de conception, choix techniques et coulisses du développement de KROMA.',
      path: '/blog',
    }),
  }),
  component: BlogIndex,
});

export function BlogIndex() {
  const posts = getAllPosts();

  return (
    <Container>
      <div className="py-20 sm:py-28">
        <header className="max-w-2xl">
          <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Journal
          </p>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] text-text sm:text-5xl">
            Le blog KROMA
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Les décisions de conception, les choix techniques et les coulisses d’un serveur média
            écrit pour durer. Écrit en clair, sans langue de bois.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="mt-16 text-muted">Le premier article arrive bientôt.</p>
        ) : (
          <ul className="mt-14 flex flex-col divide-y divide-border/70 border-y border-border/70">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  className="group grid gap-4 py-8 transition-colors sm:grid-cols-[10rem_1fr] sm:gap-8"
                >
                  <div className="text-sm text-dim">
                    <time dateTime={post.date}>{post.dateLabel}</time>
                    <p className="mt-1">{post.readingMinutes} min de lecture</p>
                  </div>
                  <div>
                    {post.tags.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <h2 className="font-display text-2xl font-bold leading-snug text-text transition-colors group-hover:text-accent">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-muted">
                        {post.excerpt}
                      </p>
                    )}
                    <p className="mt-3 text-sm text-dim">Par {post.author}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
