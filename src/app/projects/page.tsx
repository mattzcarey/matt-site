import { Link } from "@/components/links";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Creator of Shippie, an extensible AI code review tool, and founding team at Quivr (YC W24).",
};

const ProjectsPage = () => {
  return (
    <section>
      <h1 className="font-bold text-3xl font-serif">Projects</h1>
      <div className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200">
        <p>
          I am the creator of{" "}
          <Link
            to="https://github.com/mattzcarey/shippie"
            className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200"
          >
            Shippie, an extensible AI code review tool,
          </Link>{" "}
          and was on the founding team at{" "}
          <Link
            to="https://www.quivr.app"
            className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200"
          >
            Quivr (YC W24).
          </Link>
          <br />
        </p>
        <hr className="my-4" />
      </div>
    </section>
  );
};

export default ProjectsPage;
