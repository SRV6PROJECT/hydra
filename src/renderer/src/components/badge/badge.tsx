import React from "react";
import cn from "classnames";

import "./badge.scss";

export interface BadgeProps
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > {
  children: React.ReactNode;
}

export function Badge({ children, className, ...props }: Readonly<BadgeProps>) {
  return (
    <div className={cn("badge", className)} {...props}>
      {children}
    </div>
  );
}
