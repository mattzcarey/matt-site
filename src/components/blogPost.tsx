import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";

interface BlogPost {
  slug: string;
  title: string;
  date: string;
}

export default function MarkdownBlogPosts() {
  const blogDir = path.join(process.cwd(), "blog");
  const files = fs.readdirSync(blogDir);

  const posts: BlogPost[] = files
    .map((filename) => {
      const slug = filename.replace(".md", "");
      const filePath = path.join(blogDir, filename);
      const fileContents = fs.readFileSync(filePath, "utf8");
      const { data } = matter(fileContents);
      return {
        slug,
        title: data.title,
        date: data.date,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
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
  );
}
