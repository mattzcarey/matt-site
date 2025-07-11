import MediumArticles from "@/components/medium";
import type { Metadata } from "next";
import { getAllBlogPosts } from "@/lib/blog";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog",
  description: "Read some blog posts.",
};

export default async function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <section>
      <h1 className="font-bold text-3xl font-serif mb-5">Blog</h1>
      <div className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200">
        <h2 className="text-2xl font-semibold mb-4">Latest Posts</h2>
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="text-blue-500 hover:underline"
              >
                {post.title}
              </Link>
              <p className="text-sm text-gray-500">
                {new Date(post.date).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
        <h2 className="text-2xl font-semibold mt-8 mb-4">Medium Articles</h2>
        <MediumArticles />
      </div>
    </section>
  );
}
