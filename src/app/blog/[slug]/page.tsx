import BlueskyComments from 'components/bluesky-comments';
import { NewsletterSignup } from 'components/newsletter';
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import { remark } from 'remark';
import html from 'remark-html';
import './prose.css';

export async function generateStaticParams() {
  const blogDir = path.join(process.cwd(), 'blog');
  const files = fs.readdirSync(blogDir);
  return files.map((filename) => ({
    slug: filename.replace('.md', ''),
  }));
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const blogDir = path.join(process.cwd(), 'blog');
  const filePath = path.join(blogDir, `${params.slug}.md`);
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);
  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  return (
    <article className="prose prose-neutral dark:prose-invert mx-auto">
      <h1>{data.title}</h1>
      <p className="text-gray-500">{new Date(data.date).toLocaleDateString()}</p>
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
      {data.bluesky_post_uri && (
        <BlueskyComments uri={data.bluesky_post_uri} />
      )}
      <NewsletterSignup />
    </article>
  );
}