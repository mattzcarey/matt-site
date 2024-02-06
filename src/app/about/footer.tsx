import {
  ArrowIcon,
  GitHubIcon,
  LinkedinIcon,
  TwitterIcon,
} from "components/icons";

export const Footer = () => {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:gap-2">
      <a
        rel="noopener noreferrer"
        target="_blank"
        href="https://twitter.com/mattzcarey"
        className="flex w-full border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 no-underline items-center text-neutral-800 dark:text-neutral-200 hover:dark:bg-neutral-900 hover:bg-neutral-100 transition-all justify-between"
      >
        <div className="flex items-center">
          <TwitterIcon />
          <div className="ml-3">Twitter</div>
        </div>
        <ArrowIcon />
      </a>
      <a
        rel="noopener noreferrer"
        target="_blank"
        href="https://github.com/mattzcarey"
        className="flex w-full border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 no-underline items-center text-neutral-800 dark:text-neutral-200 hover:dark:bg-neutral-900 hover:bg-neutral-100 transition-all justify-between"
      >
        <div className="flex items-center">
          <GitHubIcon />
          <div className="ml-3">GitHub</div>
        </div>
        <ArrowIcon />
      </a>
      <a
        rel="noopener noreferrer"
        target="_blank"
        href="https://www.linkedin.com/in/mattzcarey"
        className="flex w-full border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 no-underline items-center text-neutral-800 dark:text-neutral-200 hover:dark:bg-neutral-900 hover:bg-neutral-100 transition-all justify-between"
      >
        <div className="flex items-center">
          <LinkedinIcon />
          <div className="ml-3">Linkedin</div>
        </div>
        <ArrowIcon />
      </a>
    </div>
  );
};
