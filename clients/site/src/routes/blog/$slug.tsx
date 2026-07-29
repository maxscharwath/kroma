import { IconArrowLeft } from '@tabler/icons-react';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { Container } from '#site/components/container';
import { getPost } from '#site/lib/blog';
import { seo } from '#site/lib/seo';

export const Route = createFileRoute('/blog/$slug')({
  // The loader validates the slug and returns only serializable metadata (for the
  // <head>). The compiled MDX component is NOT returned — it is a function, which
  // can't cross the SSR→client serialization boundary — the component below reads
  // it straight from the static import instead.
  loader: ({ params }) => {
    const post = getPost(params.slug);
    if (!post) throw notFound();
    const { Component: _Component, ...meta } = post;
    return { meta };
  },
  head: ({ loaderData }) => {
    const meta = loaderData?.meta;
    if (!meta) return {};
    return {
      ...seo({
        title: meta.title,
        description: meta.excerpt,
        path: `/blog/${meta.slug}`,
        image: meta.cover,
        type: 'article',
      }),
    };
  },
  component: BlogPost,
});

function BlogPost() {
  const { slug } = Route.useParams();
  const post = getPost(slug);
  // The loader already 404s on an unknown slug, so this is a type guard, not a
  // path a reader reaches.
  if (!post) return null;
  const { Component } = post;

  return (
    <Container size="prose">
      <article className="py-16 sm:py-20">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          <IconArrowLeft size={16} stroke={2} />
          Tous les articles
        </Link>

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
            <span>{post.author}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.date}>{post.dateLabel}</time>
            <span aria-hidden>·</span>
            <span>{post.readingMinutes} min de lecture</span>
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
