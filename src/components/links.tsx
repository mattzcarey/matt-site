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

export const Link = ({ to, className, children }) => (
  <a href={to} className={className}>
    {children}
  </a>
);

export const IframeEmbed = ({ src, width, height }) => {
  return (
    <iframe
      src={src}
      width={width}
      height={height}
      style={{border: "1px solid #bfcbda88", borderRadius: "4px"}}
      allowFullScreen={true}
      aria-hidden="false"
      tabIndex={0}
    ></iframe>
  );
};