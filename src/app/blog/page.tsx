import MediumArticles from "components/medium";
import type { Metadata } from "next";
import MarkdownBlogPosts from "../../components/blogPost";

export const metadata: Metadata = {
  title: "Blog",
  description: "Read some blog posts.",
};

export default async function BlogPage() {
  return (
    <section>
      <h1 className="font-bold text-3xl font-serif mb-5">Blog</h1>
      <div className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200">
        <h2 className="text-2xl font-semibold mb-4">Latest Posts</h2>
        <MarkdownBlogPosts />
        <h2 className="text-2xl font-semibold mt-8 mb-4">Medium Articles</h2>
        <MediumArticles />
      </div>
    </section>
  );
}
