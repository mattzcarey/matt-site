import { Link } from "@/components/links";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Creator of Code Review GPT, founding team at Quivr and building lang.new for my mum.",
};

const ProjectsPage = () => {
  return (
    <section>
      <h1 className="font-bold text-3xl font-serif">Projects</h1>
      <div className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200">
        <p>
          I am the creator of{" "}
          <Link
            to="https://github.com/mattzcarey/code-review-gpt"
            className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200"
          >
            Code Review GPT
          </Link>{" "}
          and was on the founding team at{" "}
          <Link
            to="https://www.quivr.app"
            className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200"
          >
            Quivr (YC W24).
          </Link>
          <br />
          <br />
          Currently building{" "}
          <Link
            to="https://lang.new"
            className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200"
          >
            lang.new
          </Link>{" "}
          for my mum. Also working on [a
          project](https://parliament-wow.threepointone.workers.dev/) to help
          people understand what is happening in parliament.
        </p>
        <hr className="my-4" />
      </div>
    </section>
  );
};

export default ProjectsPage;
