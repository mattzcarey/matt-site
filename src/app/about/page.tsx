import type { Metadata } from "next";
import { Footer } from "./footer";

export const metadata: Metadata = {
  title: "About",
  description: "Serverless developer & AWS Community Builder.",
};

export default function AboutPage() {
  return (
    <section>
      <h1 className="font-bold text-3xl font-serif">About Me</h1>
      <p className="my-5 prose prose-neutral text-neutral-800 dark:text-neutral-200">
        I am developer at Aleios, AWS Community Builder and co-founder of GenAI
        Days: the global collective for GenAI.
      </p>
      <div className="prose prose-neutral dark:prose-invert text-neutral-800 dark:text-neutral-200">
        <p>
          At aleios, we build scalable event-driven applications for startups
          and enterprises predominantly with AWS. I organize the Serverless
          London Meetup and publish a blog on all things Serverless and GenAI.
        </p>
        <hr />
        <p>
          I retired from a very short professional windsurfing career in
          December 2020. Since then I have worked as a performance coach for
          junior and youth-age and olympic level athletes wanting to make waves
          on the international stage.
        </p>
        <p>
          Outside of tech and sport, I'm an advocate for sustainability and the
          plant-based movement.
        </p>
        <hr />
      </div>
      <Footer />
    </section>
  );
}
