import { createFileRoute, notFound } from '@tanstack/react-router';
import { getPost } from '#site/lib/blog';
import { seo } from '#site/lib/seo';
import { BlogPost } from '#site/routes/blog/$slug';

export const Route = createFileRoute('/en/blog/$slug')({
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
        lang: 'en',
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
