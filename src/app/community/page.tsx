import { Link } from "@/components/links";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Organiser of the GenAI London Meetup, Serverless London meetup, Co-Founder of GenAI Days, and Founder of AI Product Engineering.",
};

const CommunityPage = () => {
  return (
    <section>
      <h1 className="font-bold text-3xl font-serif">Community</h1>
      <div className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200">
        <p>
          I am the organiser of the{" "}
          <Link
            to="https://www.meetup.com/genai-london"
            className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200"
          >
            GenAI London Meetup
          </Link>{" "}
          and the{" "}
          <Link
            to="https://www.meetup.com/serverless-london"
            className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200"
          >
            Serverless London meetup
          </Link>
          .<br />
          <br />
          Recently I started a new event series -{" "}
          <Link
            to="https://www.lu.ma/ai-demo-days"
            className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200"
          >
            AI Demo Days,
          </Link>{" "}
          with the aim to bring together the London AI community to build a
          place where demos can become companies.
        </p>
      </div>
    </section>
  );
};

export default CommunityPage;
