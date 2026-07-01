// The LOCKED content of the site. This is the single source of truth that the
// host injects into every remix at serve time (see router.ts). Remixers can
// restyle and rebuild the presentation however they like, but they never get to
// edit these bytes — the studio re-injects this object on every render and the
// integrity check rejects any build that drops the content plumbing.
//
// Keep this in sync with src/pages/*. It is deliberately a plain data
// object (no markup) so presentation is 100% the remixer's job.

export interface SocialLink {
  label: string;
  href: string;
}

export interface TimelineEntry {
  period: string;
  title: string;
  href: string | null;
  kind?: string;
  description: string;
}

export interface SiteContent {
  name: string;
  tagline: string;
  intro: string;
  avatar: string;
  socials: SocialLink[];
  work: TimelineEntry[];
  projects: TimelineEntry[];
}

export const SITE_CONTENT: SiteContent = {
  name: "Matt Carey",
  tagline: "AI Engineer and Community Builder based in London.",
  intro: "Hey I'm Matt, welcome to my website.",
  avatar: "/avatar.jpg",
  socials: [
    { label: "GitHub", href: "https://github.com/mattzcarey" },
    { label: "Bluesky", href: "https://bsky.app/profile/mattzcarey.com" },
    { label: "X", href: "https://x.com/mattzcarey" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/mattzcarey/" },
  ],
  work: [
    {
      period: "2025 - Present",
      title: "Cloudflare",
      href: "https://cloudflare.com",
      kind: "Senior Systems Engineer",
      description:
        "Agents and MCP. Built the first versions of Artifacts and maintain a bunch of tools for agents.",
    },
    {
      period: "2024 - 2025",
      title: "StackOne",
      href: "https://stackone.com",
      kind: "Founding AI Engineer",
      description:
        "wrote code that generated integrations for APIs you use every day and built agents to automate our company. started AI Demo Days along the way. hired some much smarter friends, built a team and raised $20M from GV (Google Ventures).",
    },
    {
      period: "2022 - 2024",
      title: "aleios (part of Theodo Group)",
      href: "https://www.theodo.com/en-uk",
      kind: "Cloud Engineer",
      description:
        "Cloud migrations and greenfield builds on AWS serverless. Made lots of friends and became an AWS Community Builder. Brought Serverless London back from the dead after covid - ran regular events and generally had a great time.",
    },
    {
      period: "2017 - 2021",
      title: "Professional Windsurfing",
      href: null,
      kind: "Athlete & Coach",
      description:
        "Raced for Team Malta at World and European Championships, then coached junior, youth and Olympic-level athletes wanting to make waves on the world stage.",
    },
  ],
  projects: [
    {
      period: "2025 - Present",
      title: "You've Been a Bad Agent",
      href: "https://bad-agent.transistor.fm/",
      kind: "podcast",
      description:
        "Wil and Matt discuss tech, startups, and building really cool things with AI. Sometimes joined by (actual expert) friends.",
    },
    {
      period: "2025 - Present",
      title: "Model Context Protocol",
      href: "https://github.com/modelcontextprotocol/typescript-sdk",
      kind: "open source",
      description: "maintainer of the TypeScript SDK.",
    },
    {
      period: "2024 - Present",
      title: "AI Demo Days",
      href: "https://lu.ma/ai-demo-days",
      kind: "events",
      description:
        "the best place to see new AI tech globally, events in London, SF, NYC, Stockholm..",
    },
    {
      period: "2024 - 2025",
      title: "OpenUK AI Advisory Board",
      href: "https://openuk.uk/",
      kind: "open source",
      description: "got to speak to some important people about AI.",
    },
    {
      period: "2022 - 2025",
      title: "Shippie",
      href: "https://github.com/mattzcarey/shippie",
      kind: "open source",
      description: "extensible AI code review tool",
    },
    {
      period: "2024 - 2024",
      title: "ParliamentWow",
      href: "https://parliamentwow.com",
      kind: "hackathon",
      description:
        "unpicking what actually happens in parliament. Winner of a16z Hack UK October 2024 with Sunil Pai and Thomas Ankcorn.",
    },
    {
      period: "2023 - 2023",
      title: "Quivr (YC W24)",
      href: "https://www.quivr.app",
      kind: "open source",
      description: "founding team member",
    },
  ],
};

// Flattened list of every canonical content string that MUST survive a remix.
// Used both to seed the agent's read-only context and to power the integrity
// check that rejects a build which dropped Matt's content.
export function canonicalStrings(c: SiteContent = SITE_CONTENT): string[] {
  const out = [c.name, c.tagline, c.intro];
  for (const s of c.socials) out.push(s.href);
  for (const group of [c.work, c.projects]) {
    for (const e of group) {
      out.push(e.title, e.description);
      if (e.href) out.push(e.href);
    }
  }
  return out;
}
