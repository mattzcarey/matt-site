import MediumArticles from "components/medium";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  description: "Read some blog posts.",
};

export default async function BlogPage() {
  return (
    <section>
      <h1 className="font-bold text-3xl font-serif">Blog</h1>
      <div className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200">
        <MediumArticles />
      </div>
    </section>
  );
}
