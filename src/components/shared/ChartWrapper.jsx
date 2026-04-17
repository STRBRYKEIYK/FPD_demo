import React, { useRef, useState, useEffect } from "react";
import { ResponsiveContainer } from "recharts";

export default function ChartWrapper({
  children,
  height = 300,
  width = "100%",
  className = "",
}) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const check = () => {
      const w = el.clientWidth || 0;
      const h = el.clientHeight || (typeof height === "number" ? height : 0);
      setReady(w > 0 && h > 0);
    };

    check();
    let ro = null;
    try {
      ro = new ResizeObserver(check);
      ro.observe(el);
    } catch (e) {
      // ResizeObserver may not be available in some environments
    }

    return () => {
      if (ro && ro.disconnect) ro.disconnect();
    };
  }, [height]);

  const style = { minWidth: 0, overflow: "hidden", position: "relative" };
  if (typeof height === "number") style.minHeight = height;

  return (
    <div ref={ref} className={className} style={style}>
      {ready ? (
        <ResponsiveContainer width={width} height={height}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
