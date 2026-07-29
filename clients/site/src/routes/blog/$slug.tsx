import { IconArrowLeft } from '@tabler/icons-react';
import { createFileRoute, notFound, useParams } from '@tanstack/react-router';
import { Container } from '#site/components/container';
import { L } from '#site/components/localized-link';
import { getPost } from '#site/lib/blog';
import { useLang } from '#site/lib/i18n';
import { useBlogCopy } from '#site/lib/messages/blog';
import { seo } from '#site/lib/seo';

export const Route = createFileRoute('/blog/$slug')({
  // The loader validates the slug and returns only serializable metadata (for the
  // <head>). The compiled MDX component is NOT returned, it is a function, which
  // can't cross the SSR→client serialization boundary, the component below reads
  // it straight from the static import instead.
  loader: ({ params }) => {
    const post = getPost(params.slug, 'en');
    if (!post) throw notFound();
    const { Component: _Component, ...meta } = post;
    return { meta };
  },
  head: ({ loaderData }) => {
    const meta = loaderData?.meta;
    if (!meta) return {};
    return seo({
      lang: 'en',
      title: meta.title,
      description: meta.excerpt,
      path: `/blog/${meta.slug}`,
      image: meta.cover,
      type: 'article',
    });
  },
  component: BlogPost,
});

export function BlogPost() {
  // `strict: false` so the one component serves both /blog/$slug and
  // /en/blog/$slug without binding to a single route's params.
  const slug = useParams({ strict: false }).slug;
  const lang = useLang();
  const t = useBlogCopy();
  const post = slug ? getPost(slug, lang) : undefined;
  // The loader already 404s on an unknown slug, so this is a type guard, not a
  // path a reader reaches.
  if (!post) return null;
  const { Component } = post;

  return (
    <Container size="prose">
      <article className="py-16 sm:py-20">
        <L
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          <IconArrowLeft size={16} stroke={2} aria-hidden />
          {t.post.back}
        </L>

        <header className="mt-8">
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
          <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.08] text-text sm:text-5xl">
            {post.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dim">
            <span>
              {t.by} {post.author}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={post.date}>{post.dateLabel}</time>
            <span aria-hidden>·</span>
            <span>
              {post.readingMinutes} {t.readingSuffix}
            </span>
          </div>
        </header>

        <div className="mt-12 h-px bg-border" />

        <div className="prose-kroma mt-12">
          <Component />
        </div>
      </article>
    </Container>
  );
}
