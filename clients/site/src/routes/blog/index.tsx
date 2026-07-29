import { createFileRoute } from '@tanstack/react-router';
import { Container } from '#site/components/container';
import { L } from '#site/components/localized-link';
import { getAllPosts } from '#site/lib/blog';
import { useLang } from '#site/lib/i18n';
import { seo } from '#site/lib/seo';

export const Route = createFileRoute('/blog/')({
  head: () => ({
    ...seo({
      lang: 'en',
      title: 'Blog',
      description: 'Design notes, technical choices and the making of KROMA.',
      path: '/blog',
    }),
  }),
  component: BlogIndex,
});

const copy = {
  fr: {
    eyebrow: 'Journal',
    heading: 'Le blog KROMA',
    intro:
      'Les décisions de conception, les choix techniques et les coulisses d’un serveur média écrit pour durer. Écrit en clair, sans langue de bois.',
    readingSuffix: 'min de lecture',
    by: 'Par',
    empty: 'Le premier article arrive bientôt.',
  },
  en: {
    eyebrow: 'Journal',
    heading: 'The KROMA blog',
    intro:
      'Design decisions, technical choices and the making of a media server built to last. Written plainly, no spin.',
    readingSuffix: 'min read',
    by: 'By',
    empty: 'The first article is coming soon.',
  },
} as const;

export function BlogIndex() {
  const lang = useLang();
  const t = copy[lang];
  const posts = getAllPosts(lang);

  return (
    <Container>
      <div className="py-20 sm:py-28">
        <header className="max-w-2xl">
          <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
            {t.eyebrow}
          </p>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] text-text sm:text-5xl">
            {t.heading}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">{t.intro}</p>
        </header>

        {posts.length === 0 ? (
          <p className="mt-16 text-muted">{t.empty}</p>
        ) : (
          <ul className="mt-14 flex flex-col divide-y divide-border/70 border-y border-border/70">
            {posts.map((post) => (
              <li key={post.slug}>
                <L
                  to={`/blog/${post.slug}`}
                  className="group grid gap-4 py-8 transition-colors sm:grid-cols-[10rem_1fr] sm:gap-8"
                >
                  <div className="text-sm text-dim">
                    <time dateTime={post.date}>{post.dateLabel}</time>
                    <p className="mt-1">
                      {post.readingMinutes} {t.readingSuffix}
                    </p>
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
                    <p className="mt-3 text-sm text-dim">
                      {t.by} {post.author}
                    </p>
                  </div>
                </L>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
