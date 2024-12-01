"use client";

import { useEffect, useState } from "react";
import MotionWrapper from "./motion-wrapper";

interface MediumItem {
  title: string;
  pubDate: string;
  link: string;
}

export const MediumArticles = (): JSX.Element => {
  const [items, setItems] = useState<MediumItem[]>([]);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch(
        "https://api.rss2json.com/v1/api.json?rss_url=https://mattzcarey.medium.com/feed"
      );
      const data = await res.json();
      const items: MediumItem[] = data.items;
      setItems(items);
    }
    fetchData();
  }, []);

  return (
    <section>
      {items.map((item, index) => (
        <div key={index} className="text-neutral-500 dark:text-neutral-400">
          <div className="flex">
            <MotionWrapper>
              <a
                href={item.link}
                target={"_blank"}
                className="flex items-center hover:text-neutral-700 dark:hover:text-neutral-200 transition-all"
                rel="noopener noreferrer"
              >
                <h3 className="font-bold text-md font-serif">{item.title}</h3>
              </a>
            </MotionWrapper>
          </div>
        </div>
      ))}
    </section>
  );
};

export default MediumArticles;
