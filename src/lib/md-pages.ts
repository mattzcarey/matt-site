// Single source of truth for page content shared by the rendered .astro pages
// and the /md/* markdown endpoints (the bot/LLM-facing experience).

import type { CollectionEntry } from "astro:content";

export const SITE_URL = "https://mattzcarey.com";

export const home = {
  name: "Matt Carey",
  intro: "Hey I'm Matt,\nwelcome to my website.",
  socials: [
    { label: "GitHub", href: "https://github.com/mattzcarey" },
    { label: "Bluesky", href: "https://bsky.app/profile/mattzcarey.com" },
    { label: "X", href: "https://x.com/mattzcarey" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/mattzcarey/" },
  ],
};

export interface Project {
  period: string;
  name: string;
  href: string;
  kind: string;
  description: string;
}

export const projects: Project[] = [
  {
    period: "2025 - Present",
    name: "You've Been a Bad Agent",
    href: "https://bad-agent.transistor.fm/",
    kind: "podcast",
    description:
      "Wil and Matt discuss tech, startups, and building really cool things with AI. Sometimes joined by (actual expert) friends.",
  },
  {
    period: "2025 - Present",
    name: "Model Context Protocol",
    href: "https://github.com/modelcontextprotocol/typescript-sdk",
    kind: "open source",
    description: "maintainer of the TypeScript SDK.",
  },
  {
    period: "2024 - Present",
    name: "AI Demo Days",
    href: "https://lu.ma/ai-demo-days",
    kind: "events",
    description:
      "the best place to see new AI tech globally, events in London, SF, NYC, Stockholm..",
  },
  {
    period: "2024 - 2025",
    name: "OpenUK AI Advisory Board",
    href: "https://openuk.uk/",
    kind: "open source",
    description: "got to speak to some important people about AI.",
  },
  {
    period: "2022 - 2025",
    name: "Shippie",
    href: "https://github.com/mattzcarey/shippie",
    kind: "open source",
    description: "extensible AI code review tool",
  },
  {
    period: "2024 - 2024",
    name: "ParliamentWow",
    href: "https://parliamentwow.com",
    kind: "hackathon",
    description:
      "unpicking what actually happens in parliament. Winner of a16z Hack UK October 2024 with Sunil Pai and Thomas Ankcorn.",
  },
  {
    period: "2023 - 2023",
    name: "Quivr (YC W24)",
    href: "https://www.quivr.app",
    kind: "open source",
    description: "founding team member",
  },
];

export interface Role {
  period: string;
  company: string;
  href: string | null;
  title: string;
  description: string;
}

export const roles: Role[] = [
  {
    period: "2025 - Present",
    company: "Cloudflare",
    href: "https://cloudflare.com",
    title: "Senior Systems Engineer",
    description:
      "Agents and MCP. Built the first versions of Artifacts and maintain a bunch of tools for agents.",
  },
  {
    period: "2024 - 2025",
    company: "StackOne",
    href: "https://stackone.com",
    title: "Founding AI Engineer",
    description:
      "wrote code that generated integrations for APIs you use every day and built agents to automate our company. started AI Demo Days along the way. hired some much smarter friends, built a team and raised $20M from GV (Google Ventures).",
  },
  {
    period: "2022 - 2024",
    company: "aleios (part of Theodo Group)",
    href: "https://www.theodo.com/en-uk",
    title: "Cloud Engineer",
    description:
      "Cloud migrations and greenfield builds on AWS serverless. Made lots of friends and became an AWS Community Builder. Brought Serverless London back from the dead after covid - ran regular events and generally had a great time.",
  },
  {
    period: "2017 - 2021",
    company: "Professional Windsurfing",
    href: null,
    title: "Athlete & Coach",
    description:
      "Raced for Team Malta at World and European Championships, then coached junior, youth and Olympic-level athletes wanting to make waves on the world stage.",
  },
];

type Post = CollectionEntry<"blog">;

export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime(),
  );
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function homeMd(): string {
  const links = home.socials.map((s) => `- [${s.label}](${s.href})`).join("\n");
  return `# ${home.name}\n\n${home.intro.replace("\n", " ")}\n\nAI Engineer and Community Builder based between London and Lisbon.\n\nFind me on:\n\n${links}\n\nMore: [Blog](${SITE_URL}/md/blog/index.md) · [Projects](${SITE_URL}/md/projects.md) · [Work](${SITE_URL}/md/work.md)\n`;
}

export function projectsMd(): string {
  const items = projects
    .map((p) => `## [${p.name}](${p.href}) (${p.kind})\n\n${p.period} — ${p.description}`)
    .join("\n\n");
  return `# Projects\n\n${items}\n`;
}

export function workMd(): string {
  const items = roles
    .map((r) => {
      const company = r.href ? `[${r.company}](${r.href})` : r.company;
      return `## ${company} — ${r.title}\n\n${r.period} — ${r.description}`;
    })
    .join("\n\n");
  return `# Work\n\n${items}\n`;
}

export function blogIndexMd(posts: Post[]): string {
  const items = sortPosts(posts)
    .map((p) => `- ${isoDate(p.data.pubDate)} — [${p.data.title}](${SITE_URL}/md/blog/${p.id})`)
    .join("\n");
  return `# Posts\n\n${items}\n\nAll medium posts: https://medium.com/@mattzcarey\n`;
}

export function postMd(post: Post): string {
  const lines = [
    "---",
    `title: "${post.data.title.replaceAll('"', '\\"')}"`,
    ...(post.data.description
      ? [`description: "${post.data.description.replaceAll('"', '\\"')}"`]
      : []),
    `pubDate: ${isoDate(post.data.pubDate)}`,
    `canonical: ${SITE_URL}/blog/${post.id}/`,
    "---",
    "",
    post.body ?? "",
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}
