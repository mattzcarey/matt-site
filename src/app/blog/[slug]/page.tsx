import BlueskyComments from 'components/bluesky-comments';
import { NewsletterSignup } from 'components/newsletter';
import fs from 'fs';
import matter from 'gray-matter';
import 'katex/dist/katex.min.css';
import { Metadata } from 'next';
import path from 'path';
import rehypeImg from 'rehype-img-size';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { remark } from 'remark';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import './prose.css';

type Props = {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const blogDir = path.join(process.cwd(), 'blog');
  const filePath = path.join(blogDir, `${params.slug}.md`);
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data } = matter(fileContents);

  const baseUrl = 'https://mattzcarey.com';
  const imageUrl = data.image ? 
    `${baseUrl}${data.image}` : `${baseUrl}/og.jpg`;
  const canonicalUrl = `${baseUrl}/blog/${params.slug}`;

  return {
    title: {
      absolute: `${data.title} | Matt's Blog`,
    },
    description: data.description || "AI Engineer and Community Builder based in London.",
    keywords: data.tags || ["AI", "Machine Learning", "Engineering"],
    authors: [{ name: "Matt Carey" }],
    openGraph: {
      title: data.title + " | Matt's Blog",
      description: data.description || "AI Engineer and Community Builder based in London.",
      url: canonicalUrl,
      siteName: "Matt Carey",
      images: [{
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: data.title,
      }],
      locale: "en-GB",
      type: "article",
      publishedTime: data.date,
      authors: ["Matt Carey"],
    },
    twitter: {
      card: "summary_large_image",
      title: data.title + " | Matt's Blog",
      description: data.description || "AI Engineer and Community Builder based in London.",
      images: [imageUrl],
      creator: "@mattzcarey",
    },
    alternates: {
      canonical: canonicalUrl,
    },
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
      {data.image && (
        <div className="flex justify-center">
          <img 
            src={data.image} 
            alt={data.title}
            className="rounded-lg max-h-[400px] object-cover"
          />
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
      {data.bluesky_post_uri && (
        <BlueskyComments uri={data.bluesky_post_uri} />
      )}
      <NewsletterSignup />
    </article>
  );
}