import { Link, YouTubeEmbed } from "components/links";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description: "Creator of Code Review GPT and core builder at Quivr",
};

const AboutPage = () => {
  return (
    <section>
      <h1 className="font-bold text-3xl font-serif">Projects</h1>
      <div className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200">
        <p>
          I am the creator of{" "}
          <Link to="https://github.com/mattzcarey/code-review-gpt">
            Code Review GPT
          </Link>{" "}
          and core builder at <Link to="https://www.quivr.app">Quivr</Link>.
        </p>
        <p>
          I also write a weekly newsletter called{" "}
          <Link to="https://newsletter.quivr.app">Building With GenAI</Link> for
          people interested in the wonderful and fast moving world of Generative
          AI.
        </p>
        <hr className="my-4" />
      </div>
      <div className="mt-8">
        {" "}
        <YouTubeEmbed videoId="https://www.youtube.com/embed/GWoLU9p461Y" />
      </div>
    </section>
  );
};

export default AboutPage;
