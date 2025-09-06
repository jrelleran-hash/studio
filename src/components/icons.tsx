import type { SVGProps } from "react";

export function CoreFlowLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2l-5.5 9h11L12 2z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="10" />
      <path d="M12 12l-2 3h4l-2 -3z" />
    </svg>
  );
}
