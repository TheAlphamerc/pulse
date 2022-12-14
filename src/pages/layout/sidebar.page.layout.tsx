import React from "react";

interface SidebarPageLayoutProps {
  header?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  isOpen: boolean;
}

/**
 * SidebarPageLayout is a layout component that wraps sidebars and content
 * @param children
 * @param isOpen
 * @param header
 * @param footer
 */

export const SidebarPageLayout = ({
  children,
  isOpen = true,
  header,
  footer,
}: SidebarPageLayoutProps) => {
  return (
    <div className="h-[calc(100vh-64px)] bg-white flex flex-col sm:w-12 lg:w-64 w-12">
      {/* HEADER */}
      <div className="flex-grow-0">{header}</div>

      {/* CONTENT */}

      <main className="flex-1 z-0 focus:outline-none">
        <div className="mx-auto px-1 overflow-y-auto">{children}</div>
      </main>

      {/*  FOOTER */}
      <div className="flex-grow-0">{footer}</div>
    </div>
  );
};
