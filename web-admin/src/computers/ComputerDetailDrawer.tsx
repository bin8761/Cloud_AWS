import type { ReactNode } from "react";
import { Drawer } from "@/ui/Drawer";
import { Sheet } from "@/ui/Sheet";

type ComputerDetailDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  drawerWidthClassName?: string;
};

export function ComputerDetailDrawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = "Close computer detail",
  drawerWidthClassName = "w-full max-w-2xl",
}: ComputerDetailDrawerProps): JSX.Element {
  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        description={description}
        footer={footer}
        closeLabel={closeLabel}
        widthClassName={drawerWidthClassName}
        className="hidden md:block"
      >
        {children}
      </Drawer>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        description={description}
        footer={footer}
        closeLabel={closeLabel}
      >
        {children}
      </Sheet>
    </>
  );
}
