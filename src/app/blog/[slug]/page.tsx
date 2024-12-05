import BlueskyComments from 'components/bluesky-comments';
import { NewsletterSignup } from 'components/newsletter';
import fs from 'fs';
import matter from 'gray-matter';
import 'katex/dist/katex.min.css';
import { Metadata } from 'next';
import path from 'path';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { remark } from 'remark';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeImg from 'rehype-img-size';
import './prose.css';

type Props = {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const blogDir = path.join(process.cwd(), 'blog');
  const filePath = path.join(blogDir, `${params.slug}.md`);
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data } = matter(fileContents);

  return {
    title: data.title,
    ...(data.image ? {
      openGraph: {
        images: [data.image],
      },
      twitter: {
        card: 'summary_large_image',
        images: [data.image],
      },
    } : {
      twitter: {
        card: 'summary',
      },
    }),
  };
}

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
  
  const processedContent = await remark()
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeImg, { dir: 'public' })
    .use(rehypeStringify)
    .process(content);
    
  const contentHtml = processedContent.toString();

  return (
    <article className="prose prose-neutral dark:prose-invert w-full max-w-none">
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