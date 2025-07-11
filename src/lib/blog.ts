import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  description?: string;
  image?: string;
  tags?: string[];
  bluesky_post_uri?: string;
}

export interface BlogPostWithContent extends BlogPost {
  content: string;
}

export function getAllBlogPosts(): BlogPost[] {
  const blogDir = path.join(process.cwd(), "blog");
  
  if (!fs.existsSync(blogDir)) {
    return [];
  }
  
  const files = fs.readdirSync(blogDir);
  
  const posts: BlogPost[] = files
    .filter(filename => filename.endsWith('.md'))
    .map((filename) => {
      const slug = filename.replace(".md", "");
      const filePath = path.join(blogDir, filename);
      const fileContents = fs.readFileSync(filePath, "utf8");
      const { data } = matter(fileContents);
      
      return {
        slug,
        title: data.title,
        date: data.date,
        description: data.description,
        image: data.image,
        tags: data.tags,
        bluesky_post_uri: data.bluesky_post_uri,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
}

export function getBlogPost(slug: string): BlogPostWithContent | null {
  const blogDir = path.join(process.cwd(), "blog");
  const filePath = path.join(blogDir, `${slug}.md`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const fileContents = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContents);
  
  return {
    slug,
    title: data.title,
    date: data.date,
    description: data.description,
    image: data.image,
    tags: data.tags,
    bluesky_post_uri: data.bluesky_post_uri,
    content,
  };
}

export function getAllBlogSlugs(): string[] {
  const blogDir = path.join(process.cwd(), "blog");
  
  if (!fs.existsSync(blogDir)) {
    return [];
  }
  
  const files = fs.readdirSync(blogDir);
  return files
    .filter(filename => filename.endsWith('.md'))
    .map(filename => filename.replace('.md', ''));
}