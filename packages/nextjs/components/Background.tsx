export const BackGround = () => {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-50 hidden overflow-hidden dark:block"
      aria-hidden="true"
    >
      <div
        className="absolute top-1/2 left-1/2 h-[70vh] w-[70vh] max-h-[630px] max-w-[630px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          backgroundColor: "rgba(230, 15, 119, 0.33)",
          filter: "blur(254.85px)",
        }}
      />
      <div
        className="absolute top-0 -right-12 h-[400px] w-[400px] -translate-y-1/2 rounded-full sm:h-[630px] sm:w-[630px]"
        style={{
          backgroundColor: "#224457",
          filter: "blur(164.85px)",
        }}
      />
      <div
        className="absolute top-0 -left-12 h-[400px] w-[400px] -translate-y-1/2 rounded-full sm:h-[630px] sm:w-[630px]"
        style={{
          backgroundColor: "#252525",
          filter: "blur(274.85px)",
        }}
      />
    </div>
  );
};
