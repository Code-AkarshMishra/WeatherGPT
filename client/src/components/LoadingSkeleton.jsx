export default function LoadingSkeleton({ width, height = 16, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width: width ? `${width}px` : '100%', height: `${height}px`, ...style }}
      aria-hidden="true"
    />
  );
}
