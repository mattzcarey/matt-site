export const YouTubeEmbed = ({ videoId }) => {
  return (
    <iframe
      width="560"
      height="315"
      src={videoId}
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    ></iframe>
  );
};

export const Link = ({ to, children }) => {
  return (
    <a href={to} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};
