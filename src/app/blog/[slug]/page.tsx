import BlueskyComments from "@/components/bluesky-comments";
import NewsletterSignup from "@/components/newsletter";
import ElevenLabsAudioNative from "@/components/voicePlayer";
import { getBlogPost, getAllBlogSlugs } from "@/lib/blog";
import "katex/dist/katex.min.css";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import rehypeImg from "rehype-img-size";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { remark } from "remark";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import "./prose.css";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  
  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const baseUrl = "https://mattzcarey.com";
  const imageUrl = post.image ? `${baseUrl}${post.image}` : `${baseUrl}/og.jpg`;
  const canonicalUrl = `${baseUrl}/blog/${slug}`;

  return {
    title: {
      absolute: `${post.title} | Matt's Blog`,
    },
    description:
      post.description || "AI Engineer and Community Builder based in London.",
    keywords: post.tags || ["AI", "Machine Learning", "Engineering"],
    authors: [{ name: "Matt Carey" }],
    openGraph: {
      title: post.title + " | Matt's Blog",
      description:
        post.description ||
        "AI Engineer and Community Builder based in London.",
      url: canonicalUrl,
      siteName: "Matt Carey",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      locale: "en-GB",
      type: "article",
      publishedTime: post.date,
      authors: ["Matt Carey"],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title + " | Matt's Blog",
      description:
        post.description ||
        "AI Engineer and Community Builder based in London.",
      images: [imageUrl],
      creator: "@mattzcarey",
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export async function generateStaticParams() {
  const slugs = getAllBlogSlugs();
  return slugs.map((slug) => ({
    slug,
  }));
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  
  if (!post) {
    notFound();
  }

  const processedContent = await remark()
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeImg, { dir: "public" })
    .use(rehypeStringify)
    .process(post.content);

  const contentHtml = processedContent.toString();

  return (
    <article className="prose prose-neutral dark:prose-invert w-full max-w-none">
      <h1>{post.title}</h1>
      <p className="text-gray-500">
        {new Date(post.date).toLocaleDateString()}
      </p>
      {post.image && (
        <div className="flex justify-center mb-8">
          <img
            src={post.image}
            alt={post.title}
            className="rounded-lg max-h-[400px] object-cover"
          />
        </div>
      )}
      <div className="mb-8">
        <ElevenLabsAudioNative
          publicUserId="d9ac654064df1d8d2ace9a730b19fc2ffa05fa2d985d7acc665a5259b7aca2c3"
          size="small"
        />
      </div>
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
      {post.bluesky_post_uri && <BlueskyComments uri={post.bluesky_post_uri} />}
      <NewsletterSignup />
    </article>
  );
}
