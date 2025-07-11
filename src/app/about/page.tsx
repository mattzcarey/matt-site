import type { Metadata } from "next";
import { Link } from "@/components/links";
import { Footer } from "./footer";

export const metadata: Metadata = {
  title: "About",
  description: "AI Engineer & Community Builder.",
};

export default function AboutPage() {
  return (
    <section>
      <h1 className="font-bold text-3xl font-serif">About Me</h1>
      <div className="my-5 prose prose-neutral text-neutral-800 dark:text-neutral-200">
        <p>
          I am an AI engineer at{" "}
          <Link
            to="https://github.com/mattzcarey/code-review-gpt"
            className="my-5 prose prose-neutral text-neutral-800 dark:text-neutral-200"
          >
            StackOne
          </Link>{" "}
          building data integration tools for AI agents. I also organise the
          GenAI London Meetup and am a Co-Founder of GenAI Days - a global
          collective of AI enthusiasts.
        </p>
      </div>
      <div className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200">
        <p>
          Previously I spent time in consultancy building scalable event-driven
          applications for startups and enterprises on AWS. I continue to
          organize the Serverless London Meetup.
        </p>
        <hr />
        <p>
          I retired from a short professional windsurfing career in December
          2020. Since then I have worked as a performance coach for junior and
          youth-age and olympic level athletes wanting to make waves on the
          international stage.
        </p>
        <p>
          Outside of tech and sport, I&apos;m an advocate for sustainability and the
          plant-based movement.
        </p>
        <hr />
      </div>
      <Footer />
    </section>
  );
}
