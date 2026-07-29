import { IconArrowRight } from '@tabler/icons-react';
import { Container } from '#site/components/container';
import { L } from '#site/components/localized-link';
import { getAllPosts } from '#site/lib/blog';
import { useLang } from '#site/lib/i18n';

const copy = {
  fr: {
    eyebrow: 'Journal',
    heading: 'Depuis le blog',
    all: 'Tous les articles',
    readingSuffix: 'min de lecture',
  },
  en: {
    eyebrow: 'Journal',
    heading: 'From the blog',
    all: 'All articles',
    readingSuffix: 'min read',
  },
} as const;

// The two most recent posts, as editorial cards. Resolved at build time from the
// MDX glob, so this renders in the prerender with no fetch. Renders nothing at all
// when the blog is empty, a "coming soon" placeholder on the home page would read
// as unfinished, which is worse than absence.
export function BlogTeaser() {
  const lang = useLang();
  const t = copy[lang];
  const posts = getAllPosts(lang).slice(0, 2);
  if (posts.length === 0) return null;

  const single = posts.length === 1;

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
              {t.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-extrabold leading-[1.05] text-text sm:text-4xl">
              {t.heading}
            </h2>
          </div>
          <L
            to="/blog"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-accent"
          >
            {t.all}
            <IconArrowRight
              size={16}
              stroke={2}
              aria-hidden
              className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            />
          </L>
        </div>

        <div className={`mt-10 grid gap-4 ${single ? '' : 'md:grid-cols-2'}`}>
          {posts.map((post) => (
            <L
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-border bg-surface-1/40 p-6 transition-colors duration-200 hover:border-border-strong hover:bg-surface-1 sm:p-8"
            >
              {post.tags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
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
              <h3 className="font-display text-xl font-bold leading-snug text-text transition-colors group-hover:text-accent sm:text-2xl">
                {post.title}
              </h3>
              {post.excerpt && (
                <p className="mt-3 flex-1 text-pretty leading-relaxed text-muted">{post.excerpt}</p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs text-dim">
                <span>{post.author}</span>
                <span aria-hidden>·</span>
                <time dateTime={post.date}>{post.dateLabel}</time>
                <span aria-hidden>·</span>
                <span>
                  {post.readingMinutes} {t.readingSuffix}
                </span>
              </div>
            </L>
          ))}
        </div>
      </Container>
    </section>
  );
}
