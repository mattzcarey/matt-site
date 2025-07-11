import { ArrowIcon } from "@/components/icons";
import Image from "next/image";
import me from "./avatar.jpg";

const name = "Matt Carey";

export const revalidate = 60;

export default async function HomePage() {
  return (
    <section>
      <h1 className="font-bold text-3xl font-serif">{name}</h1>
      <p className="my-5 max-w-[460px] text-neutral-800 dark:text-neutral-200">
        Hey I&apos;m Matt, welcome to my website.
      </p>
      <div className="flex items-start md:items-center my-8 flex-col md:flex-row">
        <Image
          alt={name}
          className="rounded-full grayscale"
          src={me}
          placeholder="blur"
          width={100}
          priority
        />
      </div>
      <ul className="flex flex-col md:flex-row mt-8 space-x-0 md:space-x-4 space-y-2 md:space-y-0 font-sm text-neutral-500 dark:text-neutral-400">
        <li>
          <a
            className="flex items-center hover:text-neutral-700 dark:hover:text-neutral-200 transition-all"
            rel="noopener noreferrer"
            target="_blank"
            href="https://bsky.app/profile/mattzcarey.com"
          >
            <ArrowIcon />
            <p className="h-7">follow me on bluesky</p>
          </a>
        </li>
      </ul>
      <ul className="flex flex-col md:flex-row mt-8 space-x-0 md:space-x-4 space-y-2 md:space-y-0 font-sm text-neutral-500 dark:text-neutral-400">
        <li>
          <a
            className="flex items-center hover:text-neutral-700 dark:hover:text-neutral-200 transition-all"
            rel="noopener noreferrer"
            target="_blank"
            href="https://www.linkedin.com/in/mattzcarey/"
          >
            <ArrowIcon />
            <p className="h-7">connect on linkedin</p>
          </a>
        </li>
      </ul>
    </section>
  );
}
